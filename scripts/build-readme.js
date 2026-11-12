#!/usr/bin/env node
/**
 * build-readme.js - generates README.md from data/links.json.
 *
 * data/links.json is the single source of truth.
 * Never hand-edit README.md; running this script overwrites it.
 * Pure Node stdlib, no dependencies.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'links.json');
const OUT_FILE = path.join(ROOT, 'README.md');

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

function main() {
  const links = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(links)) {
    throw new Error('data/links.json must be an array of link objects.');
  }

  // Group by category; unknown categories fall back to "reading".
  const groups = new Map();
  for (const l of links) {
    const cat = CATEGORY_ORDER.includes(l.category) ? l.category : 'reading';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(l);
  }

  const today = new Date().toISOString().slice(0, 10);

  let md = '# ramani\n\n';
  md += 'A map of the good web - UIs worth stealing from, tools worth keeping.\n\n';
  md += '**' + links.length + ' links** · last updated ' + today + '\n\n';
  md += '> Auto-generated from [`data/links.json`](data/links.json). Edit that file, not this one.\n';

  // ⭐ Start Here - deduplicated union of all favorite entries, sorted by title.
  const favorites = links
    .filter((l) => l.favorite)
    .sort((a, b) => a.title.localeCompare(b.title));
  if (favorites.length > 0) {
    md += '\n## ⭐ Start Here\n\n' + TABLE_HEADER;
    for (const l of favorites) md += tableRow(l);
  }

  // Category sections in the fixed order.
  for (const cat of CATEGORY_ORDER) {
    const items = groups.get(cat);
    if (!items || items.length === 0) continue;
    items.sort((a, b) => a.title.localeCompare(b.title));
    md += '\n## ' + titleize(cat) + '\n\n' + TABLE_HEADER;
    for (const l of items) md += tableRow(l);
  }

  fs.writeFileSync(OUT_FILE, md);
  console.log('README.md written: ' + links.length + ' links across ' + groups.size + ' categories.');
}

main();
