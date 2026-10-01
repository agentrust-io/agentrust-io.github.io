"""Build the research library from reviewed metadata and frozen paper artifacts."""
import argparse
import datetime
import hashlib
from html import escape as esc
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import site_header

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://agentrust-io.com'


def shell(title, description, path, body, scholarly=None):
    metadata = ''
    structured = {'@context': 'https://schema.org', '@type': 'CollectionPage',
                  'name': title, 'url': BASE + path, 'description': description}
    if scholarly:
        p = scholarly
        tags = [('citation_title', p['title']), ('citation_publication_date', p['date'].replace('-', '/')),
                ('citation_pdf_url', BASE + f'/research/{p["slug"]}/v{p["version"]}/paper.pdf')]
        tags += [('citation_author', author) for author in p['authors']]
        if p.get('doi'):
            tags.append(('citation_doi', p['doi']))
        metadata = '\n'.join(f'<meta name="{key}" content="{esc(value, quote=True)}">' for key, value in tags)
        structured = {'@context': 'https://schema.org', '@type': 'ScholarlyArticle',
                      'headline': p['title'], 'abstract': p['abstract'], 'url': BASE + path,
                      'author': [{'@type': 'Person', 'name': a} for a in p['authors']],
                      'datePublished': p['date'], 'version': str(p['version']),
                      'creativeWorkStatus': 'Technical report; not peer reviewed',
                      'license': 'https://creativecommons.org/licenses/by/4.0/',
                      'encoding': {'@type': 'MediaObject', 'encodingFormat': 'application/pdf',
                                   'contentUrl': BASE + f'/research/{p["slug"]}/v{p["version"]}/paper.pdf'}}
        if p.get('doi'):
            structured['identifier'] = 'https://doi.org/' + p['doi']
    return f'''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)} | AgenTrust</title>
<meta name="description" content="{esc(description, quote=True)}">
<link rel="canonical" href="{BASE}{path}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="{'article' if scholarly else 'website'}">
<meta property="og:site_name" content="AgenTrust">
<meta property="og:title" content="{esc(title, quote=True)}">
<meta property="og:description" content="{esc(description, quote=True)}">
<meta property="og:url" content="{BASE}{path}">
<meta property="og:image" content="{BASE}/og.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="AgenTrust research: identity, enforcement and runtime evidence">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title, quote=True)}">
<meta name="twitter:description" content="{esc(description, quote=True)}">
<meta name="twitter:image" content="{BASE}/og.png">
{metadata}
<script type="application/ld+json">{json.dumps(structured, ensure_ascii=True).replace('<', chr(92)+'u003c')}</script>
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/design-system.css?v={site_header.CSS_VERSION}">
<link rel="stylesheet" href="/research/research.css">
</head><body class="agentrust-hub research-page">
{site_header.render(page=path)}
<main id="main" class="research-main">{body}</main>
<footer class="research-footer"><a href="/research/">AgenTrust Research</a><span>Paper text: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Code retains its project license.</span><a href="https://github.com/agentrust-io">GitHub</a></footer>
<script src="/supernav.js?v={site_header.CSS_VERSION}" defer></script>
</body></html>
'''


def citation(p):
    # A URL citation is valid before an external archive assigns a DOI.
    doi = f'  doi = {{{p["doi"]}}},\n' if p.get('doi') else ''
    return ('@techreport{agentrust2026' + p['slug'].replace('-', '') + ',\n'
            f'  title = {{{p["title"]}}},\n'
            f'  author = {{{" and ".join(p["authors"])}}},\n'
            '  institution = {AgenTrust},\n  year = {2026},\n'
            f'  type = {{Technical report}},\n  note = {{Version {p["version"]}; not peer reviewed}},\n'
            + doi + f'  url = {{{BASE}/research/{p["slug"]}/v{p["version"]}/}}\n' + '}\n')


def human_date(iso):
    d=datetime.date.fromisoformat(iso)
    return f'{d.strftime("%B")} {d.day}, {d.year}'


def versions(p):
    """Published versions, oldest first. An entry without a list is a single version 1."""
    if p.get('versions'):
        return p['versions']
    v={'version':1,'date':p['date'],'pages':p['pages'],'changes':p['changes'],'sha256':p['sha256']}
    if p.get('doi'):
        v['doi']=p['doi']
    return [v]


def at(p, v):
    """The paper's metadata as of one published version."""
    q={k:val for k,val in p.items() if k not in ('doi','date','pages','changes','sha256','versions')}
    q.update(v)
    return q


def paper_page(p, v=None):
    history=versions(p)
    q=at(p, v or history[-1])
    slug=q['slug']
    n=q['version']
    path=f'/research/{slug}/' + (f'v{n}/' if v else '')
    artifact=f'/research/{slug}/v{n}/'
    patent = '<span>Patent Pending</span>' if q['patent_pending'] else ''
    archive = f'<a href="https://doi.org/{esc(q["doi"], quote=True)}">Archive and DOI</a>' if q.get('doi') else ''
    origin = f'<p>{esc(q["origin"])}</p>\n' if q.get('origin') else ''
    evidence = q.get('evidence_note', 'No new experiment run or independent replication is claimed for this edition.')
    # Code outside a public GitHub repository (a reference implementation in the source package)
    # has no issue tracker of its own; corrections then go to the organization's public tracker.
    on_github = q['code'].startswith('https://github.com/')
    code_label = 'Project code' if on_github else 'Reference implementation'
    issues = q['code'] + '/issues' if on_github else 'https://github.com/agentrust-io/.github/issues'
    spec = (f'<p><a href="{esc(q["spec"])}">Read the current specification and implementation guidance</a>. This report describes an earlier design and evaluation; the current specification governs implementation.</p>'
            if q.get('spec') else '<p>No separate specification exists for this mechanism. The reference implementation in the source package is the implementation guidance.</p>')
    rows=''.join(f'<p><a href="/research/{slug}/v{h["version"]}/">Version {h["version"]}, {human_date(h["date"])}</a>: {esc(h["changes"])}</p>\n' for h in reversed(history))
    body=f'''<nav class="research-breadcrumb" aria-label="Breadcrumb"><a href="/research/">Research</a> / {esc(q['short_title'])}{f' / Version {n}' if v else ''}</nav>
<header class="paper-header"><p class="research-eyebrow">Technical report / Version {n}</p>
<h1>{esc(q['title'])}</h1>
<p class="paper-authors">{esc(', '.join(q['authors']))}</p><p class="paper-affiliation">OPAQUE Systems</p>
<div class="paper-status"><span>{human_date(q['date'])}</span><span>Not peer reviewed</span>{patent}</div>
</header>
<section class="paper-abstract" aria-labelledby="abstract"><h2 id="abstract">Abstract</h2><p>{esc(q['abstract'])}</p></section>
<nav class="paper-actions" aria-label="Paper resources"><a class="primary-action" href="{artifact}paper.pdf">Read PDF <span>({q['pages']} pages)</span></a><a href="#cite">Cite this report</a><a href="{artifact}source.zip">Source and recorded evidence</a><a href="{esc(q['code'])}">{code_label}</a>{archive}</nav>
<section class="research-section"><h2>What this report contributes</h2><p>{esc(q['contribution'])}</p></section>
<section class="research-section"><h2>Evidence and limits</h2><ul>{''.join('<li>'+esc(item)+'</li>' for item in q['limits'])}</ul>
<p>The source package preserves the recorded inputs and results. {esc(evidence)}</p>
{spec}</section>
<section class="research-section" id="cite"><h2>Cite this report</h2><p>{esc('; '.join(q['authors']))}. {esc(q['title'])}. AgenTrust technical report, version {n}, 2026.</p>
<p><a href="{artifact}citation.bib" download>Download BibTeX</a> / <a href="{artifact}CITATION.cff" download>Download CITATION.cff</a></p><pre><code>{esc(citation(q))}</code></pre></section>
<section class="research-section"><h2>Version history</h2>{rows}{origin}<p><a href="{artifact}SHA256SUMS">File checksums</a>. Published version files are retained; substantive revisions receive a new version.</p></section>
<section class="research-section"><h2>Questions and corrections</h2><p>Open an issue in the <a href="{esc(issues)}">{'project repository' if on_github else 'AgenTrust public issue tracker'}</a> and identify the report version and section.</p></section>'''
    title=q['title'] + (f' (version {n})' if v else '')
    return shell(title,q['description'],path,body,q)


def generate():
    papers=json.loads((ROOT/'data/research.json').read_text(encoding='utf-8'))['papers']
    outputs={}
    for p in papers:
        for v in versions(p):
            q=at(p, v)
            folder=ROOT/'research'/p['slug']/f'v{v["version"]}'
            for filename in ('paper.pdf','source.zip'):
                file=folder/filename
                if not file.is_file():
                    raise ValueError(f'Missing release artifact: {file}')
                if hashlib.sha256(file.read_bytes()).hexdigest() != v['sha256'][filename]:
                    raise ValueError(f'Frozen artifact changed: {file}. Create a new version instead.')
            outputs[folder/'index.html']=paper_page(p,v)
            outputs[folder/'citation.bib']=citation(q)
            cff={'cff-version':'1.2.0','message':'Cite the versioned technical report. It has not been peer reviewed.',
                 'type':'dataset','title':q['title'],'version':str(v['version']),'date-released':v['date'],
                 'authors':[{'given-names':' '.join(a.split()[:-1]),'family-names':a.split()[-1]} for a in q['authors']],
                 'url':BASE+f'/research/{p["slug"]}/v{v["version"]}/','license':'CC-BY-4.0'}
            if v.get('doi'):
                cff['doi']=v['doi']
            # JSON is also valid YAML; the preferred citation identifies the document type.
            cff['preferred-citation']={'type':'report','title':q['title'],'authors':cff['authors'],
                                       'year':2026,'url':cff['url']}
            outputs[folder/'CITATION.cff']=json.dumps(cff,indent=2)+'\n'
            outputs[folder/'SHA256SUMS']=''.join(v['sha256'][f]+'  '+f+'\n' for f in ('paper.pdf','source.zip'))
        outputs[ROOT/'research'/p['slug']/'index.html']=paper_page(p)
    def card(p):
        latest=versions(p)[-1]
        return f'''<article class="paper-card"><p class="research-eyebrow">{esc(p['topic'])}</p><h2><a href="/research/{p['slug']}/">{esc(p['title'])}</a></h2><p>{esc(p['contribution'])}</p><p class="paper-card-meta">{esc(', '.join(p['authors']))}</p><p class="paper-card-meta">Version {latest['version']} / {human_date(latest['date'])} / Technical report</p><a class="paper-card-link" href="/research/{p['slug']}/">Read the report <span aria-hidden="true">&rarr;</span></a></article>'''
    cards=''.join(card(p) for p in papers)
    body=f'''<header class="research-intro"><p class="research-eyebrow">AgenTrust Research</p><h1>Identity, enforcement,<br>and evidence for AI agents.</h1><p>Technical reports with open source, recorded experiments, and explicit limits. Read the work, inspect the evidence, and cite a specific version.</p></header>
<div class="research-label"><span>Research collection</span><span>{len(papers)} reports / Not peer reviewed</span></div><div class="paper-list">{cards}</div>
<section class="research-section"><h2>Read the evidence with the claim</h2><p>These reports preserve historical designs and software evaluations. A signature, an attestation result, and an execution-completeness claim establish different properties. Each paper page identifies the evidence evaluated and the limits that remain.</p><p>For implementation, follow the current project specifications linked from each report. Paper text is available under CC BY 4.0; code retains its project license.</p></section>'''
    outputs[ROOT/'research/index.html']=shell('Research: AI Agent Identity, Enforcement and Evidence','AgenTrust technical reports on agent identity, tool-call enforcement, runtime evidence, model custody, delegation and telemetry, with PDFs, source and limits.','/research/',body)
    return outputs


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    outputs=generate()
    for path,text in outputs.items():
        if args.check:
            if not path.exists() or path.read_text(encoding='utf-8') != text:
                raise SystemExit(f'Stale {path.relative_to(ROOT)}; run python tools/build-research.py')
        else:
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(text,encoding='utf-8',newline='\n')
    count=len(json.loads((ROOT/'data/research.json').read_text(encoding='utf-8'))['papers'])
    print(f'PASS research library: {len(outputs)} generated files; {count} frozen PDF/source pairs')


if __name__=='__main__':
    main()
