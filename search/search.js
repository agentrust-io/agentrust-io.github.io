/* Search across every AgenTrust site, for agentrust-io.com/search/.
 *
 * When the page loads it fetches each MkDocs site's own search_index.json (all
 * seven send Access-Control-Allow-Origin: *) and the hub pages listed in
 * sitemap.xml, then matches in the browser. There is no build step and no
 * third-party service, so results are as fresh as each site's deployed index.
 *
 * Source text is only ever written with textContent and text nodes; matches are
 * wrapped in <mark> elements built here, never parsed from the source.
 */
(function () {
  'use strict';

  var SOURCES = [
    { id: 'wcm', label: 'WCM', base: 'https://wcm.agentrust-io.com/' },
    { id: 'manifest', label: 'Manifest', base: 'https://manifest.agentrust-io.com/' },
    { id: 'cmcp', label: 'cMCP', base: 'https://cmcp.agentrust-io.com/' },
    { id: 'ca2a', label: 'cA2A', base: 'https://ca2a.agentrust-io.com/' },
    { id: 'trace', label: 'TRACE', base: 'https://trace.agentrust-io.com/' },
    { id: 'tests', label: 'Tests', base: 'https://tests.agentrust-io.com/' },
    { id: 'governance', label: 'Governance', base: 'https://governance.agentrust-io.com/' }
  ];
  var HUB = { id: 'hub', label: 'AgenTrust hub' };
  var LIMIT = 50;     // results shown
  var PER_PAGE = 2;   // hits kept from one page, so one long page cannot fill the list
  var SNIPPET = 180;  // characters of context around the first match

  var ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

  function stripHtml(html) {
    return String(html || '')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, function (match, name) {
        var key = name.toLowerCase();
        if (ENTITIES[key]) return ENTITIES[key];
        if (key[0] !== '#') return match;
        var code = key[1] === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(query) {
    var seen = {};
    return (String(query || '').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_.-]*/gu) || [])
      .map(function (term) { return term.replace(/[._-]+$/, ''); })
      .filter(function (term) { return term && !seen[term] && (seen[term] = true); });
  }

  function buildUrl(base, location) {
    return new URL(location || '', base).href;
  }

  function makeDoc(source, url, page, title, pageTitle, text, isPage) {
    title = title || pageTitle;
    return {
      site: source.id, label: source.label, url: url, page: source.id + ':' + page,
      title: title, pageTitle: pageTitle, text: text, isPage: isPage,
      head: (title + ' ' + pageTitle).toLowerCase(), body: text.toLowerCase()
    };
  }

  // MkDocs writes one entry per page (location "page/") and one per heading
  // ("page/#section"), with HTML in both title and text.
  function fromMkDocs(source, index) {
    var entries = (index && index.docs) || [];
    var pageTitles = {};
    entries.forEach(function (entry) {
      if (entry.location.indexOf('#') < 0) pageTitles[entry.location] = stripHtml(entry.title);
    });
    return entries.map(function (entry) {
      var page = entry.location.split('#')[0];
      var isPage = entry.location.indexOf('#') < 0;
      return makeDoc(source, buildUrl(source.base, entry.location), page, stripHtml(entry.title),
        pageTitles[page] || '', stripHtml(entry.text), isPage);
    }).filter(function (doc) { return doc.title || doc.text; });
  }

  function occurrences(text, term) {
    var n = 0, at = text.indexOf(term);
    while (at >= 0 && n < 3) { n++; at = text.indexOf(term, at + term.length); }
    return n;
  }

  // Every term must appear. A term in the title or page title is worth 10, each
  // of up to three in the text 1, the whole query as a phrase 15 in a title or 5
  // in the text, and a page-level entry 3 over one of its own sections.
  function score(doc, terms, phrase) {
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var inHead = doc.head.indexOf(terms[i]) >= 0;
      var inBody = doc.body.indexOf(terms[i]) >= 0;
      if (!inHead && !inBody) return 0;
      if (inHead) total += 10;
      if (inBody) total += occurrences(doc.body, terms[i]);
    }
    if (terms.length > 1 && phrase) {
      if (doc.head.indexOf(phrase) >= 0) total += 15;
      else if (doc.body.indexOf(phrase) >= 0) total += 5;
    }
    return total + (doc.isPage ? 3 : 0);
  }

  function search(docs, query, site) {
    var terms = tokenize(query);
    if (!terms.length) return [];
    var phrase = String(query).toLowerCase().replace(/\s+/g, ' ').trim();
    var hits = [];
    docs.forEach(function (doc) {
      if (site && site !== 'all' && doc.site !== site) return;
      var points = score(doc, terms, phrase);
      if (points > 0) hits.push({ doc: doc, score: points });
    });
    hits.sort(function (a, b) {
      return b.score - a.score || (b.doc.isPage - a.doc.isPage) || a.doc.title.localeCompare(b.doc.title);
    });
    var perPage = {}, results = [];
    for (var i = 0; i < hits.length && results.length < LIMIT; i++) {
      var key = hits[i].doc.page;
      perPage[key] = (perPage[key] || 0) + 1;
      if (perPage[key] <= PER_PAGE) results.push(hits[i]);
    }
    return results;
  }

  function snippet(text, terms) {
    var lower = text.toLowerCase(), first = -1;
    terms.forEach(function (term) {
      var at = lower.indexOf(term);
      if (at >= 0 && (first < 0 || at < first)) first = at;
    });
    var start = Math.max(0, first - 60);
    return (start > 0 ? '…' : '') + text.slice(start, start + SNIPPET) + (start + SNIPPET < text.length ? '…' : '');
  }

  function highlight(text, terms) {
    var lower = text.toLowerCase(), parts = [], i = 0;
    while (i < text.length) {
      var next = -1, length = 0;
      terms.forEach(function (term) {
        var at = lower.indexOf(term, i);
        if (at >= 0 && (next < 0 || at < next || (at === next && term.length > length))) { next = at; length = term.length; }
      });
      if (next < 0) { parts.push({ text: text.slice(i), mark: false }); break; }
      if (next > i) parts.push({ text: text.slice(i, next), mark: false });
      parts.push({ text: text.slice(next, next + length), mark: true });
      i = next + length;
    }
    return parts;
  }

  function appendParts(document, element, parts) {
    parts.forEach(function (part) {
      if (!part.mark) { element.append(document.createTextNode(part.text)); return; }
      var mark = document.createElement('mark');
      mark.textContent = part.text;
      element.append(mark);
    });
  }

  function renderResult(document, hit, terms) {
    var doc = hit.doc;
    var item = document.createElement('li');
    item.className = 'search-hit';
    var site = document.createElement('span');
    site.className = 'search-site';
    site.textContent = doc.label;
    var link = document.createElement('a');
    link.className = 'search-title';
    link.href = doc.url;
    appendParts(document, link, highlight(doc.isPage || !doc.pageTitle || doc.pageTitle === doc.title
      ? doc.title : doc.pageTitle + ' › ' + doc.title, terms));
    var text = document.createElement('p');
    text.className = 'search-snippet';
    appendParts(document, text, highlight(snippet(doc.text, terms), terms));
    var url = document.createElement('span');
    url.className = 'search-url';
    url.textContent = doc.url;
    item.append(site, link, text, url);
    return item;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SOURCES: SOURCES, stripHtml: stripHtml, tokenize: tokenize, buildUrl: buildUrl, fromMkDocs: fromMkDocs,
      score: score, search: search, snippet: snippet, highlight: highlight, renderResult: renderResult, LIMIT: LIMIT, PER_PAGE: PER_PAGE };
    return;
  }

  var root = document.getElementById('site-search');
  if (!root) return;
  var input = document.getElementById('search-q');
  var list = document.getElementById('search-results');
  var count = document.getElementById('search-count');
  var status = document.getElementById('search-status');
  var empty = document.getElementById('search-empty');
  var chips = Array.prototype.slice.call(root.querySelectorAll('[data-site]'));
  var ids = ['all', HUB.id].concat(SOURCES.map(function (s) { return s.id; }));
  var params = new URLSearchParams(location.search);
  var state = { q: params.get('q') || '', site: ids.indexOf(params.get('site')) >= 0 ? params.get('site') : 'all' };
  var docs = [], done = 0, failed = [], total = SOURCES.length + 1, timer;

  function cached(key, load) {
    try { var hit = sessionStorage.getItem(key); if (hit) return Promise.resolve(hit); } catch (e) { /* storage blocked */ }
    return load().then(function (text) {
      try { if (text.length < 1500000) sessionStorage.setItem(key, text); } catch (e) { /* quota or blocked */ }
      return text;
    });
  }

  function fetchText(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
      return response.text();
    });
  }

  function hubDocs(path, html) {
    var page = new DOMParser().parseFromString(html, 'text/html');
    var clean = function (node) { return node ? stripHtml(node.textContent) : ''; };
    page.querySelectorAll('script, style, noscript, header, footer, nav').forEach(function (n) { n.remove(); });
    var title = clean(page.querySelector('title')).replace(/\s*\|\s*AgenTrust$/, '');
    var description = page.querySelector('meta[name="description"]');
    var main = page.querySelector('main') || page.body;
    var url = location.origin + path;
    var found = [makeDoc(HUB, url, path, title, title, ((description && description.content) || '') + ' ' + clean(main), true)];
    main.querySelectorAll('section[id]').forEach(function (section) {
      var heading = section.querySelector('h2');
      if (heading) found.push(makeDoc(HUB, url + '#' + section.id, path, clean(heading), title, clean(section), false));
    });
    return found;
  }

  function loadHub() {
    return fetchText('/sitemap.xml').then(function (xml) {
      var paths = (xml.match(/<loc>[^<]+<\/loc>/g) || []).map(function (loc) {
        return new URL(loc.replace(/<\/?loc>/g, '')).pathname;
      });
      return Promise.all(paths.map(function (path) {
        return fetchText(path).then(function (html) { return hubDocs(path, html); }, function () { return []; });
      }));
    }).then(function (pages) { return [].concat.apply([], pages); });
  }

  function loaded(label, promise) {
    return promise.then(function (found) { docs = docs.concat(found); }, function () { failed.push(label); })
      .then(function () { done++; showStatus(); run(); });
  }

  function showStatus() {
    var text = done < total ? 'Loading indexes: ' + done + ' of ' + total
      : 'Searching ' + docs.length + ' entries from ' + (total - failed.length) + ' of ' + total + ' sites';
    status.textContent = failed.length ? text + '. Could not load: ' + failed.join(', ') + '.' : text + '.';
  }

  function run() {
    state.q = input.value;
    var next = new URLSearchParams();
    if (state.q) next.set('q', state.q);
    if (state.site !== 'all') next.set('site', state.site);
    history.replaceState(null, '', location.pathname + (next.toString() ? '?' + next : ''));
    chips.forEach(function (chip) { chip.setAttribute('aria-pressed', String(chip.getAttribute('data-site') === state.site)); });
    var terms = tokenize(state.q);
    var hits = search(docs, state.q, state.site);
    list.replaceChildren.apply(list, hits.map(function (hit) { return renderResult(document, hit, terms); }));
    count.textContent = !terms.length ? '' : (hits.length === LIMIT ? 'First ' + LIMIT : hits.length) + (hits.length === 1 ? ' result' : ' results')
      + (done < total ? ' so far' : '');
    empty.hidden = !(terms.length && !hits.length && done === total);
  }

  function links() { return Array.prototype.slice.call(list.querySelectorAll('a.search-title')); }

  input.value = state.q;
  input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 120); });
  input.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown' && links().length) { event.preventDefault(); links()[0].focus(); }
  });
  list.addEventListener('keydown', function (event) {
    var all = links(), at = all.indexOf(document.activeElement);
    if (at < 0 || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    event.preventDefault();
    if (event.key === 'ArrowUp' && at === 0) input.focus();
    else (all[at + (event.key === 'ArrowDown' ? 1 : -1)] || all[at]).focus();
  });
  root.querySelector('form').addEventListener('submit', function (event) { event.preventDefault(); clearTimeout(timer); run(); });
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () { state.site = chip.getAttribute('data-site'); run(); });
  });

  root.hidden = false;
  showStatus();
  run();
  SOURCES.forEach(function (source) {
    loaded(source.label, cached('agt-search:' + source.id, function () {
      return fetchText(source.base + 'search/search_index.json');
    }).then(function (text) { return fromMkDocs(source, JSON.parse(text)); }));
  });
  loaded(HUB.label, loadHub());
})();
