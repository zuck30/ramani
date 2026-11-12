#!/usr/bin/env node
/**
 * build-readme.js - generates README.md from data/links.json.
 *
 * data/links.json is the single source of truth for link content.
 * This script generates table content while preserving existing README.md structure.
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
  return '| [' + esc(l.title) + '](' + l.url + ') | ' + esc(l.why) + ' | ' + tagList(l) + '|\n';
}

const TABLE_HEADER = '| Site | Why | Tags |\n|------|-----|------|\n';

function parseSections(content) {
  const sections = {};
  let currentSection = null;
  
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a category section header
    for (const cat of CATEGORY_ORDER) {
      const sectionHeader = '\n## ' + titleize(cat) + '\n';
      if (line === sectionHeader.substring(1)) {
        currentSection = cat;
        break;
      }
    }
    
    if (currentSection) {
      if (!sections[currentSection]) {
        sections[currentSection] = [];
      }
      sections[currentSection].push(line);
    }
  }
  
  return sections;
}

function replaceSection(content, category, newContent) {
  const lines = content.split('\n');
  const sectionHeader = '\n## ' + titleize(category) + '\n';
  
  // Find the start of the section
  let startIndex = -1;
  for (let i = 0; i < lines.length - sectionHeader.length + 1; i++) {
    if (lines.slice(i, i + sectionHeader.length).join('\n') === sectionHeader) {
      startIndex = i;
      break;
    }
  }
  
  if (startIndex === -1) {
    // Section not found, append at end
    return content + '\n' + newContent;
  }
  
  // Find the end of the section (next section header or end of file)
  let endIndex = lines.length;
  for (let i = startIndex + sectionHeader.length; i < lines.length; i++) {
    // Check if this looks like a new section header
    const line = lines[i];
    let isNewSection = false;
    for (const cat of CATEGORY_ORDER) {
      if (line === '\n## ' + titleize(cat) + '\n') {
        isNewSection = true;
        break;
      }
    }
    
    if (isNewSection) {
      endIndex = i;
      break;
    }
  }
  
  // Replace the section
  const newLines = lines.slice(0, startIndex)
    .concat(newContent.split('\n'))
    .concat(lines.slice(endIndex));
  
  return newLines.join('\n');
}

function generateTableContent(links, category) {
  const items = links.filter(l => l.category === category);
  if (items.length === 0) return '';
  
  items.sort((a, b) => a.title.localeCompare(b.title));
  
  let content = '\n## ' + titleize(category) + '\n\n' + TABLE_HEADER;
  for (const l of items) {
    content += tableRow(l);
  }
  return content;
}

function updateReadmeWithPreservedStructure(existingContent, newLinks) {
  // Parse existing content into sections
  const sections = parseSections(existingContent);
  
  // Generate new table content for each category
  const newTableContents = {};
  for (const cat of CATEGORY_ORDER) {
    newTableContents[cat] = generateTableContent(newLinks, cat);
  }
  
  // Update only the table sections, preserve everything else
  let result = existingContent;
  
  // Replace each category section with new content
  for (const cat of CATEGORY_ORDER) {
    const newContent = newTableContents[cat];
    if (newContent) {
      result = replaceSection(result, cat, newContent);
    }
  }
  
  // Update link count and date
  result = updateLinkCountAndDate(result, newLinks);
  
  return result;
}

function updateLinkCountAndDate(content, links) {
  const today = new Date().toISOString().slice(0, 10);
  const linkCount = links.length;
  
  // Update the line with link count
  const linkCountPattern = /\*\*\d+ links\*\* · last updated \d{4}-\d{2}-\d{2}/;
  const newLinkCountLine = '**' + linkCount + ' links** · last updated ' + today;
  
  return content.replace(linkCountPattern, newLinkCountLine);
}

function generateCompleteReadme(links) {
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
  
  return md;
}

function main() {
  const links = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(links)) {
    throw new Error('data/links.json must be an array of link objects.');
  }

  let md;
  
  // If README.md exists, preserve its structure
  if (fs.existsSync(OUT_FILE)) {
    const existingContent = fs.readFileSync(OUT_FILE, 'utf8');
    md = updateReadmeWithPreservedStructure(existingContent, links);
    console.log('README.md updated (preserving existing structure): ' + 
                links.length + ' links across categories.');
  } else {
    // Generate complete README.md for first time
    md = generateCompleteReadme(links);
    console.log('README.md created: ' + links.length + ' links across categories.');
  }
  
  fs.writeFileSync(OUT_FILE, md);
}

main();