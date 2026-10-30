import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const start = '<!-- capabilities:start -->';
const end = '<!-- capabilities:end -->';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function render(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.reviewed_at) || !Array.isArray(data.entries) || !data.entries.length) {
    throw new Error('A dated, nonempty evidence inventory is required');
  }
  const seen = new Set();
  const rows = data.entries.map(item => {
    for (const field of ['project', 'capability', 'result', 'limits']) {
      if (typeof item[field] !== 'string' || !item[field].trim()) throw new Error(`Missing ${field}`);
    }
    if (!/^[a-z0-9-]+$/.test(item.repository) || !/^[a-f0-9]{40}$/.test(item.revision)
        || !Number.isSafeInteger(item.run) || item.run <= 0
        || !Number.isSafeInteger(item.pull_request) || item.pull_request <= 0
        || !['synthetic', 'captured', 'live'].includes(item.evidence_class)) throw new Error('Invalid evidence reference');
    const key = `${item.repository}:${item.capability}`;
    if (seen.has(key)) throw new Error('Duplicate capability');
    seen.add(key);
    const repo = `https://github.com/agentrust-io/${item.repository}`;
    return `<tr><th scope="row">${escape(item.project)}</th><td>${escape(item.capability)}<br><a href="${repo}/tree/${item.revision}">Source ${item.revision.slice(0, 12)}</a><br><a href="${repo}/pull/${item.pull_request}">Draft PR #${item.pull_request}</a></td><td>${escape(item.evidence_class)}<br>${escape(item.result)}<br><a href="${repo}/actions/runs/${item.run}">Executable CI run</a></td><td>${escape(item.limits)}</td></tr>`;
  });
  return `${start}
<section id="capability-evidence">
  <span class="label">Evidence inventory</span>
  <h2>Capabilities under review</h2>
  <p>Selected contributions with revision-specific execution evidence, reviewed ${escape(data.reviewed_at)}. These are draft implementations, not a released-product support matrix. Follow each pull request for current status.</p>
  <p>Synthetic means controlled fixtures or workloads; captured means previously collected evidence; live means a documented live operation. A real collector does not make its synthetic workload live evidence. Missing rows mean not assessed here, not unsupported.</p>
  <div role="region" aria-label="Capability evidence table" tabindex="0" style="overflow-x:auto">
    <table><caption>Bounded test results and limitations</caption><thead><tr><th scope="col">Project</th><th scope="col">Capability and source</th><th scope="col">Validation evidence</th><th scope="col">Limits</th></tr></thead><tbody>
${rows.join('\n')}
    </tbody></table>
  </div>
  <p>Run artifacts can expire. A passing run supports its recorded scope only; it does not establish conformance, production acceptance or hardware provenance. Canonical requirements remain in each project's specification.</p>
</section>
${end}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('../', import.meta.url);
  const data = JSON.parse(await readFile(new URL('data/capabilities.json', root), 'utf8'));
  const pageUrl = new URL('verify/index.html', root);
  const page = await readFile(pageUrl, 'utf8');
  if (page.split(start).length !== 2 || page.split(end).length !== 2) throw new Error('Expected one marker pair');
  const first = page.indexOf(start), last = page.indexOf(end);
  if (last < first) throw new Error('Reversed markers');
  const output = page.slice(0, first) + render(data) + page.slice(last + end.length);
  if (process.argv.includes('--check')) {
    if (page !== output) throw new Error('Capability table is stale; run node scripts/render-capabilities.mjs');
  } else await writeFile(pageUrl, output);
}
