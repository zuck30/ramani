#!/usr/bin/env node
/**
 * build-readme.js - generates README.md from data/links.json.
 *
 * data/links.json is the single source of truth for link content.
 * The whole README is rebuilt on every run, so it is deterministic and
 * never accumulates duplicate sections.
 *
 * Pure Node stdlib, no dependencies.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'links.json');
const OUT_FILE = path.join(ROOT, 'README.md');

const REPO = 'zuck30/ramani';
const SITE = 'https://zuck30.github.io/ramani/';

const CATEGORY_ORDER = [
  'landing-pages',
  'saas-dashboards',
  'fintech',
  'corporate-defence',
  'agriculture-farms',
  'food-beverage',
  'education',
  'portfolios-creative',
  'local-tanzania',
  'resources',
  'reading',
];

function titleize(slug) {
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function tagList(l) {
  return (l.tags || []).map((t) => '`' + t + '`').join(' ');
}

function tableRow(l) {
  return '| [' + esc(l.title) + '](' + l.url + ') | ' + esc(l.why) + ' | ' + tagList(l) + ' |\n';
}

const TABLE_HEADER = '| Site | Why | Tags |\n|------|-----|------|\n';

function badges(linkCount) {
  const deployUrl = 'https://github.com/' + REPO + '/actions/workflows/jekyll.yml';
  const deployBadge = 'https://github.com/' + REPO + '/actions/workflows/jekyll.yml/badge.svg';
  return [
    `[![Deploy](${deployBadge})](${deployUrl})`,
    `[![Website](https://img.shields.io/website?url=${encodeURIComponent(SITE)}&label=website)](${SITE})`,
    '[![Jekyll](https://img.shields.io/badge/Jekyll-3.9-CC0000?logo=jekyll&logoColor=white)](https://jekyllrb.com/)',
    '[![Ruby](https://img.shields.io/badge/Ruby-3.x%20%7C%204.x-CC342D?logo=ruby&logoColor=white)](https://www.ruby-lang.org/)',
    `[![Links](https://img.shields.io/badge/links-${linkCount}-161616)](data/links.json)`,
    '[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)',
    '[![PRs welcome](https://img.shields.io/badge/PRs-welcome-black.svg)](CONTRIBUTION.md)',
  ].join('\n');
}

function intro(links) {
  const today = new Date().toISOString().slice(0, 10);

  return [
    '# ramani',
    '',
    badges(links.length),
    '',
    'A curated map of the good web: landing pages, SaaS dashboards, fintech, portfolios, developer tools, and African/Tanzanian sites worth learning from.',
    '',
    `**Website:** [${SITE}](${SITE}) · **Browse by tags:** [${SITE}tags/](${SITE}tags/)`,
    '',
    '<p align="center">',
    `  <a href="${SITE}">`,
    '    <img src="assets/ramani-2.png" alt="ramani — a map of the good web" width="800">',
    '  </a>',
    '</p>',
    '',
    `**${links.length} links** · last updated ${today}`,
    '',
    '> The link tables below are generated from [`data/links.json`](data/links.json). Edit that file, not the tables.',
    '',
    '## Getting started',
    '',
    'Ramani is a static [Jekyll](https://jekyllrb.com/) site backed by a single JSON data file. There is no database, no API and no client-side framework — the browser only loads HTML, one stylesheet and a small vanilla-JS search/filter script.',
    '',
    '### Why Jekyll and Ruby?',
    '',
    '- **GitHub Pages builds it natively.** Pushing to `main` runs Jekyll in GitHub Actions and publishes the result, so hosting is free and requires no server.',
    '- **Liquid keeps content and layout separate.** `data/links.json` is the only place links live; the home page, tag page and README are all rendered from it.',
    '- **Ruby is build-time only.** The language choice is about a mature static-site toolchain, not runtime dependencies. Visitors download plain HTML, CSS and a few lines of JavaScript.',
    '- **It stays small and fast.** No bundler, hydration, CDN runtime or database means fast loads and easy long-term maintenance.',
    '',
    '### Requirements',
    '',
    '- Ruby 3.0+ and Bundler (`gem install bundler`) — Ruby 4 works through the included compatibility shim.',
    '- Node.js 20+ — only needed to regenerate this README.',
    '',
    '### Run it locally',
    '',
    '```bash',
    'bundle install',
    '',
    '# macOS / Linux (Bash or Zsh)',
    'RUBYOPT="-r./scripts/ruby4-compat.rb" bundle exec jekyll serve --baseurl "" --port 4000',
    '```',
    '',
    'Open **[http://localhost:4000](http://localhost:4000)** — the development server runs on **port 4000** by default. `--baseurl ""` drops the production `/ramani` prefix so local asset URLs resolve.',
    '',
    'If Jekyll stops with `cannot load such file -- webrick` (Ruby 3+ no longer ships it), install it once:',
    '',
    '```bash',
    'gem install webrick',
    '```',
    '',
    'Or build the site and serve the output with any static server:',
    '',
    '```bash',
    'RUBYOPT="-r./scripts/ruby4-compat.rb" bundle exec jekyll build --baseurl ""',
    'python3 -m http.server 4000 --directory _site',
    '```',
    '',
    '### Add a link',
    '',
    '1. Add an object to [`data/links.json`](data/links.json):',
    '',
    '```json',
    '{',
    '  "url": "https://example.com",',
    '  "title": "Example",',
    '  "why": "One line on what makes it worth keeping.",',
    '  "tags": ["minimal", "saas"],',
    '  "category": "landing-pages",',
    '  "added": "2026-11-19",',
    '  "favorite": false',
    '}',
    '```',
    '',
    '2. Regenerate the link tables in this README:',
    '',
    '```bash',
    'node scripts/build-readme.js',
    '```',
    '',
    '3. Commit both files and push to `main`. GitHub Actions builds and deploys the site automatically.',
    '',
    '### Project layout',
    '',
    '| Path | What it is |',
    '|------|------------|',
    '| `data/links.json` | Source of truth for every site, tag and note. |',
    '| `index.html` | Home page: hero, search, tag filters and the link grid. |',
    '| `tags.md` | Controlled tag vocabulary and live counts. |',
    '| `_layouts/` | Jekyll layout (head, theme boot, page frame). |',
    '| `_includes/` | Sidebar navigation and footer. |',
    '| `assets/css/style.css` | The opencode.ai-inspired design system. |',
    '| `assets/for-card.png` | Mascot used as the card background. |',
    '| `assets/nav-logo.png` | Navbar logo. |',
    '| `scripts/build-readme.js` | Rebuilds this README from the JSON data. |',
    '| `scripts/ruby4-compat.rb` | Local shim for Jekyll 3.9 on Ruby 4. |',
    '',
    '### Deployment',
    '',
    'Pushing to `main` triggers [`.github/workflows/jekyll.yml`](.github/workflows/jekyll.yml), which builds the site with `actions/jekyll-build-pages` and deploys it to GitHub Pages. The production base URL is `/ramani`, matching `baseurl` in `_config.yml`.',
    '',
    '### Contributing',
    '',
    'Suggestions and new links are welcome — see [`CONTRIBUTION.md`](CONTRIBUTION.md) or open a pull request. Please keep tags to the vocabulary listed on the [tags page](https://zuck30.github.io/ramani/tags/).',
    '',
    '### License',
    '',
    'Released under the [MIT License](LICENSE).',
    '',
    '---',
    '',
    '',
  ].join('\n');
}

function generateReadme(links) {
  const groups = new Map();
  for (const l of links) {
    const cat = CATEGORY_ORDER.includes(l.category) ? l.category : 'reading';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(l);
  }

  let md = intro(links);

  // ⭐ Start Here - deduplicated union of all favorite entries, sorted by title.
  const favorites = links
    .filter((l) => l.favorite)
    .sort((a, b) => a.title.localeCompare(b.title));
  if (favorites.length > 0) {
    md += '## ⭐ Start here\n\n' + TABLE_HEADER;
    for (const l of favorites) md += tableRow(l);
    md += '\n';
  }

  // Category sections in the fixed order.
  for (const cat of CATEGORY_ORDER) {
    const items = groups.get(cat);
    if (!items || items.length === 0) continue;
    items.sort((a, b) => a.title.localeCompare(b.title));
    md += '## ' + titleize(cat) + '\n\n' + TABLE_HEADER;
    for (const l of items) md += tableRow(l);
    md += '\n';
  }

  return md.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function main() {
  const links = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(links)) {
    throw new Error('data/links.json must be an array of link objects.');
  }

  fs.writeFileSync(OUT_FILE, generateReadme(links));
  console.log('README.md rebuilt: ' + links.length + ' links across ' +
    CATEGORY_ORDER.length + ' categories.');
}

main();
