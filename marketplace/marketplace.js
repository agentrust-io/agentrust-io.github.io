(async function () {
  'use strict';
  function escape(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
  function safeUrl(value) { try { const parsed = new URL(String(value)); return parsed.protocol === 'https:' ? parsed.href : '#'; } catch (_) { return '#'; } }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { escape, safeUrl }; return; }
  const AGENTRUST_CATALOG = 'https://raw.githubusercontent.com/agentrust-io/integrations/main/marketplace/catalog.json';
  const AGT_CATALOG = 'https://raw.githubusercontent.com/agentrust-io/integrations/main/marketplace/agt-catalog.json';
  let items = [];
  const state = { query: '', stacks: new Set(), types: new Set(), sort: 'featured' };
  const search = document.getElementById('market-search'), grid = document.getElementById('market-grid'), empty = document.getElementById('market-empty'), status = document.getElementById('catalog-status');
  const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  async function fetchJson(url) { const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000); try { const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal }); if (!response.ok) throw new Error(`${url} returned ${response.status}`); return await response.json(); } finally { clearTimeout(timeout); } }
  function normalizeAgenTrust(catalog) {
    if (catalog.catalog_version !== 1 || !Array.isArray(catalog.integrations) || catalog.count !== catalog.integrations.length) throw new Error('unsupported AgenTrust catalog');
    return catalog.integrations.map((item) => ({ ...item, type: item.category, source: 'AgenTrust', sourceClass: 'community' }));
  }
  function normalizeAgt(catalog) {
    if (catalog.catalog_version !== 1 || !/^[0-9a-f]{40}$/.test(catalog.source_commit) || !Array.isArray(catalog.integrations) || catalog.count !== catalog.integrations.length) throw new Error('unsupported AGT catalog');
    return catalog.integrations.map((item) => ({ ...item, type: item.category, source: 'AGT', sourceClass: 'project' }));
  }
  function card(item, compact) {
    const tags = item.stack.map((tag) => `<span>${escape(tag)}</span>`).join('');
    const tier = item.source === 'AGT' ? 'AGT project' : `${item.tier[0].toUpperCase()}${item.tier.slice(1)}`;
    return `<article class="market-card${compact ? ' market-card-featured' : ''}"><div class="market-card-top"><span class="market-mark mark-${slug(item.type)}">${escape(item.mark)}</span><span class="market-tier tier-${item.sourceClass}"><i></i> ${escape(tier)}</span></div><div><p class="market-vendor">By ${escape(item.vendor)}</p><h3>${escape(item.name)}</h3><p class="market-description">${escape(item.description)}</p></div><div class="market-card-foot"><div class="market-tags">${tags}</div><a href="${escape(safeUrl(item.url))}" aria-label="View ${escape(item.name)} integration">View integration <span>↗</span></a></div></article>`;
  }
  function addFilters(target, values, key) {
    document.getElementById(target).innerHTML = values.map((value) => { const count = items.filter((item) => key === 'stacks' ? item.stack.includes(value) : item.type === value).length, id = `${key}-${slug(value)}`; return `<label for="${id}"><input type="checkbox" id="${id}" value="${escape(value)}" data-filter="${key}"><span>${escape(value)}</span><b>${count}</b></label>`; }).join('');
  }
  function render() {
    const words = state.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let visible = items.filter((item) => { const haystack = [item.name, item.package_name, item.vendor, item.type, item.description, ...(item.keywords || []), ...item.stack].join(' ').toLowerCase(); return words.every((word) => haystack.includes(word)) && (!state.stacks.size || [...state.stacks].every((stack) => item.stack.includes(stack))) && (!state.types.size || state.types.has(item.type)); });
    if (state.sort === 'az') visible.sort((a, b) => a.name.localeCompare(b.name)); else if (state.sort === 'za') visible.sort((a, b) => b.name.localeCompare(a.name)); else visible.sort((a, b) => (a.featured || 999) - (b.featured || 999) || a.name.localeCompare(b.name));
    grid.innerHTML = visible.map((item) => card(item, false)).join(''); grid.hidden = !visible.length; empty.hidden = Boolean(visible.length);
    document.getElementById('result-count').textContent = visible.length; document.getElementById('result-label').textContent = visible.length === 1 ? 'integration' : 'integrations';
    const chips = []; if (state.query) chips.push(`<button data-clear="query">Search: “${escape(state.query)}” ×</button>`); state.stacks.forEach((value) => chips.push(`<button data-clear="stacks" data-value="${escape(value)}">${escape(value)} ×</button>`)); state.types.forEach((value) => chips.push(`<button data-clear="types" data-value="${escape(value)}">${escape(value)} ×</button>`)); document.getElementById('active-filters').innerHTML = chips.join('');
    const params = new URLSearchParams(); if (state.query) params.set('q', state.query); if (state.stacks.size) params.set('stack', [...state.stacks].join(',')); if (state.types.size) params.set('type', [...state.types].join(',')); if (state.sort !== 'featured') params.set('sort', state.sort); history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  }
  function clearAll() { state.query = ''; state.stacks.clear(); state.types.clear(); state.sort = 'featured'; search.value = ''; document.getElementById('market-sort').value = 'featured'; document.querySelectorAll('[data-filter]').forEach((input) => { input.checked = false; }); render(); }
  const [agentrustResult, agtResult] = await Promise.allSettled([fetchJson(AGENTRUST_CATALOG), fetchJson(AGT_CATALOG)]);
  const warnings = []; let agentrustItems = [], agtItems = [];
  if (agentrustResult.status === 'fulfilled') { try { agentrustItems = normalizeAgenTrust(agentrustResult.value); } catch (error) { warnings.push('AgenTrust catalog unavailable'); } } else warnings.push('AgenTrust catalog unavailable');
  if (agtResult.status === 'fulfilled') { try { agtItems = normalizeAgt(agtResult.value); } catch (error) { warnings.push('AGT catalog unavailable'); } } else warnings.push('AGT catalog unavailable');
  items = [...agentrustItems, ...agtItems]; document.getElementById('hero-count').textContent = items.length; document.getElementById('native-count').textContent = agentrustItems.length; document.getElementById('agt-count').textContent = agtItems.length;
  status.textContent = warnings.length ? `${warnings.join(' · ')}. Showing the source that loaded successfully.` : 'Repository-generated inventory, including a daily commit-pinned snapshot of Microsoft AGT integrations.'; status.classList.toggle('catalog-warning', Boolean(warnings.length));
  const stacks = [...new Set(items.flatMap((item) => item.stack))].sort((a, b) => a.localeCompare(b)), types = [...new Set(items.map((item) => item.type))].sort((a, b) => a.localeCompare(b));
  addFilters('stack-filters', stacks, 'stacks'); addFilters('type-filters', types, 'types'); document.getElementById('featured-list').innerHTML = agentrustItems.filter((item) => item.featured && item.featured <= 3).map((item) => card(item, true)).join('');
  const params = new URLSearchParams(location.search); state.query = params.get('q') || ''; state.sort = ['az', 'za'].includes(params.get('sort')) ? params.get('sort') : 'featured'; (params.get('stack') || '').split(',').filter((value) => stacks.includes(value)).forEach((value) => state.stacks.add(value)); (params.get('type') || '').split(',').filter((value) => types.includes(value)).forEach((value) => state.types.add(value)); search.value = state.query; document.getElementById('market-sort').value = state.sort; document.querySelectorAll('[data-filter]').forEach((input) => { input.checked = state[input.dataset.filter].has(input.value); });
  search.addEventListener('input', () => { state.query = search.value; render(); }); document.getElementById('market-sort').addEventListener('change', (event) => { state.sort = event.target.value; render(); }); document.querySelectorAll('[data-filter]').forEach((input) => input.addEventListener('change', () => { const set = state[input.dataset.filter]; input.checked ? set.add(input.value) : set.delete(input.value); render(); }));
  document.getElementById('active-filters').addEventListener('click', (event) => { const button = event.target.closest('button'); if (!button) return; if (button.dataset.clear === 'query') { state.query = ''; search.value = ''; } else { state[button.dataset.clear].delete(button.dataset.value); const input = [...document.querySelectorAll('[data-filter]')].find((candidate) => candidate.value === button.dataset.value); if (input) input.checked = false; } render(); });
  document.getElementById('clear-filters').addEventListener('click', clearAll); document.getElementById('empty-clear').addEventListener('click', clearAll); document.addEventListener('keydown', (event) => { if (event.key === '/' && !/input|select|textarea/i.test(document.activeElement.tagName)) { event.preventDefault(); search.focus(); } }); render();
}());
