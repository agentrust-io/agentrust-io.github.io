"""Generate crawlable catalog and sitemap; --check is offline and deterministic."""
import argparse
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://agentrust-io.com'
SNAPSHOT = ROOT / 'data/marketplace-snapshot.json'


def get_json(url):
    with urlopen(Request(url, headers={'User-Agent': 'AgenTrust-discovery-builder'}), timeout=30) as response:
        return json.load(response)


def refresh():
    commit = get_json('https://api.github.com/repos/agentrust-io/integrations/commits/main')['sha']
    if not re.fullmatch('[a-f0-9]{40}', commit):
        raise ValueError('Invalid source commit')
    items = []
    for filename, source in [('catalog.json', 'AgenTrust Community'), ('agt-catalog.json', 'AGT project')]:
        catalog = get_json(f'https://raw.githubusercontent.com/agentrust-io/integrations/{commit}/marketplace/{filename}')
        if catalog['catalog_version'] != 1 or catalog['count'] != len(catalog['integrations']):
            raise ValueError('Invalid catalog envelope')
        for item in catalog['integrations']:
            if urlsplit(item['url']).scheme != 'https':
                raise ValueError('Catalog links must use HTTPS')
            entry = {key: item[key] for key in ['name', 'description', 'url', 'vendor', 'stack']}
            # Preserve the meaning while applying the site's punctuation style.
            entry['description'] = re.sub('[\u2013\u2014\u2015]', ':', entry['description'])
            entry['source'] = source
            items.append(entry)
    snapshot = {'captured': datetime.now(timezone.utc).date().isoformat(), 'source_commit': commit, 'items': items}
    SNAPSHOT.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def catalog_html(snapshot):
    items = sorted(snapshot['items'], key=lambda item: item['name'].casefold())
    cards = []
    for item in items:
        if urlsplit(item['url']).scheme != 'https':
            raise ValueError('Catalog links must use HTTPS')
        cards.append(f'<article class="card"><h2><a href="{escape(item["url"], quote=True)}">{escape(item["name"])}</a></h2>'
                     f'<p>{escape(item["description"])}</p><p class="hint">{escape(item["source"])} · '
                     f'{escape(item["vendor"])} · {escape(", ".join(item["stack"]))}</p></article>')
    return '''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>All AgenTrust Marketplace Integrations | AgenTrust</title>
<meta name="description" content="Browse AgenTrust and Microsoft AGT integrations with descriptions and source links. This dated catalog works without JavaScript or external catalog requests.">
<link rel="canonical" href="https://agentrust-io.com/marketplace/catalog/">
<link rel="stylesheet" href="/design-system.css?v=19"><link rel="icon" href="/favicon.ico">
</head><body class="at-page marketplace-page">
<header class="site-header"><div class="wrap header-inner"><a class="wordmark" href="/">AgenTrust</a><a href="/marketplace/">Search marketplace</a></div></header>
<main class="wrap"><section><p class="eyebrow">Marketplace catalog</p><h1>All integrations</h1>
<p>Browse descriptions and source links without JavaScript. Use your browser's Find command to locate a framework or technology.</p>
''' + f'<p>{len(items)} listings, captured {escape(snapshot["captured"])} from <a href="https://github.com/agentrust-io/integrations/tree/{snapshot["source_commit"]}/marketplace">this source revision</a>. <a href="/marketplace/">Search the live catalog</a> for newer listings.</p>\n' + '''<p>Community listings are manifest-validated, not endorsed. AGT project listings describe integrations in the Microsoft Agent Governance Toolkit. Listing does not establish certification, hardware validation, or commercial availability.</p>
<div class="grid">
''' + '\n'.join(cards) + '''
</div></section></main><footer class="site-footer"><div class="wrap"><a href="/">AgenTrust ecosystem</a> · <a href="/wcm/">Weight Custody Manifest</a> · <a href="/quickstart/">First tutorial</a></div></footer>
</body></html>
'''


class Metadata(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.canonical = []
        self.noindex = False
        self.redirect = False
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'canonical' in attrs.get('rel', '').split():
            self.canonical.append(attrs.get('href', ''))
        if tag == 'meta':
            self.noindex |= attrs.get('name', '').lower() == 'robots' and 'noindex' in attrs.get('content', '').lower()
            self.redirect |= attrs.get('http-equiv', '').lower() == 'refresh'


def sitemap(catalog):
    urls = set()
    paths = set(ROOT.rglob('*.html')) | {ROOT / 'marketplace/catalog/index.html'}
    for path in sorted(paths):
        if '.git' in path.parts:
            continue
        meta = Metadata(catalog if path == ROOT / 'marketplace/catalog/index.html' else path.read_text(encoding='utf-8'))
        if meta.noindex or meta.redirect:
            continue
        if len(meta.canonical) != 1:
            raise ValueError(f'{path.relative_to(ROOT)} needs one canonical URL')
        url = meta.canonical[0]
        if urlsplit(url).netloc != 'agentrust-io.com':
            continue
        if url in urls:
            raise ValueError(f'Duplicate canonical URL: {url}')
        urls.add(url)
    # Do not publish guessed modification dates or unsupported priority signals.
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{escape(url)}</loc></url>\n' for url in sorted(urls)) + '</urlset>\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='Fetch a commit-pinned public catalog snapshot')
    parser.add_argument('--check', action='store_true', help='Fail if committed generated files differ')
    args = parser.parse_args()
    if args.refresh and args.check:
        parser.error('--refresh and --check are mutually exclusive')
    if args.refresh:
        refresh()
    snapshot = json.loads(SNAPSHOT.read_text(encoding='utf-8'))
    if not re.fullmatch('[a-f0-9]{40}', snapshot['source_commit']):
        raise ValueError('Invalid snapshot source commit')
    catalog = catalog_html(snapshot)
    outputs = {ROOT / 'marketplace/catalog/index.html': catalog, ROOT / 'sitemap.xml': sitemap(catalog)}
    for path, content in outputs.items():
        if args.check:
            if not path.exists() or path.read_text(encoding='utf-8') != content:
                raise SystemExit(f'Stale {path.relative_to(ROOT)}: run python tools/build-discovery.py')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8', newline='\n')
    print(f'PASS discovery artifacts: {len(snapshot["items"])} catalog entries; sitemap generated from canonical HTML')


if __name__ == '__main__':
    main()
