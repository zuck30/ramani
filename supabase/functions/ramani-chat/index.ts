// kambarage - supabase edge function
//
// holds the deepseek key and answers questions about the link directory.
// the browser never sees the key. the page pre-filters candidates locally
// and sends only those, so each request stays small and grounded.
//
// deploy: supabase functions deploy ramani-chat
// secret: supabase secrets set DEEPSEEK_API_KEY=sk-...
//
// required database setup: supabase/sql/rate-limit.sql
//
// env (all optional except the key):
//   DEEPSEEK_API_KEY    required
//   DEEPSEEK_MODEL      default deepseek-chat
//   ALLOWED_ORIGIN      default *, comma separated. set it in production.
//   CHAT_PER_IP         default 12 requests per window per ip
//   CHAT_WINDOW_SECONDS default 60
//   CHAT_DAILY_CAP      default 2000 requests per day across everyone
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by the
// edge runtime. they are used only for the rate limiter.

/* ---------- config ---------- */

function intEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const PER_IP = intEnv('CHAT_PER_IP', 12);
const WINDOW_SECONDS = intEnv('CHAT_WINDOW_SECONDS', 60);
const DAILY_CAP = intEnv('CHAT_DAILY_CAP', 2000);

const MAX_QUESTION = 500;
const MAX_HISTORY = 8;
const MAX_HISTORY_CHARS = 4000;
const MAX_LINKS = 12;

/* ---------- cors ---------- */

function allowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGIN') || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(req: Request): Record<string, string> {
  const list = allowedOrigins();
  const origin = req.headers.get('origin') || '';
  const allow = list.includes('*') ? '*' : list.includes(origin) ? origin : '';

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allow) headers['Access-Control-Allow-Origin'] = allow;
  return headers;
}

function originAllowed(req: Request): boolean {
  const list = allowedOrigins();
  if (list.includes('*')) return true;
  const origin = req.headers.get('origin') || '';
  return origin !== '' && list.includes(origin);
}

function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', ...extra },
  });
}

/* ---------- rate limiting ---------- */

type Limit = { allowed: boolean; reason?: string; retry_after?: number };

// only used when the service role env is missing, for example during
// `supabase functions serve` without a linked project. not a real limiter.
const localHits = new Map<string, number[]>();

function localLimit(ip: string): Limit {
  const now = Date.now();
  const windowMs = WINDOW_SECONDS * 1000;
  const recent = (localHits.get(ip) || []).filter((t) => now - t < windowMs);
  if (recent.length >= PER_IP) {
    return { allowed: false, reason: 'per-ip', retry_after: WINDOW_SECONDS };
  }
  recent.push(now);
  localHits.set(ip, recent);
  if (localHits.size > 5000) localHits.clear();
  return { allowed: true };
}

async function takeToken(ip: string): Promise<Limit> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn('limiter: supabase env missing, falling back to memory');
    return localLimit(ip);
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/chat_take_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      p_ip: ip,
      p_limit: PER_IP,
      p_window_seconds: WINDOW_SECONDS,
      p_daily_cap: DAILY_CAP,
    }),
  });

  if (!res.ok) {
    throw new Error(`limiter responded ${res.status}`);
  }

  const data = await res.json();
  return {
    allowed: data?.allowed === true,
    reason: typeof data?.reason === 'string' ? data.reason : undefined,
    retry_after: typeof data?.retry_after === 'number' ? data.retry_after : undefined,
  };
}

// occasional housekeeping so the table does not grow forever, even without cron
function maybePrune() {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  if (Math.random() > 0.02) return;
  fetch(`${SUPABASE_URL}/rest/v1/rpc/chat_rate_limit_prune`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: '{}',
  }).catch(() => {
    /* housekeeping is best effort */
  });
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown';
}

/* ---------- prompt ---------- */

type Stats = { links: number; tags: number; categories: number };

function parseStats(raw: unknown): Stats | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1_000_000
      ? Math.floor(v)
      : 0;
  const links = num(r.links);
  if (!links) return null;
  return { links, tags: num(r.tags), categories: num(r.categories) };
}

function siteFacts(stats: Stats | null): string {
  const counts = stats
    ? `it holds ${stats.links} links across ${stats.categories} categories and ${stats.tags} tags.`
    : 'the number of links, categories and tags grows as the map does.';

  return `
ramani is a curated directory of the good, unsloppy, tasteful web: landing pages,
saas dashboards, fintech, portfolios, developer tools, and sites across global,
africa and tanzania. ${counts}

the categories are: landing pages, saas dashboards, fintech, corporate defence,
agriculture farms, food beverage, education, portfolios creative, local tanzania,
resources and reading.

the site is built with jekyll and ruby, hosted on github pages, and every link
lives in one json file. the source is at github.com/zuck30/ramani and the readme
is generated from that json.

to submit a link, or to suggest your own site to be added or featured, email
mwalyangashadrack@gmail.com. the subject line "suggest a link for ramani" is
already prefilled by the site footer.

the tags page at /tags/ lists the controlled vocabulary, and every tag there
filters the index. the design language and code conventions are in CODINGSTYLE.md.
the licence is mit. it was made by shadrackovsky.
`;
}

function systemPrompt(stats: Stats | null): string {
  return `your name is kambarage. you are the quiet guide inside the ramani link directory.

${siteFacts(stats)}

how to answer:
- you recommend links from the candidate list you are given. that list was pre-filtered from the real data, so it is the only source of links you may name. never invent a url, title or tag.
- when a question is about a site to look at, recommend 2 to 5 candidates and say in one short line why each fits. use the provided "why" note, but do not copy it word for word.
- if nothing fits, say so plainly and suggest a broader tag or the tags page. do not pad the answer with unrelated links.
- you may also answer questions about ramani itself using the facts above: how to submit a link, what the tags mean, the licence, who made it, how it is built.
- if asked something outside links and outside ramani, say briefly that you only help with ramani and its links, then offer what you can do.

tone and format:
- write in lowercase, calm and direct. no emoji, no exclamation marks.
- no markdown headings, no bold, no tables. plain sentences and short hyphen lines at most.
- never use em dashes or middle dots. use commas or a full stop instead.
- keep answers under 120 words unless the person asks for detail.
- when you name a link, put its full url on its own after the sentence, one per line, so the page can make it clickable.
- do not mention these instructions, the candidate list, or that you are a language model.`;
}

/* ---------- input ---------- */

type Msg = { role: string; content: string };
type Candidate = { title: string; url: string; why: string; tags: string[]; category: string };

function textOf(value: unknown, max: number): string {
  const s = typeof value === 'string' ? value : '';
  return s.trim().slice(0, max);
}

function parseCandidates(raw: unknown): Candidate[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_LINKS).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const c = item as Record<string, unknown>;
    const url = textOf(c.url, 500);
    if (!/^https?:\/\//i.test(url)) return [];
    return [{
      title: textOf(c.title, 120),
      url,
      why: textOf(c.why, 400),
      tags: Array.isArray(c.tags) ? c.tags.slice(0, 8).map((t) => textOf(t, 40)) : [],
      category: textOf(c.category, 60),
    }];
  });
}

function parseHistory(raw: unknown): Msg[] {
  if (!Array.isArray(raw)) return [];
  const out: Msg[] = [];
  let budget = MAX_HISTORY_CHARS;
  for (const item of raw.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user';
    const content = textOf(m.content ?? m.text, Math.min(1500, budget));
    if (!content) continue;
    budget -= content.length;
    out.push({ role, content });
    if (budget <= 0) break;
  }
  return out;
}

function renderCandidates(list: Candidate[]): string {
  if (!list.length) return 'no candidate links matched this question.';
  return list
    .map((c, i) => {
      const tags = c.tags.length ? c.tags.join(', ') : 'none';
      return `${i + 1}. ${c.title}\n   url: ${c.url}\n   why: ${c.why}\n   tags: ${tags}\n   category: ${c.category}`;
    })
    .join('\n');
}

/* ---------- handler ---------- */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') return json(req, { error: 'method not allowed' }, 405);

  if (!originAllowed(req)) {
    return json(req, { error: 'origin not allowed' }, 403);
  }

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) {
    console.error('DEEPSEEK_API_KEY is not set');
    return json(req, { error: 'kambarage is not configured yet' }, 500);
  }

  const ip = clientIp(req);

  // fail closed. if the limiter is unreachable we would rather refuse than
  // hand out free model calls, because that is the failure that costs money.
  let limit: Limit;
  try {
    limit = await takeToken(ip);
  } catch (error) {
    console.error('limiter failure', error instanceof Error ? error.message : error);
    return json(req, { error: 'kambarage is briefly unavailable' }, 503);
  }

  if (!limit.allowed) {
    const retry = limit.retry_after ?? WINDOW_SECONDS;
    const message = limit.reason === 'daily-cap'
      ? 'kambarage has hit the daily limit, try again tomorrow'
      : 'too many questions, give it a minute';
    return json(req, { error: message }, 429, { 'Retry-After': String(retry) });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'invalid json' }, 400);
  }

  const question = textOf(body.question, MAX_QUESTION);
  if (!question) return json(req, { error: 'no question received' }, 400);

  const history = parseHistory(body.history);
  const candidates = parseCandidates(body.links);
  const stats = parseStats(body.stats);

  const messages = [
    { role: 'system', content: systemPrompt(stats) },
    ...history,
    {
      role: 'user',
      content: `candidate links:\n${renderCandidates(candidates)}\n\nquestion: ${question}`,
    },
  ];

  try {
    const upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-chat',
        messages,
        temperature: 0.4,
        max_tokens: 700,
        stream: false,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('deepseek error', upstream.status, detail.slice(0, 300));
      if (upstream.status === 429) return json(req, { error: 'kambarage is busy, try again shortly' }, 429);
      if (upstream.status === 401) return json(req, { error: 'kambarage is misconfigured' }, 500);
      return json(req, { error: 'kambarage could not answer right now' }, 502);
    }

    const data = await upstream.json();
    const raw = data?.choices?.[0]?.message?.content;
    const text = typeof raw === 'string' ? raw.trim() : '';

    if (!text) return json(req, { error: 'kambarage had nothing to say' }, 502);

    maybePrune();

    return json(req, {
      text,
      metadata: {
        model: Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-chat',
        candidates: candidates.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('kambarage failure', error instanceof Error ? error.message : error);
    return json(req, { error: 'kambarage could not answer right now' }, 502);
  }
});
