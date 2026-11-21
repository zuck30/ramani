/* ============================================================
   ask ramani - a small chat panel over the 388 links.
   vanilla js, no dependencies, progressive enhancement: it only
   builds itself when the page declares a chat endpoint.
   ============================================================ */
(function () {
  'use strict';

  var endpointMeta = document.querySelector('meta[name="ramani-chat-endpoint"]');
  var keyMeta = document.querySelector('meta[name="ramani-chat-key"]');
  if (!endpointMeta) return;

  var ENDPOINT = (endpointMeta.getAttribute('content') || '').trim();
  var KEY = keyMeta ? (keyMeta.getAttribute('content') || '').trim() : '';
  if (!ENDPOINT) return;

  var STOP = {
    a: 1, an: 1, the: 1, and: 1, or: 1, of: 1, in: 1, on: 1, to: 1, for: 1,
    with: 1, is: 1, are: 1, was: 1, be: 1, it: 1, this: 1, that: 1, some: 1,
    any: 1, me: 1, my: 1, i: 1, you: 1, show: 1, find: 1, give: 1, want: 1,
    need: 1, looking: 1, look: 1, site: 1, sites: 1, website: 1, websites: 1,
    something: 1, good: 1, best: 1, nice: 1, like: 1, can: 1, do: 1, how: 1,
    what: 1, which: 1, please: 1, help: 1, there: 1, here: 1
  };

  var MAX_CANDIDATES = 12;
  var MAX_HISTORY = 6;

  // questions about ramani itself, not about links to look at
  var GUIDE = /submit|contribute|contribution|licen[cs]e|readme|github|\bemail\b|contact|who made|how (is|was) (it|this|ramani) (built|made)|source code|tags page|what is ramani|about ramani|how does ramani/i;

  var links = null;
  var history = [];
  var busy = false;
  var built = false;
  var els = {};

  /* ---------- data ---------- */

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

  function tokenize(text) {
    var parts = String(text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i];
      if (w.length < 2 || STOP[w]) continue;
      out.push(w);
    }
    return out;
  }

  function scoreLink(link, tokens, phrase) {
    var score = 0;
    var tags = link.tags.join(' ').toLowerCase();
    var title = link.title.toLowerCase();
    var why = link.why.toLowerCase();
    var category = link.category.toLowerCase().replace(/-/g, ' ');

    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      for (var j = 0; j < link.tags.length; j++) {
        var tag = link.tags[j].toLowerCase();
        if (tag === t) score += 8;
        else if (tag.indexOf(t) === 0) score += 4;
      }
      if (title.indexOf(t) !== -1) score += 4;
      if (category.indexOf(t) !== -1) score += 5;
      if (tags.indexOf(t) !== -1) score += 1;
      if (why.indexOf(t) !== -1) score += 1;
    }

    if (phrase && phrase.length > 3) {
      if (title.indexOf(phrase) !== -1) score += 6;
      if (category.indexOf(phrase) !== -1) score += 6;
      if (why.indexOf(phrase) !== -1) score += 2;
    }
    return score;
  }

  function pick(question) {
    if (GUIDE.test(question)) return [];
    if (!links) links = readLinks();
    var tokens = tokenize(question);
    var phrase = tokens.join(' ');
    var ranked = links.map(function (link) {
      return { link: link, score: scoreLink(link, tokens, phrase) };
    });
    ranked.sort(function (a, b) { return b.score - a.score; });

    var out = [];
    for (var i = 0; i < ranked.length && out.length < MAX_CANDIDATES; i++) {
      if (ranked[i].score <= 0) break;
      out.push(ranked[i].link);
    }
    return out;
  }

  /* ---------- dom ---------- */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function build() {
    if (built) return;
    built = true;

    var root = el('div', 'ask');

    var trigger = el('button', 'ask-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'ask-panel');
    trigger.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M3 4.5l4 3.5-4 3.5M9 11.5h4" stroke="currentColor" stroke-width="1.3" ' +
      'stroke-linecap="square" stroke-linejoin="miter"></path></svg><span>ask</span>';

    var panel = el('div', 'ask-panel');
    panel.id = 'ask-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'ask ramani');
    panel.hidden = true;

    var head = el('div', 'ask-head');
    var titleWrap = el('div', 'ask-head-title');
    titleWrap.appendChild(el('span', 'ask-name', 'ask ramani'));
    titleWrap.appendChild(el('span', 'ask-sub', 'a guide to the 388 links'));
    var close = el('button', 'ask-close', 'close');
    close.type = 'button';
    head.appendChild(titleWrap);
    head.appendChild(close);

    var log = el('div', 'ask-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-relevant', 'additions');

    var intro = el('div', 'ask-intro');
    intro.appendChild(el('p', 'ask-bleed',
      'ask for a kind of site and i will pull it off the map. tags, categories, or a plain sentence all work.'));
    var prompts = el('div', 'ask-prompts');
    ['dark fintech dashboards', 'best portfolios', 'sites from tanzania', 'how do i submit a link']
      .forEach(function (q) {
        var chip = el('button', 'ask-prompt', q);
        chip.type = 'button';
        chip.addEventListener('click', function () { send(q); });
        prompts.appendChild(chip);
      });
    intro.appendChild(prompts);
    log.appendChild(intro);

    var form = el('form', 'ask-form');
    var input = el('input', 'ask-input');
    input.type = 'text';
    input.name = 'q';
    input.placeholder = 'ask about a link...';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'your question');
    var submit = el('button', 'ask-send');
    submit.type = 'submit';
    submit.setAttribute('aria-label', 'send');
    submit.innerHTML = '<span class="ask-arrow" aria-hidden="true"></span>';
    form.appendChild(input);
    form.appendChild(submit);

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(form);
    root.appendChild(panel);
    root.appendChild(trigger);
    document.body.appendChild(root);

    els.root = root;
    els.trigger = trigger;
    els.panel = panel;
    els.log = log;
    els.input = input;
    els.close = close;
    els.submit = submit;
    els.intro = intro;

    trigger.addEventListener('click', function () {
      if (panel.hidden) open(); else closePanel();
    });
    close.addEventListener('click', closePanel);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      send(input.value);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) closePanel();
    });
  }

  function open() {
    build();
    els.panel.hidden = false;
    els.root.classList.add('is-open');
    els.trigger.setAttribute('aria-expanded', 'true');
    els.input.focus();
    scrollLog();
  }

  function closePanel() {
    if (!built) return;
    els.panel.hidden = true;
    els.root.classList.remove('is-open');
    els.trigger.setAttribute('aria-expanded', 'false');
    els.trigger.focus();
  }

  function scrollLog() {
    if (!built) return;
    els.log.scrollTop = els.log.scrollHeight;
  }

  /* ---------- messages ---------- */

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function linkify(text) {
    var safe = escapeHtml(text);
    return safe.replace(/https?:\/\/[^\s<]+/g, function (raw) {
      var trail = '';
      var url = raw;
      while (url.length && /[.,;:!?)\]]$/.test(url)) {
        trail = url.slice(-1) + trail;
        url = url.slice(0, -1);
      }
      if (!url) return raw;
      return '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>' + trail;
    });
  }

  function addMessage(role, text) {
    var node = el('div', 'ask-msg is-' + role);
    if (role === 'user') {
      node.textContent = text;
    } else {
      node.innerHTML = linkify(text);
    }
    els.log.appendChild(node);
    scrollLog();
    return node;
  }

  function addTyping() {
    var node = el('div', 'ask-typing');
    node.innerHTML = '<span></span><span></span><span></span>';
    els.log.appendChild(node);
    scrollLog();
    return node;
  }

  function send(question) {
    var text = String(question || '').trim();
    if (!text || busy) return;
    build();
    if (els.panel.hidden) open();

    busy = true;
    els.input.value = '';
    els.submit.disabled = true;
    if (els.intro && els.intro.parentNode) els.intro.parentNode.removeChild(els.intro);

    addMessage('user', text);
    var typing = addTyping();

    var candidates = pick(text);

    fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + KEY
      },
      body: JSON.stringify({
        question: text,
        history: history.slice(-MAX_HISTORY),
        links: candidates
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, status: res.status, body: body };
        });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.body.error || 'request failed');
        var answer = String(result.body.text || '').trim();
        if (!answer) throw new Error('empty answer');
        if (typing.parentNode) typing.parentNode.removeChild(typing);
        addMessage('model', answer);
        history.push({ role: 'user', content: text });
        history.push({ role: 'assistant', content: answer });
      })
      .catch(function (err) {
        if (typing.parentNode) typing.parentNode.removeChild(typing);
        addMessage('model', 'the guide is not reachable right now. ' +
          'try the tags page, or email mwalyangashadrack@gmail.com.');
        if (window.console) console.warn('ramani chat:', err && err.message);
      })
      .then(function () {
        busy = false;
        els.submit.disabled = false;
        els.input.focus();
      });
  }

  /* ---------- boot ---------- */

  function boot() {
    build();
    els.trigger.classList.add('is-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
