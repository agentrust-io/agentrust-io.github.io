/* AgenTrust super-navigation — injected into all agentrust-io.com properties
 *
 * Colours come from design-system.css custom properties, which every property
 * loads, so the bar follows the editorial theme (and the MkDocs light/dark
 * scheme) without carrying a palette of its own. The literals are fallbacks
 * for any page that somehow renders without the stylesheet.
 */
(function () {
  'use strict';

  var SITES = [
    { id: 'home',       label: 'agentrust-io', url: 'https://agentrust-io.com',                                ext: false },
    { id: 'quickstart', label: 'Quickstart',   url: 'https://agentrust-io.com/quickstart/',                    ext: false },
    { id: 'demos',      label: 'Demos',        url: 'https://agentrust-io.com/demos/',                         ext: false },
    { id: 'telemetry',  label: 'Telemetry',    url: 'https://agentrust-io.com/telemetry/',                     ext: false },
    { id: 'trace',      label: 'TRACE',        url: 'https://trace.agentrust-io.com',                          ext: false },
    { id: 'manifest',   label: 'Manifest',     url: 'https://manifest.agentrust-io.com',                       ext: false },
    { id: 'cmcp',       label: 'cMCP',         url: 'https://cmcp.agentrust-io.com',                           ext: false },
    { id: 'ca2a',       label: 'cA2A',         url: 'https://ca2a.agentrust-io.com',                           ext: false },
    { id: 'governance', label: 'Governance',   url: 'https://governance.agentrust-io.com',                     ext: false },
    { id: 'agt',        label: 'AGT',          url: 'https://github.com/microsoft/agent-governance-toolkit',   ext: true  },
    { id: 'github',     label: 'GitHub',       url: 'https://github.com/agentrust-io',                         ext: true  }
  ];

  var HOST = location.hostname;
  var PATH = location.pathname;
  // Quickstart, demos, and telemetry live under the apex host, so the active
  // item cannot be resolved from the hostname alone the way every other entry can.
  var CURRENT_ID = (HOST === 'agentrust-io.com' && PATH.indexOf('/quickstart') === 0) ? 'quickstart'
    : (HOST === 'agentrust-io.com' && PATH.indexOf('/demos') === 0) ? 'demos'
    : (HOST === 'agentrust-io.com' && PATH.indexOf('/telemetry') === 0) ? 'telemetry'
    : (HOST === 'agentrust-io.com' && PATH.indexOf('/extensions/ca2a') === 0) ? 'ca2a'
    : HOST === 'agentrust-io.com' ? 'home'
    : HOST.indexOf('trace.') === 0    ? 'trace'
    : HOST.indexOf('manifest.') === 0 ? 'manifest'
    : HOST.indexOf('cmcp.') === 0        ? 'cmcp'
    : HOST.indexOf('ca2a.') === 0        ? 'ca2a'
    : HOST.indexOf('governance.') === 0  ? 'governance'
    : HOST.indexOf('tests.') === 0       ? 'trace'
    : 'home';

  var NAV_ID = 'agt-supernav';
  var STYLE_ID = 'agt-supernav-style';

  var CSS = [
    '#' + NAV_ID + '{',
    '  background:var(--at-paper,#f3f0e8);',
    '  border-bottom:1px solid var(--at-line,rgba(23,23,20,.18));',
    '  height:34px;',
    '  display:flex;',
    '  align-items:stretch;',
    '  padding:0 clamp(.5rem,2vw,1.25rem);',
    '  overflow-x:auto;',
    '  overflow-y:hidden;',
    '  white-space:nowrap;',
    '  position:relative;',
    '  z-index:10000;',
    '  font-family:var(--at-sans,Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);',
    '  font-size:11px;',
    '  scrollbar-width:none;',
    '}',
    '#' + NAV_ID + '::-webkit-scrollbar{display:none}',
    '#' + NAV_ID + ' a{',
    '  display:inline-flex;',
    '  align-items:center;',
    '  padding:0 10px;',
    '  color:var(--at-muted,#66645d);',
    '  text-decoration:none;',
    '  font-weight:650;',
    '  letter-spacing:.07em;',
    '  text-transform:uppercase;',
    '  border-bottom:2px solid transparent;',
    '  transition:color .12s,border-color .12s;',
    '  flex-shrink:0;',
    '}',
    '#' + NAV_ID + ' a:hover{color:var(--at-ink,#171714)}',
    '#' + NAV_ID + ' a.active{',
    '  color:var(--at-ink,#171714);',
    '  font-weight:750;',
    '  border-bottom-color:var(--at-red,#b91c1c);',
    '}',
    '#' + NAV_ID + ' .sep{',
    '  width:1px;',
    '  margin:9px 8px;',
    '  background:var(--at-line,rgba(23,23,20,.18));',
    '  flex-shrink:0;',
    '}',
    '#' + NAV_ID + ' .ext-icon{',
    '  margin-left:4px;opacity:.5;font-size:9px;line-height:1;',
    '}',
    '@media (prefers-reduced-motion:reduce){',
    '  #' + NAV_ID + ' a{transition:none}',
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
