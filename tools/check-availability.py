"""Sample public HTTP availability. This is not an uptime SLA or real-crawler test."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://agentrust-io.com'


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
    for prefix in ['', 'trace.', 'manifest.', 'cmcp.', 'ca2a.', 'governance.', 'tests.']:
        urls.update('https://' + prefix + 'agentrust-io.com' + path for path in ['/', '/robots.txt', '/sitemap.xml', '/llms.txt'])
    targets = [(url, 200) for url in sorted(urls)] + [(BASE + '/missing-availability-probe-404/', 404)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(probe, targets))
    Path('availability-results.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
    failures = [item for item in results if 'error' in item]
    print(f'{len(results)-len(failures)}/{len(results)} public HTTP probes passed')
    if failures:
        raise SystemExit(json.dumps(failures, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        Path('availability-results.json').write_text(json.dumps({'discovery_error': str(exc)}, indent=2) + '\n', encoding='utf-8')
        raise
