/* ============================================================
   kambarage - a small chat panel over the link directory.
   vanilla js, no dependencies, progressive enhancement: it only
   builds itself when the page declares a chat endpoint.
   the frame and empty state follow bruno in antera.
   ============================================================ */
(function () {
  'use strict';

  var endpointMeta = document.querySelector('meta[name="ramani-chat-endpoint"]');
  var keyMeta = document.querySelector('meta[name="ramani-chat-key"]');
  var avatarMeta = document.querySelector('meta[name="ramani-chat-avatar"]');
  if (!endpointMeta) return;

  var ENDPOINT = (endpointMeta.getAttribute('content') || '').trim();
  var KEY = keyMeta ? (keyMeta.getAttribute('content') || '').trim() : '';
  var AVATAR = avatarMeta ? (avatarMeta.getAttribute('content') || '').trim() : '';
  if (!ENDPOINT) return;

  var STOP = {
    a: 1, an: 1, the: 1, and: 1, or: 1, of: 1, in: 1, on: 1, to: 1, for: 1,
    with: 1, is: 1, are: 1, was: 1, be: 1, it: 1, this: 1, that: 1, some: 1,
    any: 1, me: 1, my: 1, i: 1, you: 1, your: 1, show: 1, find: 1, give: 1,
    want: 1, need: 1, looking: 1, look: 1, site: 1, sites: 1, website: 1,
    websites: 1, something: 1, good: 1, best: 1, nice: 1, like: 1, can: 1,
    do: 1, how: 1, what: 1, which: 1, please: 1, help: 1, there: 1, here: 1
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

  function getLinks() {
    if (!links) links = readLinks();
    return links;
  }

  function counts(all) {
    var tags = {}, cats = {};
    for (var i = 0; i < all.length; i++) {
      for (var j = 0; j < all[i].tags.length; j++) tags[all[i].tags[j]] = 1;
      if (all[i].category) cats[all[i].category] = 1;
    }
    return {
      links: all.length,
      tags: Object.keys(tags).length,
      categories: Object.keys(cats).length
    };
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
    var all = getLinks();
    var tokens = tokenize(question);
    var phrase = tokens.join(' ');
    var ranked = all.map(function (link) {
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

  function avatar(size) {
    var wrap = el('span', 'ask-avatar');
    wrap.style.setProperty('--s', size + 'px');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.appendChild(el('span', 'ask-ring'));
    var disc = el('span', 'ask-disc');
    disc.appendChild(el('span', 'ask-face'));
    wrap.appendChild(disc);
    return wrap;
  }

  function personAvatar(size) {
    var wrap = el('span', 'ask-avatar is-person');
    wrap.style.setProperty('--s', size + 'px');
    wrap.setAttribute('aria-hidden', 'true');
    var disc = el('span', 'ask-disc');
    disc.innerHTML =
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<circle cx="12" cy="8" r="4"></circle>' +
      '<path d="M4 21c0-3.6 3.6-6 8-6s8 2.4 8 6z"></path></svg>';
    wrap.appendChild(disc);
    return wrap;
  }

  function clock() {
    try {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function build() {
    if (built) return;
    built = true;

    var root = el('div', 'ask');
    var all = getLinks();
    els.stats = counts(all);

    /* launcher */
    var trigger = el('button', 'ask-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'ask-panel');
    trigger.setAttribute('aria-label', 'chat with kambarage');
    var face = document.createElement('img');
    face.alt = '';
    face.setAttribute('aria-hidden', 'true');
    if (AVATAR) face.src = AVATAR;
    trigger.appendChild(face);

    /* panel */
    var panel = el('div', 'ask-panel');
    panel.id = 'ask-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'chat with kambarage');
    panel.hidden = true;

    panel.appendChild(el('div', 'ask-grab'));

    var close = el('button', 'ask-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'close chat');
    close.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    panel.appendChild(close);

    var log = el('div', 'ask-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-relevant', 'additions');

    /* empty state, straight from bruno */
    var empty = el('div', 'ask-empty');
    empty.appendChild(avatar(64));
    empty.appendChild(el('p', 'ask-hello', "hello, i'm kambarage."));
    empty.appendChild(el('p', 'ask-hello-sub',
      "i'm the guide to ramani. i know the " + els.stats.links +
      " links on the map. ask me for a kind of site, or anything about the project."));
    empty.appendChild(el('div', 'ask-today', 'today'));

    var greet = el('div', 'ask-greet');
    greet.appendChild(avatar(28));
    greet.appendChild(el('p', null, 'karibu. what are you looking for today?'));
    empty.appendChild(greet);

    var prompts = el('div', 'ask-prompts');
    [
      'fintech sites',
      'best portfolios',
      'sites from tanzania',
      'how do i submit a link'
    ].forEach(function (label) {
      var wrap = el('div', 'ask-prompt');
      var chip = el('button', null, label);
      chip.type = 'button';
      chip.addEventListener('click', function () { send(label); });
      wrap.appendChild(chip);
      prompts.appendChild(wrap);
    });
    empty.appendChild(prompts);
    log.appendChild(empty);

    /* compose */
    var compose = el('div', 'ask-compose');
    var form = el('form', 'ask-field');

    var mic = el('button', 'ask-mic');
    mic.type = 'button';
    mic.setAttribute('aria-label', 'voice input');
    mic.tabIndex = -1;
    mic.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" ' +
      'stroke="currentColor" stroke-width="1.6"></path>' +
      '<path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round"></path></svg>';

    var input = el('input', 'ask-input');
    input.type = 'text';
    input.name = 'q';
    input.placeholder = 'ask kambarage...';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'your question');

    var submit = el('button', 'ask-send');
    submit.type = 'submit';
    submit.setAttribute('aria-label', 'send');
    submit.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M22 2 11 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>' +
      '<path d="M22 2 15 22l-4-9-9-4z" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linejoin="round"></path></svg>';

    form.appendChild(mic);
    form.appendChild(input);
    form.appendChild(submit);

    compose.appendChild(form);
    compose.appendChild(el('div', 'ask-homebar'));

    panel.appendChild(log);
    panel.appendChild(compose);

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
    els.empty = empty;

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
    var row = el('div', 'ask-msg is-' + role);
    var col = el('div', 'ask-col');
    var bubble = el('div', 'ask-bubble is-' + role);
    var stamp = el('span', 'ask-time', clock());

    if (role === 'user') bubble.textContent = text;
    col.appendChild(bubble);
    col.appendChild(stamp);

    if (role === 'user') {
      row.appendChild(col);
      row.appendChild(personAvatar(28));
    } else {
      row.appendChild(avatar(28));
      row.appendChild(col);
    }

    els.log.appendChild(row);
    scrollLog();
    return { row: row, bubble: bubble };
  }

  function addTyping() {
    var row = el('div', 'ask-msg is-model');
    row.appendChild(avatar(28));
    var dots = el('div', 'ask-typing');
    dots.innerHTML = '<span></span><span></span><span></span>';
    row.appendChild(dots);
    els.log.appendChild(row);
    scrollLog();
    return row;
  }

  // bruno fakes streaming. do the same, but instant when motion is reduced.
  function reveal(node, text, done) {
    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      node.innerHTML = linkify(text);
      scrollLog();
      done();
      return;
    }

    var parts = text.split(/(\s+)/);
    var shown = '';
    var i = 0;
    node.textContent = '';
    var cursor = el('span', 'ask-cursor', '|');
    node.appendChild(cursor);

    var timer = window.setInterval(function () {
      if (i >= parts.length) {
        window.clearInterval(timer);
        if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
        node.innerHTML = linkify(text);
        scrollLog();
        done();
        return;
      }
      shown += parts[i++];
      node.textContent = shown;
      node.appendChild(cursor);
      scrollLog();
    }, 18);
  }

  function send(question) {
    var text = String(question || '').trim();
    if (!text || busy) return;
    build();
    if (els.panel.hidden) open();

    busy = true;
    els.input.value = '';
    els.submit.disabled = true;
    if (els.empty && els.empty.parentNode) els.empty.parentNode.removeChild(els.empty);
    els.empty = null;

    addMessage('user', text);
    var typing = addTyping();

    var candidates = pick(text);
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      busy = false;
      els.submit.disabled = false;
      if (els.input) els.input.focus();
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + KEY
      },
      body: JSON.stringify({
        question: text,
        history: history.slice(-MAX_HISTORY),
        links: candidates,
        stats: els.stats
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, status: res.status, body: body };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          var failure = new Error(result.body.error || 'request failed');
          failure.userFacing = true;
          throw failure;
        }
        var answer = String(result.body.text || '').trim();
        if (!answer) throw new Error('empty answer');
        if (typing.parentNode) typing.parentNode.removeChild(typing);
        history.push({ role: 'user', content: text });
        history.push({ role: 'assistant', content: answer });
        var message = addMessage('model', '');
        reveal(message.bubble, answer, finish);
      })
      .catch(function (err) {
        if (typing.parentNode) typing.parentNode.removeChild(typing);
        var message = err && err.userFacing
          ? String(err.message)
          : 'kambarage is not reachable right now. try the tags page, or email mwalyangashadrack@gmail.com.';
        addMessage('model', message);
        if (window.console) console.warn('kambarage:', err && err.message);
        finish();
      });
  }

  /* ---------- boot ---------- */

  function boot() {
    build();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
