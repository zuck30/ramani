# ask ramani

the chat panel on the site. it answers two kinds of question:

- link questions: which sites on the map match what you are after.
- site questions: how to submit a link, what the tags mean, the licence, how it is built.

it is deliberately small. the page pre-filters the 388 links in the browser and
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

3. store the key the function needs. this is the only real secret.

```
supabase secrets set DEEPSEEK_API_KEY=sk-...
```

4. deploy the function. jwt verification is already turned off in
   `supabase/config.toml`, because the page calls it with the public anon key and
   no user session.

```
supabase functions deploy ramani-chat
```

5. point the site at it. open `_config.yml` and fill in both values.

```
chat:
  endpoint: "https://<your-project-ref>.supabase.co/functions/v1/ramani-chat"
  key: "<your anon public key>"
```

6. rebuild and push. the trigger appears in the bottom right corner.

# configuration

| name | where | default | what it does |
|------|-------|---------|--------------|
| `chat.endpoint` | `_config.yml` | empty | function url. empty hides the widget. |
| `chat.key` | `_config.yml` | empty | supabase anon key. public by design. |
| `DEEPSEEK_API_KEY` | supabase secret | none | the only secret. never put it in the repo. |
| `DEEPSEEK_MODEL` | supabase secret | `deepseek-chat` | model name, if you want another. |
| `ALLOWED_ORIGIN` | supabase secret | `*` | lock cors to your site once it works. |

# cost and abuse

a request sends about a dozen candidate links plus the question, roughly 700
tokens in and a few hundred out, so it is cheap per answer. the function has a
best-effort throttle of 12 questions a minute per ip, kept in memory per edge
isolate. that blunts a naive loop but is not a real rate limiter. if strangers
start burning your credits, put cloudflare turnstile or a kv-backed limiter in
front of the function, and set `ALLOWED_ORIGIN` to the site.

# local testing

the widget hides when `chat.endpoint` is empty, so to try it locally either
deploy the function first, or set a temporary endpoint in `_config.yml`, build,
and stub the network in the browser. remember to empty the values before you
commit.
