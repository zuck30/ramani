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

function label(slug) {
  return slug.replace(/-/g, ' ');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .replace(/\u2014/g, ',')
    .replace(/\u2013/g, '-');
}

function lower(s) {
  return esc(s).toLowerCase();
}

function tagList(l) {
  return (l.tags || []).map((t) => '`' + t + '`').join(' ');
}

function linkUrl(url) {
  // keep the README to a single '#' (the title heading)
  return String(url).replace(/#/g, '%23');
}

function tableRow(l) {
  return '| [' + lower(l.title) + '](' + linkUrl(l.url) + ') | ' + lower(l.why) + ' | ' + tagList(l) + ' |\n';
}

const TABLE_HEADER = '| site | why | tags |\n|------|-----|------|\n';

function badges(linkCount) {
  const deployUrl = 'https://github.com/' + REPO + '/actions/workflows/jekyll.yml';
  return [
    `[![deploy](https://img.shields.io/badge/deploy-github%20pages-black)](${deployUrl})`,
    `[![website](https://img.shields.io/website?url=${encodeURIComponent(SITE)}&label=website)](${SITE})`,
    '[![jekyll](https://img.shields.io/badge/jekyll-3.9-cc0000?logo=jekyll&logoColor=white)](https://jekyllrb.com/)',
    '[![ruby](https://img.shields.io/badge/ruby-3.x%20%7C%204.x-cc342d?logo=ruby&logoColor=white)](https://www.ruby-lang.org/)',
    `[![links](https://img.shields.io/badge/links-${linkCount}-161616)](data/links.json)`,
    '[![license](https://img.shields.io/badge/license-mit-black)](LICENSE)',
    '[![prs welcome](https://img.shields.io/badge/prs-welcome-black)](CONTRIBUTION.md)',
  ].join('\n');
}

function intro(links) {
  const today = new Date().toISOString().slice(0, 10);

  return [
    '# ramani',
    '',
    badges(links.length),
    '',
    'a map of the good, unsloppy, tasteful web: landing pages, saas dashboards, fintech, portfolios, developer tools, and sites across global, africa and tanzania.',
    '',
    `visit the [website](${SITE}) or browse the [tags](${SITE}tags/)`,
    '',
    '<p align="center">',
    `  <a href="${SITE}">`,
    '    <img src="assets/ramani-2.png" alt="ramani, a map of the good, unsloppy, tasteful web" width="800">',
    '  </a>',
    '</p>',
    '',
    `**${links.length} links** · last updated ${today}`,
    '',
    '> the link tables below are generated from [data/links.json](data/links.json). edit that file, not the tables.',
    '',
    'see [coding style](CODINGSTYLE.md) for the design language and code conventions.',
    '',
    '**getting started**',
    '',
    'ramani is a static [jekyll](https://jekyllrb.com/) site backed by a single json data file. there is no database, no api and no client-side framework: the browser only loads html, one stylesheet and a small vanilla-js search/filter script.',
    '',
    '**why jekyll and ruby?**',
    '',
    '- **github pages builds it natively.** pushing to `main` runs jekyll in github actions and publishes the result, so hosting is free and requires no server.',
    '- **liquid keeps content and layout separate.** `data/links.json` is the only place links live; the home page, tag page and readme are all rendered from it.',
    '- **ruby is build-time only.** the language choice is about a mature static-site toolchain, not runtime dependencies. visitors download plain html, css and a few lines of javascript.',
    '- **it stays small and fast.** no bundler, hydration, cdn runtime or database means fast loads and easy long-term maintenance.',
    '',
    '**requirements**',
    '',
    '- ruby 3.0+ and bundler (`gem install bundler`). ruby 4 works through the included compatibility shim.',
    '- node.js 20+, only needed to regenerate this readme.',
    '',
    '**run it locally**',
    '',
    '```bash',
    'bundle install',
    'RUBYOPT="-r./scripts/ruby4-compat.rb" bundle exec jekyll serve --baseurl "" --port 4000',
    '```',
    '',
    'open **[localhost](http://localhost:4000)**: the development server runs on **port 4000** by default. `--baseurl ""` drops the production `/ramani` prefix so local asset urls resolve.',
    '',
    'if jekyll stops with `cannot load such file -- webrick` (ruby 3+ no longer ships it), install it once:',
    '',
    '```bash',
    'gem install webrick',
    '```',
    '',
    'or build the site and serve the output with any static server:',
    '',
    '```bash',
    'RUBYOPT="-r./scripts/ruby4-compat.rb" bundle exec jekyll build --baseurl ""',
    'python3 -m http.server 4000 --directory _site',
    '```',
    '',
    '**add a link**',
    '',
    '1. add an object to [data/links.json](data/links.json):',
    '',
    '```json',
    '{',
    '  "url": "https://example.com",',
    '  "title": "example",',
    '  "why": "one line on what makes it worth keeping.",',
    '  "tags": ["minimal", "saas"],',
    '  "category": "landing-pages",',
    '  "added": "2026-11-19",',
    '  "favorite": false',
    '}',
    '```',
    '',
    '2. regenerate the link tables in this readme:',
    '',
    '```bash',
    'node scripts/build-readme.js',
    '```',
    '',
    '3. commit both files and push to `main`. github actions builds and deploys the site automatically.',
    '',
    '**project layout**',
    '',
    '| path | what it is |',
    '|------|------------|',
    '| `data/links.json` | source of truth for every site, tag and note. |',
    '| `index.html` | home page: hero, search, tag filters and the link grid. |',
    '| `tags.md` | controlled tag vocabulary and live counts. |',
    '| `_layouts/` | jekyll layout (head, theme boot, page frame). |',
    '| `_includes/` | sidebar navigation and footer. |',
    '| `assets/css/style.css` | the opencode.ai-inspired design system. |',
    '| `assets/for-card.png` | mascot used as the card background. |',
    '| `assets/nav-logo.png` | navbar logo. |',
    '| [coding style](CODINGSTYLE.md) | design language and code conventions. |',
    '| `scripts/build-readme.js` | rebuilds this readme from the json data. |',
    '| `scripts/ruby4-compat.rb` | local shim for jekyll 3.9 on ruby 4. |',
    '',
    '**deployment**',
    '',
    'pushing to `main` triggers [.github/workflows/jekyll.yml](.github/workflows/jekyll.yml), which builds the site with `actions/jekyll-build-pages` and deploys it to github pages. the production base url is `/ramani`, matching `baseurl` in `_config.yml`.',
    '',
    '**contributing**',
    '',
    'suggestions and new links are welcome. see [contribution](CONTRIBUTION.md) or open a pull request. please keep tags to the vocabulary listed on the [tags page](https://zuck30.github.io/ramani/tags/).',
    '',
    '**license**',
    '',
    'released under the [mit license](LICENSE).',
    '',
    'beautifully made with love by [shadrackovsky](https://github.com/zuck30).',
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

  const favorites = links
    .filter((l) => l.favorite)
    .sort((a, b) => a.title.localeCompare(b.title));
  if (favorites.length > 0) {
    md += '**start here**\n\n' + TABLE_HEADER;
    for (const l of favorites) md += tableRow(l);
    md += '\n';
  }

  for (const cat of CATEGORY_ORDER) {
    const items = groups.get(cat);
    if (!items || items.length === 0) continue;
    items.sort((a, b) => a.title.localeCompare(b.title));
    md += '**' + label(cat) + '**\n\n' + TABLE_HEADER;
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
  console.log('README.md rebuilt: ' + links.length + ' links, lowercase, single # heading.');
}

main();
