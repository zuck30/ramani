# Contributing to ramani

`ramani` is a curated map of web UIs, tools, and references. Link data lives in [`data/links.json`](data/links.json); [`README.md`](README.md) is generated from it.

## Adding or updating a link

1. Edit `data/links.json` (do not edit generated tables in `README.md` directly).
2. Add or update an entry with these fields:
   - `url`: canonical page URL
   - `title`: site or page name
   - `why`: short, concrete note on why it is worth keeping
   - `tags`: relevant lowercase tags (e.g. `dev`, `ai`, `tanzania`, `minimal`)
   - `category`: one of the existing categories used by the project (for example `landing-pages`, `saas-dashboards`, `fintech`, `corporate-defence`, `agriculture-farms`, `food-beverage`, `education`, `portfolios-creative`, `local-tanzania`, `resources`, `reading`)
   - `added`: date added in `YYYY-MM-DD` format
   - `favorite`: `true` only for standout "Start Here" picks, otherwise `false`
3. Regenerate the README:
   ```bash
   node scripts/build-readme.js
   ```
4. Verify the new/updated entry appears correctly in `README.md`.

## Guidelines

- Keep entries unique (avoid duplicate URLs).
- Prefer stable, top-level URLs unless a specific page is the reference.
- Write `why` as a concise description of what makes the site useful or notable.
- Reuse existing tags/categories where possible for consistency.
- Keep changes focused and include both `data/links.json` and regenerated `README.md` in the same contribution.

## Development notes

- README generation is handled by [`scripts/build-readme.js`](scripts/build-readme.js) (Node.js, no external dependencies).
- The site is built with Jekyll/GitHub Pages; generated and source content should stay in sync.
