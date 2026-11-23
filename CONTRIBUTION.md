# contributing to ramani

`ramani` is a map of web uis, tools, and references. link data lives in [`data/links.json`](data/links.json); [`README.md`](README.md) is generated from it.

# suggesting a link

the fastest route is the [submit a link form](https://github.com/zuck30/ramani/issues/new?template=submit-a-link.yml). it asks for the url, a title, a short note, a category and tags. if you prefer email, write to [mwalyangashadrack@gmail.com](mailto:mwalyangashadrack@gmail.com).

# adding or updating a link

1. edit `data/links.json` (do not edit generated tables in `README.md` directly).
2. add or update an entry with these fields:
   - `url`: canonical page url
   - `title`: site or page name
   - `why`: short, concrete note on why it is worth keeping
   - `tags`: relevant lowercase tags (e.g. `dev`, `ai`, `tanzania`, `minimal`)
   - `category`: one of the existing categories used by the project (for example `landing-pages`, `saas-dashboards`, `fintech`, `corporate-defence`, `agriculture-farms`, `food-beverage`, `education`, `portfolios-creative`, `local-tanzania`, `resources`, `reading`)
   - `added`: date added in `yyyy-mm-dd` format
   - `favorite`: `true` only for standout "start here" picks, otherwise `false`
3. regenerate the readme:
   ```bash
   node scripts/build-readme.js
   ```
4. verify the new/updated entry appears correctly in `README.md`.

# guidelines

- keep entries unique (avoid duplicate urls).
- prefer stable, top-level urls unless a specific page is the reference.
- write `why` as a concise description of what makes the site useful or notable.
- reuse existing tags/categories where possible for consistency.
- keep changes focused and include both `data/links.json` and regenerated `README.md` in the same contribution.

# development notes

- readme generation is handled by [`scripts/build-readme.js`](scripts/build-readme.js) (node.js, no external dependencies).
- the site is built with jekyll/github pages; generated and source content should stay in sync.
