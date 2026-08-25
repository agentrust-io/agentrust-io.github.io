import { access, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dataUrl = new URL('data/adoption.json', root);
const pageUrl = new URL('index.html', root);
const start = '  <!-- adoption:generated:start -->';
const end = '  <!-- adoption:generated:end -->';

const escapeText = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const evidence = item => item.evidenceUrl
  ? `<a class="evidence-link" href="${escapeText(item.evidenceUrl)}">${escapeText(item.evidenceLabel)} ↗</a>`
  : '';

const renderEvidence = item => `    <article class="adoption-card">
      <div class="adopter-mark ${escapeText(item.markClass || '')}">${escapeText(item.name)}</div>
      <div class="adopter-stage">${escapeText(item.label)}</div>
      <p>${escapeText(item.description)}</p>
      ${evidence(item)}
    </article>`;

const renderPartner = (item, featured = false) => `    <article class="partner-card${featured ? ' lf-card' : ''}${item.compact ? ' startup-card' : ''}">
      <div class="partner-logo-wrap"><img src="${escapeText(item.logo)}" alt="${escapeText(item.name)}" loading="lazy"></div>
      <div><div class="partner-kicker">${escapeText(item.label)}</div><h3>${escapeText(item.title)}</h3><p>${escapeText(item.description)}</p>${evidence(item)}</div>
    </article>`;

const data = JSON.parse(await readFile(dataUrl, 'utf8'));
const relationships = data.relationships;
if (!Array.isArray(relationships) || relationships.length === 0) throw new Error('data/adoption.json must contain relationships');
for (const item of relationships) {
  if (!['host', 'evidence', 'partner'].includes(item.kind) || !item.name || !item.label || !item.description) {
    throw new Error(`Invalid relationship entry: ${item.name || '<unnamed>'}`);
  }
  if ((item.kind === 'host' || item.kind === 'partner') && (!item.logo || !item.title)) {
    throw new Error(`Logo and title are required for ${item.name}`);
  }
  if (item.evidenceUrl && !item.evidenceLabel) throw new Error(`Evidence label is required for ${item.name}`);
  if (item.compact !== undefined && typeof item.compact !== 'boolean') throw new Error(`compact must be boolean for ${item.name}`);
  if (item.evidenceUrl && new URL(item.evidenceUrl).protocol !== 'https:') throw new Error(`Evidence URL must use HTTPS for ${item.name}`);
  if (item.markClass && !/^[a-z0-9-]+$/.test(item.markClass)) throw new Error(`Invalid markClass for ${item.name}`);
  if (item.logo) {
    if (!item.logo.startsWith('/assets/')) throw new Error(`Logo must be stored under /assets for ${item.name}`);
    await access(new URL(`.${item.logo}`, root));
  }
}

const hosts = relationships.filter(item => item.kind === 'host');
const evidenceItems = relationships.filter(item => item.kind === 'evidence');
const partners = relationships.filter(item => item.kind === 'partner');
const generated = [
  start,
  ...hosts.map(item => renderPartner(item, true)),
  '  <div class="adoption-grid">',
  ...evidenceItems.map(renderEvidence),
  '  </div>',
  '  <div class="partner-grid">',
  ...partners.map(item => renderPartner(item)),
  '  </div>',
  end
].join('\n');

const page = (await readFile(pageUrl, 'utf8')).replaceAll('\r\n', '\n');
const startAt = page.indexOf(start);
const endAt = page.indexOf(end);
if (startAt < 0 || endAt < startAt) throw new Error('Generated adoption markers are missing or out of order');
const next = page.slice(0, startAt) + generated + page.slice(endAt + end.length);

if (process.argv.includes('--check')) {
  if (page !== next) {
    console.error('index.html adoption section is stale; run node scripts/render-adoption.mjs');
    process.exit(1);
  }
  console.log(`PASS ${relationships.length} adoption relationships are in sync`);
} else {
  await writeFile(pageUrl, next, 'utf8');
  console.log(`Rendered ${relationships.length} adoption relationships`);
}
