/* AgentTrust super-navigation — injected into all agentrust-io.com properties */
(function () {
  'use strict';

  var SITES = [
    { id: 'home',     label: 'agentrust-io',  url: 'https://agentrust-io.com',                                   dot: '#B91C1C', ext: false },
    { id: 'trace',    label: 'TRACE',          url: 'https://trace.agentrust-io.com',                             dot: '#1B5EA0', ext: false },
    { id: 'manifest', label: 'Manifest',       url: 'https://manifest.agentrust-io.com',                          dot: '#1B7A4A', ext: false },
    { id: 'cmcp',     label: 'cMCP',           url: 'https://cmcp.agentrust-io.com',                              dot: '#6D28D9', ext: false },
    { id: 'agt',      label: 'AGT',            url: 'https://github.com/microsoft/agent-governance-toolkit',     dot: '#6B7F94', ext: true  },
    { id: 'github',   label: 'GitHub',         url: 'https://github.com/agentrust-io',                           dot: '#8B949E', ext: true  }
  ];

  var HOST = location.hostname;
  var CURRENT_ID = HOST === 'agentrust-io.com' ? 'home'
    : HOST.indexOf('trace.') === 0    ? 'trace'
    : HOST.indexOf('manifest.') === 0 ? 'manifest'
    : HOST.indexOf('cmcp.') === 0     ? 'cmcp'
    : HOST.indexOf('tests.') === 0    ? 'trace'
    : 'home';

  var NAV_ID = 'agt-supernav';
  var STYLE_ID = 'agt-supernav-style';

  var CSS = [
    '#' + NAV_ID + '{',
    '  background:#15294B;',
    '  border-bottom:2px solid #B91C1C;',
    '  height:36px;',
    '  display:flex;',
    '  align-items:center;',
    '  padding:0 12px;',
    '  overflow-x:auto;',
    '  overflow-y:hidden;',
    '  white-space:nowrap;',
    '  position:relative;',
    '  z-index:10000;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;',
    '  font-size:11.5px;',
    '  gap:0;',
    '  scrollbar-width:none;',
    '}',
    '#' + NAV_ID + '::-webkit-scrollbar{display:none}',
    '#' + NAV_ID + ' a{',
    '  display:inline-flex;',
    '  align-items:center;',
    '  gap:5px;',
    '  padding:0 11px;',
    '  height:36px;',
    '  color:rgba(255,255,255,0.58);',
    '  text-decoration:none;',
    '  font-weight:400;',
    '  letter-spacing:0.01em;',
    '  border-bottom:2px solid transparent;',
    '  transition:color .12s,border-color .12s;',
    '  flex-shrink:0;',
    '}',
    '#' + NAV_ID + ' a:hover{color:#fff}',
    '#' + NAV_ID + ' a.active{color:#fff;font-weight:600;border-bottom-color:#B91C1C}',
    '#' + NAV_ID + ' .dot{',
    '  width:6px;height:6px;border-radius:50%;flex-shrink:0;display:inline-block;',
    '}',
    '#' + NAV_ID + ' .sep{',
    '  width:1px;height:16px;background:rgba(255,255,255,0.1);flex-shrink:0;',
    '}',
    '#' + NAV_ID + ' .ext-icon{',
    '  opacity:.45;font-size:9px;line-height:1;',
    '}'
  ].join('\n');

  function buildNav() {
    var div = document.createElement('div');
    div.id = NAV_ID;

    var html = '';
    SITES.forEach(function (s, i) {
      if (i === SITES.length - 2) {
        html += '<span class="sep"></span>';
      }
      var active = s.id === CURRENT_ID ? ' class="active"' : '';
      var target = s.ext ? ' target="_blank" rel="noopener noreferrer"' : '';
      var extIcon = s.ext ? '<span class="ext-icon">&#8599;</span>' : '';
      html += '<a href="' + s.url + '"' + active + target + '>'
            + '<span class="dot" style="background:' + s.dot + '"></span>'
            + s.label
            + extIcon
            + '</a>';
    });

    div.innerHTML = html;
    return div;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function injectNav() {
    if (document.getElementById(NAV_ID)) return;
    injectStyles();
    var nav = buildNav();
    // Insert at very top of body, before everything
    document.body.insertBefore(nav, document.body.firstChild);
  }

  // Initial injection
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNav);
  } else {
    injectNav();
  }

  // Material for MkDocs instant navigation — document$ fires on every page swap
  // Guard: only subscribe if the observable exists (it's set synchronously in Material's bundle)
  function subscribeMaterial() {
    if (typeof window.document$ !== 'undefined' && typeof window.document$.subscribe === 'function') {
      window.document$.subscribe(function () {
        // After a content swap the nav div is still in DOM (header/body persists),
        // but guard in case Material ever removes it.
        if (!document.getElementById(NAV_ID)) {
          injectNav();
        }
      });
    }
  }

  // document$ may not be defined yet when this script runs; defer to after DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', subscribeMaterial);
  } else {
    subscribeMaterial();
  }

})();
