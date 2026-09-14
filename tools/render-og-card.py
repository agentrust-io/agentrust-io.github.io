"""Render /og.png, the 1200x630 social card for agentrust-io.com, with headless Chrome.

    python tools/render-og-card.py            # writes og.png
    CHROME=/path/to/chrome python tools/render-og-card.py

The card is HTML so its words can change with an edit, not a lost design file.
It lives here rather than as a page because every *.html in the repository is a
published page to check-site.py and the sitemap. Keep the words in step with the
homepage hero and with the og:image:alt text the pages use; colours are the brand
navy and red from brand/BRAND.md.

No --check: a PNG rendered on another machine differs in font hinting, so commit
the rendered file and review it by eye.
"""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]

EYEBROW = 'Open specifications for verifiable AI'
TITLE = 'AgenTrust'
LEAD = 'Prove what your AI ran, and what it did.'
CHAIN = ['Weights', 'Agent', 'Actions', 'Evidence']
DOMAIN = 'agentrust-io.com'

CARD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  html, body {{ margin: 0; width: 1200px; height: 630px; overflow: hidden; }}
  body {{ background: #15294B; color: #FFFEFA; position: relative; font-family: Inter, "Segoe UI", ui-sans-serif, sans-serif; }}
  .wrap {{ position: absolute; left: 90px; right: 90px; top: 84px; }}
  .eyebrow {{ font-size: 25px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #9FB3D1; }}
  h1 {{ font-size: 118px; font-weight: 700; margin: 26px 0 0; letter-spacing: -.01em; line-height: 1; }}
  .bar {{ width: 120px; height: 9px; background: #B91C1C; margin: 38px 0 34px; }}
  .lead {{ font-size: 44px; line-height: 1.2; color: #E9E4D8; margin: 0; }}
  .chain {{ margin-top: 30px; font-size: 27px; color: #9FB3D1; letter-spacing: .01em; }}
  .chain b {{ color: #FFFEFA; font-weight: 600; }}
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


def main():
    chain = ' &nbsp;·&nbsp; '.join(f'<b>{i:02d}</b> {step}' for i, step in enumerate(CHAIN, 1))
    html = CARD.format(eyebrow=EYEBROW, title=TITLE, lead=LEAD, chain=chain, domain=DOMAIN)
    with tempfile.TemporaryDirectory() as tmp:
        card = Path(tmp) / 'og-card.html'
        card.write_text(html, encoding='utf-8')
        out = ROOT / 'og.png'
        subprocess.run([chrome(), '--headless=new', '--disable-gpu', '--hide-scrollbars',
                        '--force-device-scale-factor=1', '--window-size=1200,630',
                        f'--screenshot={out}', card.as_uri()], check=True, capture_output=True)
    print(f'wrote {out.relative_to(ROOT)}')


if __name__ == '__main__':
    sys.exit(main())
