"""Sample public HTTP availability. This is not an uptime SLA or real-crawler test."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parent))
from site_header import CSS_VERSION  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://agentrust-io.com'
DOCS_HOSTS = ['trace.', 'manifest.', 'cmcp.', 'ca2a.', 'governance.', 'tests.', 'wcm.']
# Browsers keep both files for four hours, so each MkDocs site pins CSS_VERSION in
# its mkdocs.yml. A host still on an older number shows readers a stale top bar.
SHARED_ASSETS = ['design-system.css', 'supernav.js']


def asset_versions(host):
    """Report which shared asset URLs a docs host's home page references, and whether they are current."""
    url = f'https://{host}agentrust-io.com/'
    try:
        # The CDN can answer the bare URL from a copy cached before the latest deploy:
        # on 2026-09-14 trace.agentrust-io.com/ returned HTML from 21:01 (Age 426) with
        # unversioned URLs while ?v=<time> returned v=21. A throwaway query reads the
        # deployed page. The plain 200 probes below keep the bare URLs.
        fresh = f'{url}?availability={int(time.time())}'
        request = Request(fresh, headers={'User-Agent': 'AgenTrust-availability-check/1.0'})
        with urlopen(request, timeout=20) as response:
            html = response.read().decode('utf-8', 'replace')
    except Exception as exc:
        return {'url': url, 'error': f'could not read home page: {exc}'}
    found = {}
    for asset in SHARED_ASSETS:
        # MkDocs minifies HTML, so the attribute may be quoted or not.
        refs = re.findall(r'https://agentrust-io\.com/' + re.escape(asset) + r'(?:\?v=(\d+))?(?=["\'\s>])', html)
        found[asset] = sorted({v or 'unversioned' for v in refs}) or ['missing']
    lagging = [f'{asset} is {",".join(v)}' for asset, v in found.items() if v != [CSS_VERSION]]
    result = {'url': url, 'expected_version': CSS_VERSION, 'found': found}
    if lagging:
        result['error'] = f'{host}agentrust-io.com lags CSS_VERSION {CSS_VERSION}: ' + '; '.join(lagging) + '. Bump ?v= in its mkdocs.yml.'
    return result


def probe(target):
    url, expected = target
    error = None
    for attempt in range(2):
        started = time.monotonic()
        try:
            request = Request(url, headers={'User-Agent': 'AgenTrust-availability-check/1.0'})
            with urlopen(request, timeout=20) as response:
                body = response.read()
                status = response.status
                if status != expected or not body or response.headers.get('cf-mitigated') == 'challenge':
                    raise ValueError(f'Unexpected status/content: {status}')
                if 'noindex' in response.headers.get('X-Robots-Tag', '').lower():
                    raise ValueError('Unexpected noindex header')
                return {'url': url, 'status': status, 'seconds': round(time.monotonic()-started, 3), 'bytes': len(body)}
        except HTTPError as exc:
            if exc.code == expected:
                return {'url': url, 'status': exc.code}
            error = str(exc)
        except Exception as exc:
            error = str(exc)
        if attempt == 0:
            time.sleep(1)
    return {'url': url, 'error': error}


def main():
    # Read the deployed sitemap, so an unmerged PR cannot create false live failures.
    request = Request(BASE + '/sitemap.xml', headers={'User-Agent': 'AgenTrust-availability-check/1.0'})
    with urlopen(request, timeout=20) as response:
        sitemap = ET.fromstring(response.read())
    urls = {node.text for node in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')}
    if not urls or any(not url.startswith(BASE + '/') for url in urls):
        raise ValueError('Unexpected live sitemap')
    for prefix in [''] + DOCS_HOSTS:
        urls.update('https://' + prefix + 'agentrust-io.com' + path for path in ['/', '/robots.txt', '/sitemap.xml', '/llms.txt'])
    targets = [(url, 200) for url in sorted(urls)] + [(BASE + '/missing-availability-probe-404/', 404)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(probe, targets))
        versions = list(pool.map(asset_versions, DOCS_HOSTS))
    Path('availability-results.json').write_text(json.dumps(results + versions, indent=2) + '\n', encoding='utf-8')
    failures = [item for item in results if 'error' in item]
    lagging = [item for item in versions if 'error' in item]
    print(f'{len(results)-len(failures)}/{len(results)} public HTTP probes passed')
    print(f'{len(versions)-len(lagging)}/{len(versions)} docs hosts load design-system.css and supernav.js at v={CSS_VERSION}')
    if failures or lagging:
        raise SystemExit(json.dumps(failures + lagging, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        Path('availability-results.json').write_text(json.dumps({'discovery_error': str(exc)}, indent=2) + '\n', encoding='utf-8')
        raise
