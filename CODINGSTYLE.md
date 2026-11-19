# coding style

this document explains the design language and engineering conventions used in ramani. keep changes consistent with it.

**design principles**

- monochrome, high contrast and quiet. colour is reserved for the card art and the one blue accent.
- inspired by opencode.ai: fixed numbered sidebar, mono display type, inter body copy, hairline rules, generous whitespace.
- square corners everywhere. no shadows, no glassmorphism, no rounded cards.
- content first. the interface should disappear behind the links.
- every tag, count and link comes from [data/links.json](data/links.json).

**layout**

- desktop: fixed sidebar on the left at 20% of the viewport, minimum 224px and maximum 360px.
- main content is offset by the sidebar and uses `5.125rem 1.5rem 0 1rem` padding.
- content is capped at 1600px wide.
- at 64rem the sidebar becomes a 3.5rem topbar with a numbered menu sheet.
- the card grid collapses to one column at 40rem.
- page order: hero, dither divider, toolbar, section head, grid, footer.

**colour**

- all theme colours are css variables declared in `:root`.
- every token is a `light-dark()` pair. do not hard-code a theme colour inside a component.
- core tokens: `--bg`, `--bg-weak`, `--bg-strong`, `--text-strong`, `--text`, `--text-weak`, `--text-faint`, `--border`, `--border-strong`, `--link`.
- tag and action buttons are the deliberate exception: white and charcoal are fixed high-contrast interface colours, not theme colours.
- selection uses `--link` with white text.

**typography**

- headings, navigation, indexes and metadata use `--font-mono` (IBM Plex Mono).
- paragraphs, descriptions and button labels use `--font-sans` (Inter).
- hero heading: `clamp(2.4rem, 4.45vw, 3.75rem)`, weight 400, line-height 1.04, letter-spacing -0.03em.
- body copy: 15px with 1.6 line-height.
- interface buttons: 14px, weight 500.
- metadata: 11px to 14px, mono.
- do not add a new font family without a strong reason.

**components**

- buttons: square, flat, 2.5rem tall, 1.1rem horizontal padding and 12px gaps. light buttons are white with black text. active and dark buttons are charcoal with white text. counts are muted grey.
- cards: hairline grid, `assets/for-card.png` as a right-aligned background, a mask and a scrim for readable copy, mono title, inter description, mono tag row.
- tags: no leading hash. tags are square buttons, counts use tabular numbers.
- search: one line, square, mono placeholder, slash hint.
- footer: secondary link list with bracket markers, a 14px meta bar and a large mono wordmark.
- icons: inline svg only, sized with `currentColor`, 1.2px strokes where possible.

**html and liquid**

- one layout: `_layouts/default.html`.
- header and footer live in `_includes/`.
- internal links and assets always go through `relative_url`.
- front matter stays small: `layout`, `title`, `description`, `body_class` and page-specific data.
- no inline styles except css custom properties used for stagger, such as `--i`.
- accessibility is required: a skip link, `aria-current`, `aria-hidden` on decoration, real focus states and labels on icon-only controls.
- filtering hooks use `data-*` attributes, never presentational classes.

**css**

- one stylesheet: `assets/css/style.css`.
- order: tokens, reset and base, layout, components, prose, responsive, reduced motion.
- separate sections with short `/* ---- name ---- */` comments.
- logical properties (`inline`, `block`, `margin-inline`) are preferred.
- `!important` is only allowed for `.hidden` and the reduced motion reset.
- breakpoints are 64rem and 40rem.
- no shadows and no border radius on cards or layout surfaces. interface buttons stay square.
- respect `prefers-reduced-motion`.

**javascript**

- vanilla javascript only, wrapped in an iife with `'use strict'`.
- no dependencies and no build step.
- progressive enhancement: the site works without javascript. script only adds search, filtering, theme switching and the mobile menu.
- theme is stored under the `ramani-theme` key and cycles through system, light and dark.
- scope queries to the smallest container possible.
- never hard-code content in script. read it from the rendered cards or the json data.

**data**

- `data/links.json` is the only content source.
- every object has `url`, `title`, `why`, `tags`, `category`, `added` and `favorite`.
- categories come from `CATEGORY_ORDER` in `scripts/build-readme.js`.
- tags are lowercase and hyphenated. reuse the vocabulary on the tags page.
- after editing data, run `node scripts/build-readme.js`.

**docs**

- `README.md` is generated. edit `data/links.json` and the generator, never the tables by hand.
- docs use lowercase prose, one top-level heading, no em dashes and no raw urls as link text.
- links use words on the page, with the destination on hover.
- the generator lives in `scripts/build-readme.js`.

**local workflow**

```
bundle install
RUBYOPT="-r./scripts/ruby4-compat.rb" bundle exec jekyll serve --baseurl "" --port 4000
```

- open [localhost](http://localhost:4000).
- production uses the `/ramani` base url from `_config.yml`.
- build with `RUBYOPT="-r./scripts/ruby4-compat.rb" bundle exec jekyll build --baseurl ""`.
- deploy by pushing to `main`. github actions runs jekyll and publishes to pages.

**review checklist**

- [ ] content added to `data/links.json`, not to html.
- [ ] new colours added as tokens, not hard-coded in components.
- [ ] checked at 390px, 1024px and 1440px.
- [ ] checked in light and dark mode.
- [ ] keyboard focus and reduced motion still work.
- [ ] `README.md` regenerated with `node scripts/build-readme.js`.
- [ ] no em dashes, no leading hashes on tags and lowercase docs.
