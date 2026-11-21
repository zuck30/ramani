# kambarage

the chat panel on the site. kambarage answers two kinds of question:

- link questions: which sites on the map match what you are after.
- site questions: how to submit a link, what the tags mean, the licence, how it is built.

it is deliberately small. the page pre-filters the links in the browser and
sends only about a dozen candidates per request, so the model never has to hold
the whole directory and cannot invent a url.

# how it fits together

```
index.html  ->  assets/js/chat.js  ->  supabase edge function  ->  deepseek
                    (picks candidates)      (holds the secret)      (answers)
```

- `assets/js/chat.js` builds the panel, reads the cards already on the page, and
  ranks them against the question. it never calls deepseek itself.
- `supabase/functions/ramani-chat/index.ts` holds the api key, adds the system
  prompt, and calls the model. the browser only ever sees the anon key.
- the widget does not exist until `chat.endpoint` is set in `_config.yml`, so the
  site works exactly as before until you deploy.

# deploy

1. install the supabase cli and log in.

```
supabase login
```

2. link this repo to your project. run this from the repo root.

```
supabase link --project-ref <your-project-ref>
```

3. create the rate limit table and function. paste `supabase/sql/rate-limit.sql`
   into the supabase sql editor and run it. it is safe to run more than once.
   without it the function falls back to an in-memory limiter, which is not
   enough in production.

4. store the key the function needs. this is the only real secret.

```
supabase secrets set DEEPSEEK_API_KEY=sk-...
```

5. deploy the function. jwt verification is already turned off in
   `supabase/config.toml`, because the page calls it with the public anon key and
   no user session.

```
supabase functions deploy ramani-chat
```

6. point the site at it. for local work, copy `.env.example` to `.env` and fill
   it in, then generate the local config.

```
cp .env.example .env
# edit .env, set SUPABASE_URL and SUPABASE_ANON_KEY
node scripts/env.js
```

7. build locally with the generated override. without the second config the
   widget stays hidden.

```
RUBYOPT="-r./scripts/ruby4-compat.rb" bundle exec jekyll build --baseurl "" \
  --config _config.yml,_config.local.yml
```

8. for production, put the same two values in `_config.yml`, because github
   pages has no access to `.env`. the anon key is public by design, so it is safe
   to commit there. then push, and the trigger appears in the bottom right corner.

```
chat:
  endpoint: "https://<your-project-ref>.supabase.co/functions/v1/ramani-chat"
  key: "<your anon public key>"
```

# configuration

| name | where | default | what it does |
|------|-------|---------|--------------|
| `chat.endpoint` | `_config.yml` | empty | function url. empty hides the widget. |
| `chat.key` | `_config.yml` | empty | supabase anon key. public by design. |
| `SUPABASE_URL` | `.env` | none | project url, used to generate `_config.local.yml`. |
| `SUPABASE_ANON_KEY` | `.env` | none | anon key, used to generate `_config.local.yml`. |
| `CHAT_FUNCTION` | `.env` | `ramani-chat` | function name, if you rename it. |
| `DEEPSEEK_API_KEY` | supabase secret | none | the only secret. never put it in the repo. |
| `DEEPSEEK_MODEL` | supabase secret | `deepseek-chat` | model name, if you want another. |
| `ALLOWED_ORIGIN` | supabase secret | `*` | lock cors to your site once it works. |
| `CHAT_PER_IP` | supabase secret | `12` | requests allowed per ip per window. |
| `CHAT_WINDOW_SECONDS` | supabase secret | `60` | length of the per ip window. |
| `CHAT_DAILY_CAP` | supabase secret | `2000` | total requests per day, all ips. the budget guard. |

`.env` is gitignored, and so is the `_config.local.yml` it generates. `.env.example`
is tracked, so the shape of the file is always visible without the values.

# cost and abuse

a request sends about a dozen candidate links plus the question, roughly 700
tokens in and a few hundred out, so it is cheap per answer. the risk is not one
expensive request, it is many cheap ones from someone who found the url.

three layers defend that, in order of importance:

- **daily cap.** `chat_rate_limit` sums every hit for the day across all ips. once
  the total passes `CHAT_DAILY_CAP`, everyone gets a 429 until midnight. this is
  the layer that protects the wallet, because rotating ips does not get around a
  global total.
- **per ip window.** a fixed window per ip, default 12 requests a minute. this
  stops one person hammering the endpoint, and the row is shared by every edge
  isolate instead of living in memory.
- **origin check.** when `ALLOWED_ORIGIN` is set, requests from any other origin
  get a 403. note this is a speed bump, not a wall: a script can send any origin
  header it likes. it only stops the lazy case of someone embedding your endpoint
  in their own page.

the limiter fails closed. if postgres cannot be reached, the function returns 503
rather than handing out free model calls, because an outage that costs nothing is
better than one that costs money.

input is also capped before it reaches the model: the question at 500 characters,
history at 8 messages and 4000 characters total, and candidates at 12. that stops
a caller from inflating the token bill on a single request.

## if it is still abused

the daily cap protects your budget but not your uptime. if the cap keeps getting
hit by strangers, add cloudflare turnstile in front of the function:

1. create a turnstile site in the cloudflare dashboard.
2. add the site key to the widget and verify the token in the function before
   the model call.
3. set `ALLOWED_ORIGIN` to the site so the widget is the only normal caller.

the anon key being public is expected and is not the problem. the deepseek key
never leaves supabase, so the worst case is wasted calls, never a leaked key.

# local testing

copy `.env.example` to `.env`, fill in the supabase url and anon key, run
`node scripts/env.js`, then build with `--config _config.yml,_config.local.yml`.
that writes a gitignored `_config.local.yml` and the widget appears locally.

if the function is not deployed yet, the panel opens and answers with the offline
message. that is expected, and it proves the wiring without needing the key.
