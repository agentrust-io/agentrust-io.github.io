"""Validate canonical metadata, sitemap coverage, AI guide links, and crawler access."""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.canonicals, self.descriptions, self.ids = [], [], set()
        self.title, self.in_title, self.noindex, self.redirect, self.h1 = '', False, False, False, 0
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.add(a['id'])
        if tag == 'title':
            self.in_title = True
        if tag == 'h1':
            self.h1 += 1
        if tag == 'link' and 'canonical' in a.get('rel', '').split():
            self.canonicals.append(a.get('href'))
        if tag == 'meta':
            if a.get('name') == 'description':
                self.descriptions.append(a.get('content', ''))
            self.noindex |= a.get('name', '').lower() == 'robots' and 'noindex' in a.get('content', '').lower()
            self.redirect |= a.get('http-equiv', '').lower() == 'refresh'

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def check():
    pages = {p: Page(p.read_text(encoding='utf-8')) for p in ROOT.rglob('*.html') if '.git' not in p.parts}
    expected, titles = set(), set()
    for path, page in pages.items():
        if page.noindex or page.redirect:
            continue
        rel = path.relative_to(ROOT).as_posix()
        expected_url = 'https://agentrust-io.com/' + (rel[:-10] if rel.endswith('index.html') else rel)
        assert page.canonicals == [expected_url], f'{rel}: canonical must match public path'
        assert len(page.descriptions) == 1 and page.descriptions[0].strip(), f'{rel}: missing/duplicate description'
        assert page.title.strip() and page.title not in titles, f'{rel}: missing/duplicate title'
        assert page.h1 == 1, f'{rel}: expected one main heading'
        titles.add(page.title)
        expected.add(expected_url)
    sitemap = ET.parse(ROOT / 'sitemap.xml')
    locations = [node.text for node in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    assert len(locations) == len(set(locations)), 'Duplicate sitemap entry'
    assert set(locations) == expected, f'Sitemap mismatch: missing {expected-set(locations)}, extra {set(locations)-expected}'
    robots = RobotFileParser()
    robots.parse((ROOT / 'robots.txt').read_text(encoding='utf-8').splitlines())
    for bot in ['Googlebot', 'bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User']:
        for url in locations:
            assert robots.can_fetch(bot, url), f'{bot} blocked from {url}'
    guide = (ROOT / 'llms.txt').read_text(encoding='utf-8-sig')
    for href in re.findall(r'\]\((https://agentrust-io\.com[^)]*)\)', guide):
        url = urlsplit(href)
        path = ROOT / unquote(url.path).lstrip('/')
        if path.is_dir():
            path /= 'index.html'
        assert path.is_file(), f'AI guide destination missing: {href}'
        if url.fragment:
            assert path in pages and unquote(url.fragment) in pages[path].ids, f'AI guide fragment missing: {href}'
    snapshot = json.loads((ROOT / 'data/marketplace-snapshot.json').read_text(encoding='utf-8'))
    catalog = (ROOT / 'marketplace/catalog/index.html').read_text(encoding='utf-8')
    assert catalog.count('<article ') == len(snapshot['items']), 'Static catalog omitted listings'
    assert '<script' not in catalog, 'Static catalog must work without JavaScript'
    assert pages[ROOT / '404.html'].noindex, 'Error page must be excluded from indexing'
    print(f'PASS {len(locations)} canonical pages; metadata, sitemap, 8 crawler policies, AI guide links, static catalog and 404')


if __name__ == '__main__':
    check()
