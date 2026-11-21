# coding style

this document explains the design language and engineering conventions used in ramani. keep changes consistent with it.

# design principles

- monochrome, high contrast and quiet. colour is reserved for the card art and the one blue accent.
- inspired by opencode.ai, which is the new project i'm contributing to: fixed numbered sidebar, mono display type, inter body copy, hairline rules, generous whitespace, and so on.
- square corners everywhere. no shadows, no glassmorphism, no rounded cards.
- content first. the interface should disappear behind the links.
- every tag, count and link comes from [data/links.json](data/links.json).

# layout

- desktop: fixed sidebar on the left at 20% of the viewport, minimum 224px and maximum 360px.
- main content is offset by the sidebar and uses `5.125rem 1.5rem 0 1rem` padding.
- content is capped at 1600px wide.
- at 64rem the sidebar becomes a 3.5rem topbar with a numbered menu sheet.
- the card grid collapses to one column at 40rem.
- page order: hero, dither divider, toolbar, section head, grid, footer.

# colour

- all theme colours are css variables declared in `:root`.
- every token is a `light-dark()` pair. do not hard-code a theme colour inside a component.
- core tokens: `--bg`, `--bg-weak`, `--bg-strong`, `--text-strong`, `--text`, `--text-weak`, `--text-faint`, `--border`, `--border-strong`, `--link`.
- tag and action buttons are the deliberate exception: white and charcoal are fixed high-contrast interface colours, not theme colours.
- selection uses `--link` with white text.

# typography

- headings, navigation, indexes and metadata use `--font-mono` (ibm plex mono).
- paragraphs, descriptions and button labels use `--font-sans` (inter).
- hero heading: `clamp(2.4rem, 4.45vw, 3.75rem)`, weight 400, line-height 1.04, letter-spacing -0.03em.
- body copy: 15px with 1.6 line-height.
- interface buttons: 14px, weight 500.
- metadata: 11px to 14px, mono.
- do not add a new font family without a strong reason.

# components

- buttons: square, flat, 2.5rem tall, 1.1rem horizontal padding and 12px gaps. light buttons are white with black text. active and dark buttons are charcoal with white text. counts are muted grey.
- cards: hairline grid, `assets/for-card.png` as a right-aligned background, a mask and a scrim for readable copy, mono title, inter description, mono tag row.
- tags: no leading hash. tags are square buttons, counts use tabular numbers.
- card tag rows separate tags with `assets/icons/tag-dot.png` as a css mask, never a text bullet. the last tag has no separator.
- search: one line, square, mono placeholder, slash hint.
- footer: secondary link list with bracket markers, a 14px meta bar, a contact line and a large mono wordmark.
- contact: `assets/icons/mail.png` as a css mask tinted with `currentColor`. the address is always visible as text, and `mailto:` links may prefill a subject and body.
- icons: inline svg for interface glyphs. sidebar navigation icons are png masks tinted with `currentColor`.

# html and liquid

- one layout: `_layouts/default.html`.
- header and footer live in `_includes/`.
- internal links and assets always go through `relative_url`.
- front matter stays small: `layout`, `title`, `description`, `body_class` and page-specific data.
- no inline styles except css custom properties used for stagger, such as `--i`.
- accessibility is required: a skip link, `aria-current`, `aria-hidden` on decoration, real focus states and labels on icon-only controls.
- filtering hooks use `data-*` attributes, never presentational classes.

# css

- one stylesheet: `assets/css/style.css`.
- the stylesheet is linked with a `?v=` build timestamp so a deploy never pairs new html with a cached stylesheet.
- order: tokens, reset and base, layout, components, prose, responsive, reduced motion.
- separate sections with short `/* ---- name ---- */` comments.
- logical properties (`inline`, `block`, `margin-inline`) are preferred.
- `!important` is only allowed for `.hidden` and the reduced motion reset.
- breakpoints are 64rem and 40rem.
- no shadows and no border radius on cards or layout surfaces. interface buttons stay square.
- respect `prefers-reduced-motion`.

# javascript

- vanilla javascript only, wrapped in an iife with `'use strict'`.
- no dependencies and no build step.
- progressive enhancement: the site works without javascript. script only adds search, filtering, theme switching and the mobile menu.
- theme is stored under the `ramani-theme` key and cycles through system, light and dark.
- scope queries to the smallest container possible.
- never hard-code content in script. read it from the rendered cards or the json data.

# chat

- `assets/js/chat.js` is vanilla javascript, no dependencies, and builds itself only when the page declares a chat endpoint.
- the widget never holds an api key. it posts to `supabase/functions/ramani-chat`, which keeps the secret.
- candidates are ranked in the browser from the cards already on the page, then at most 12 are sent. never send the whole dataset.
- questions about the project itself send no candidates at all.
- the model is told to name only real links from the candidate list, in lowercase, with no em dashes.
- rate limiting lives in postgres (`supabase/sql/rate-limit.sql`), not in memory. edge isolates are short lived and per-instance, so a memory counter is theatre.
- the limiter fails closed. if the counter is unreachable, refuse the request rather than spend money.
- always keep the global daily cap. a per-ip limit alone is defeated by rotating addresses.
- keep the frame close to bruno in antera: labelled launcher pill, glass panel with a dark frame, rotating avatar ring, pill input, gradient prompt chips. this is the one place the site is allowed soft corners and a colour accent.
- the launcher must stay recognisable: the avatar plus the words "ask kambarage", on the inverted surface so it reads against the page in both themes.
- the panel must still adapt to the theme. tokens are scoped on `.ask` and use `light-dark()`, never hard-coded white.
- the widget is optional: with `chat.endpoint` empty the site behaves exactly as before.

# data

- `data/links.json` is the only content source.
- every object has `url`, `title`, `why`, `tags`, `category`, `added` and `favorite`.
- categories come from `CATEGORY_ORDER` in `scripts/build-readme.js`.
- tags are lowercase and hyphenated. reuse the vocabulary on the tags page.
- after editing data, run `node scripts/build-readme.js`.
- the contact email lives once, in `_config.yml`. the footer reads `site.email` and the readme generator parses the same key. never hard-code the address in a template or a script.

# feed

- `feed.xml` is an atom feed of the 30 newest links, rendered by jekyll from `data/links.json`.
- it needs no build step and no dependency: edit `feed.xml`, never generate it in script.
- entries are sorted by `added` descending. same-date entries keep their `links.json` order so readers do not re-flag old items.
- each entry carries the url as its stable `id`, the `why` as `summary`, why plus category plus tags as `content`, and one `category` element per tag.
- all urls are absolute, built from `site.url` and `site.baseurl`.
- escape every interpolated value. the html block is escaped once, for `content type="html"`.
- the feed is announced in `_layouts/default.html` with a `rel="alternate"` link and linked from the footer.

# docs

- `README.md` is generated. edit `data/links.json` and the generator, never the tables by hand.
- documentation prose is lowercase. lowercase proper nouns like github, jekyll and ruby. keep code, commands, urls and file paths in their required case.
- every heading uses a single `#`. do not use `##` or `###`, and do not use bold text as a heading.
- no em dashes, no middle dots and no raw urls as link text.
- links use words on the page, with the destination on hover.
- the generator lives in `scripts/build-readme.js`.

# local workflow

```
bundle install
RUBYOPT="-r./scripts/ruby4-compat.rb" bundle exec jekyll serve --baseurl "" --port 4000
```

- open [localhost](http://localhost:4000).
- production uses the `/ramani` base url from `_config.yml`.
- build with `RUBYOPT="-r./scripts/ruby4-compat.rb" bundle exec jekyll build --baseurl ""`.
- the kambarage widget needs `.env`. copy `.env.example` to `.env`, fill it in, run `node scripts/env.js`, then add `--config _config.yml,_config.local.yml` to the build.
- `.env` and `_config.local.yml` are gitignored. never commit either.
- deploy by pushing to `main`. github actions runs jekyll and publishes to pages.

# review checklist

- [ ] content added to `data/links.json`, not to html.
- [ ] new colours added as tokens, not hard-coded in components.
- [ ] checked at 390px, 1024px and 1440px.
- [ ] checked in light and dark mode.
- [ ] keyboard focus and reduced motion still work.
- [ ] `README.md` regenerated with `node scripts/build-readme.js`.
- [ ] `feed.xml` still parses as atom after a data change.
- [ ] no em dashes, single-hash headings and lowercase docs.
