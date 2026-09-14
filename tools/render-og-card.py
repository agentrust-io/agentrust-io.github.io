"""Render AgenTrust social cards (1200x630 PNG) with headless Chrome.

    python tools/render-og-card.py                   # agentrust-io.com, writes og.png
    python tools/render-og-card.py wcm --out PATH    # wcm.agentrust-io.com card
    CHROME=/path/to/chrome python tools/render-og-card.py

Every card is the same HTML template with different words, so the family stays
consistent and the next wording change is an edit and one command, not a lost
design file. Cards for the docs hosts are committed in their own repositories
(the WCM card lives at docs/assets/og.png in weight-custody-manifest), so pass
--out for those.

The template lives here rather than as a page because every *.html in this
repository is a published page to check-site.py and the sitemap. Keep the words
in step with each site's hero and its og:image:alt; colours are the brand navy
and red from brand/BRAND.md.

No --check: a PNG rendered on another machine differs in font hinting, so commit
the rendered file and review it by eye.
"""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CHAIN = ['Weights', 'Agent', 'Actions', 'Evidence']

CARDS = {
    'hub': {
        'out': ROOT / 'og.png',
        'eyebrow': 'Open specifications for verifiable AI',
        'title': 'AgenTrust',
        'lead': 'Prove what your AI ran, and what it did.',
        'step': None,
        'domain': 'agentrust-io.com',
    },
    'wcm': {
        'out': None,
        'eyebrow': 'An AgenTrust open specification',
        'title': 'Weight Custody Manifest',
        'lead': 'Release model weights only to an attested runtime.',
        'step': 1,
        'domain': 'wcm.agentrust-io.com',
    },
}

CARD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  html, body {{ margin: 0; width: 1200px; height: 630px; overflow: hidden; }}
  body {{ background: #15294B; color: #FFFEFA; position: relative; font-family: Inter, "Segoe UI", ui-sans-serif, sans-serif; }}
  .wrap {{ position: absolute; left: 90px; right: 90px; top: 84px; }}
  .eyebrow {{ font-size: 25px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #9FB3D1; }}
  h1 {{ font-size: {title_size}px; font-weight: 700; margin: 26px 0 0; letter-spacing: -.01em; line-height: 1; }}
  .bar {{ width: 120px; height: 9px; background: #B91C1C; margin: 38px 0 34px; }}
  .lead {{ font-size: 44px; line-height: 1.2; color: #E9E4D8; margin: 0; }}
  .chain {{ margin-top: 30px; font-size: 27px; color: #9FB3D1; letter-spacing: .01em; }}
  .chain b {{ color: #FFFEFA; font-weight: 600; }}
  .chain .on {{ color: #FFFEFA; border-bottom: 3px solid #B91C1C; padding-bottom: 2px; }}
  .domain {{ position: absolute; left: 90px; bottom: 46px; font-size: 27px; font-weight: 700; color: #9FB3D1; }}
  .foot {{ position: absolute; left: 0; right: 0; bottom: 0; height: 14px; background: #B91C1C; }}
</style>
</head>
<body>
  <div class="wrap">
    <div class="eyebrow">{eyebrow}</div>
    <h1>{title}</h1>
    <div class="bar"></div>
    <p class="lead">{lead}</p>
    <div class="chain">{chain}</div>
  </div>
  <div class="domain">{domain}</div>
  <div class="foot"></div>
</body>
</html>
"""

CHROME_PATHS = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'chromium', 'chromium-browser',
]


def chrome():
    for candidate in [os.environ.get('CHROME')] + CHROME_PATHS:
        if candidate and (Path(candidate).is_file() or shutil.which(candidate)):
            return candidate
    raise SystemExit('Chrome not found. Set CHROME to its path.')


def chain_html(step):
    parts = []
    for i, name in enumerate(CHAIN, 1):
        item = f'<b>{i:02d}</b> {name}'
        parts.append(f'<span class="on">{item}</span>' if i == step else item)
    return ' &nbsp;·&nbsp; '.join(parts)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('card', nargs='?', default='hub', choices=sorted(CARDS))
    parser.add_argument('--out', type=Path, help='where to write the PNG (required for docs-host cards)')
    args = parser.parse_args()

    card = CARDS[args.card]
    out = args.out or card['out']
    if out is None:
        raise SystemExit(f'the {args.card} card is committed in its own repository: pass --out')
    html = CARD.format(
        eyebrow=card['eyebrow'], title=card['title'], lead=card['lead'], domain=card['domain'],
        chain=chain_html(card['step']),
        # One line at 1020px wide: long names step down rather than wrap.
        title_size=118 if len(card['title']) <= 12 else 84,
    )
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / 'og-card.html'
        page.write_text(html, encoding='utf-8')
        subprocess.run([chrome(), '--headless=new', '--disable-gpu', '--hide-scrollbars',
                        '--force-device-scale-factor=1', '--window-size=1200,630',
                        f'--screenshot={Path(out).resolve()}', page.as_uri()], check=True, capture_output=True)
    print(f'wrote {out}')


if __name__ == '__main__':
    sys.exit(main())
