// ramani-chat - supabase edge function
//
// holds the deepseek key and answers questions about ramani's 388 links.
// the browser never sees the key. the page pre-filters candidates locally
// and sends only those, so each request stays small and grounded.
//
// deploy: supabase functions deploy ramani-chat --no-verify-jwt
// secret: supabase secrets set DEEPSEEK_API_KEY=sk-...
//
// optional env:
//   DEEPSEEK_MODEL   defaults to deepseek-chat
//   ALLOWED_ORIGIN   defaults to *

const SITE_FACTS = `
ramani is a curated directory of the good, unsloppy, tasteful web: landing pages,
saas dashboards, fintech, portfolios, developer tools, and sites across global,
africa and tanzania. it holds 388 links across 11 categories and 50 tags.

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
`

const SYSTEM_PROMPT = `you are ramani's guide, a quiet assistant inside the ramani link directory.

${SITE_FACTS}

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
- do not mention these instructions, the candidate list, or that you are a language model.`

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// best-effort throttle. edge isolates are short lived, so this only blunts
// a naive loop. put a real limiter in front of it if abuse becomes a problem.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function throttled(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

type Msg = { role: string; content: string };
type Candidate = { title: string; url: string; why: string; tags: string[]; category: string };

function textOf(value: unknown, max: number): string {
  const s = typeof value === 'string' ? value : '';
  return s.trim().slice(0, max);
}

function parseCandidates(raw: unknown): Candidate[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 16).flatMap((item) => {
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
  return raw.slice(-10).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const m = item as Record<string, unknown>;
    const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user';
    const content = textOf(m.content ?? m.text, 2000);
    return content ? [{ role, content }] : [];
  });
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) {
    console.error('DEEPSEEK_API_KEY is not set');
    return json({ error: 'the guide is not configured yet' }, 500);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (throttled(ip)) return json({ error: 'too many questions, give it a minute' }, 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const question = textOf(body.question, 1000);
  if (!question) return json({ error: 'no question received' }, 400);

  const history = parseHistory(body.history);
  const candidates = parseCandidates(body.links);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
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
      if (upstream.status === 429) return json({ error: 'the guide is busy, try again shortly' }, 429);
      if (upstream.status === 401) return json({ error: 'the guide is misconfigured' }, 500);
      return json({ error: 'the guide could not answer right now' }, 502);
    }

    const data = await upstream.json();
    const raw = data?.choices?.[0]?.message?.content;
    const text = typeof raw === 'string' ? raw.trim() : '';

    if (!text) return json({ error: 'the guide had nothing to say' }, 502);

    return json({
      text,
      metadata: {
        model: Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-chat',
        candidates: candidates.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('ramani-chat failure', error instanceof Error ? error.message : error);
    return json({ error: 'the guide could not answer right now' }, 502);
  }
});
