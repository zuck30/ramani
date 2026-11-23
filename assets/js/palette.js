(function () {
  'use strict';

  var isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  var hint = document.getElementById('palette-hint');
  if (hint && !isMac) hint.textContent = 'ctrl K';

  var MAX = 10;

  var links = null;
  var built = false;
  var els = {};
  var hits = [];
  var active = 0;
  var previousFocus = null;

  function readLinks() {
    var cards = document.querySelectorAll('.card');
    var out = [];
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var titleEl = card.querySelector('.card-title');
      var whyEl = card.querySelector('.card-subtitle');
      var catEl = card.querySelector('.card-cat');
      var url = card.getAttribute('href') || '';
      var title = titleEl ? titleEl.textContent.trim() : '';
      if (!url || !title) continue;
      out.push({
        url: url,
        title: title,
        why: whyEl ? whyEl.textContent.trim() : '',
        tags: (card.getAttribute('data-tags') || '').split(',').filter(Boolean),
        category: catEl ? catEl.textContent.trim() : ''
      });
    }
    return out;
  }

  function tokenize(value) {
    var parts = String(value || '').toLowerCase().split(/\s+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].length > 1) out.push(parts[i]);
    }
    return out;
  }

  function score(link, tokens) {
    var total = 0;
    var title = link.title.toLowerCase();
    var why = link.why.toLowerCase();
    var category = link.category.toLowerCase().replace(/-/g, ' ');

    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      for (var j = 0; j < link.tags.length; j++) {
        var tag = link.tags[j].toLowerCase();
        if (tag === t) total += 8;
        else if (tag.indexOf(t) === 0) total += 4;
      }
      if (title.indexOf(t) !== -1) total += 6;
      if (category.indexOf(t) !== -1) total += 4;
      if (why.indexOf(t) !== -1) total += 1;
    }
    return total;
  }

  function filter(query) {
    if (!links) links = readLinks();
    var tokens = tokenize(query);

    if (!tokens.length) {
      return links.slice(0, MAX).map(function (l) {
        return { link: l, score: 0 };
      });
    }

    var ranked = [];
    for (var i = 0; i < links.length; i++) {
      var s = score(links[i], tokens);
      if (s > 0) ranked.push({ link: links[i], score: s });
    }
    ranked.sort(function (a, b) { return b.score - a.score; });
    return ranked.slice(0, MAX);
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function build() {
    if (built) return;
    built = true;

    var root = el('div', 'palette');
    root.id = 'palette';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'jump to a link');

    var panel = el('div', 'palette-panel');

    var field = el('div', 'palette-field');
    field.innerHTML = '<span class="palette-search-icon" aria-hidden="true"></span>';

    var input = el('input', 'palette-input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'jump to a link, tag or category';
    input.setAttribute('aria-label', 'search links');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', 'palette-list');
    field.appendChild(input);

    var list = el('ul', 'palette-list');
    list.id = 'palette-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'links');

    var foot = el('div', 'palette-foot');
    foot.innerHTML =
      '<span class="palette-group">' +
      '<button class="palette-key" type="button" data-palette="up" aria-label="previous link" title="previous link"><span class="palette-key-icon palette-key-up"></span></button>' +
      '<button class="palette-key" type="button" data-palette="down" aria-label="next link" title="next link"><span class="palette-key-icon palette-key-down"></span></button>' +
      '<span class="palette-label">move</span>' +
      '</span>' +
      '<span class="palette-group">' +
      '<button class="palette-key" type="button" data-palette="enter" aria-label="open selected link" title="open selected link"><span class="palette-key-icon palette-key-enter"></span></button>' +
      '<span class="palette-label">open</span>' +
      '</span>' +
      '<span class="palette-group">' +
      '<button class="palette-key" type="button" data-palette="escape" aria-label="close palette" title="close palette"><span class="palette-key-icon palette-key-escape"></span></button>' +
      '<span class="palette-label">close</span>' +
      '</span>';

    panel.appendChild(field);
    panel.appendChild(list);
    panel.appendChild(foot);
    root.appendChild(panel);
    document.body.appendChild(root);

    els.root = root;
    els.input = input;
    els.list = list;

    input.addEventListener('input', function () {
      render(input.value);
    });

    root.addEventListener('click', function (e) {
      if (e.target === root) close();
    });

    foot.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-palette]') : null;
      if (!btn) return;
      var action = btn.getAttribute('data-palette');
      if (action === 'up') move(-1);
      else if (action === 'down') move(1);
      else if (action === 'enter') openActive();
      else if (action === 'escape') close();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        move(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        move(-1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActive(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActive(hits.length - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        openActive();
      } else if (e.key === 'Tab') {
        e.preventDefault();
      }
    });
  }

  function render(query) {
    hits = filter(query);
    active = 0;
    els.list.innerHTML = '';

    if (!hits.length) {
      var empty = el('li', 'palette-empty', 'nothing matches that.');
      els.list.appendChild(empty);
      els.input.removeAttribute('aria-activedescendant');
      return;
    }

    for (var i = 0; i < hits.length; i++) {
      var link = hits[i].link;
      var row = el('li', 'palette-item');
      row.id = 'palette-hit-' + i;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      row.dataset.index = String(i);

      row.appendChild(el('span', 'palette-title', link.title));

      var tags = [];
      for (var t = 0; t < link.tags.length && tags.length < 2; t++) {
        if (link.tags[t] !== link.category) tags.push(link.tags[t]);
      }
      var meta = link.category;
      if (tags.length) meta += ' / ' + tags.join(', ');
      row.appendChild(el('span', 'palette-meta', meta));

      row.addEventListener('mouseenter', function () {
        setActive(Number(this.dataset.index));
      });
      row.addEventListener('click', function () {
        openIndex(Number(this.dataset.index));
      });

      els.list.appendChild(row);
    }

    els.input.setAttribute('aria-activedescendant', 'palette-hit-0');
    els.list.scrollTop = 0;
  }

  function setActive(index) {
    if (!hits.length) return;
    active = Math.max(0, Math.min(index, hits.length - 1));
    var rows = els.list.querySelectorAll('.palette-item');
    for (var i = 0; i < rows.length; i++) {
      rows[i].setAttribute('aria-selected', i === active ? 'true' : 'false');
    }
    var current = rows[active];
    if (current) {
      els.input.setAttribute('aria-activedescendant', current.id);
      current.scrollIntoView({ block: 'nearest' });
    }
  }

  function move(step) {
    if (!hits.length) return;
    var next = active + step;
    if (next < 0) next = hits.length - 1;
    if (next >= hits.length) next = 0;
    setActive(next);
  }

  function openIndex(index) {
    var hit = hits[index];
    if (!hit) return;
    window.open(hit.link.url, '_blank', 'noopener');
    close();
  }

  function openActive() {
    openIndex(active);
  }

  function open() {
    build();
    previousFocus = document.activeElement;
    els.root.hidden = false;
    document.body.classList.add('is-palette');
    els.input.setAttribute('aria-expanded', 'true');
    els.input.value = '';
    render('');
    els.input.focus();
  }

  function close() {
    if (!built || els.root.hidden) return;
    els.root.hidden = true;
    document.body.classList.remove('is-palette');
    els.input.setAttribute('aria-expanded', 'false');
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  }

  function toggle() {
    if (!built) build();
    if (els.root.hidden) open();
    else close();
  }

  document.addEventListener('keydown', function (e) {
    var key = e.key || '';
    if ((e.metaKey || e.ctrlKey) && key.toLowerCase() === 'k') {
      e.preventDefault();
      toggle();
      return;
    }
    if (key === 'Escape' && built && !els.root.hidden) {
      e.preventDefault();
      close();
    }
  });

  if (hint) {
    hint.addEventListener('click', function (e) {
      e.preventDefault();
      toggle();
    });
  }
})();
