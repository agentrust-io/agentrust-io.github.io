"""Check local HTML destinations, fragments, IDs, and structured data."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.duplicates = set(), [], []
        self.structured, self.json_text = [], None
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            if attrs["id"] in self.ids:
                self.duplicates.append(attrs["id"])
            self.ids.add(attrs["id"])
        if tag in ("a", "link", "script", "img"):
            target = attrs.get("href", attrs.get("src"))
            if target:
                self.links.append(target)
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.json_text = ""

    def handle_data(self, data):
        if self.json_text is not None:
            self.json_text += data

    def handle_endtag(self, tag):
        if tag == "script" and self.json_text is not None:
            self.structured.append(json.loads(self.json_text))
            self.json_text = None


pages = {p: Page(p) for p in ROOT.rglob("*.html") if ".git" not in p.parts}
errors = []
checked = 0
for path, page in pages.items():
    errors.extend(f"{path.relative_to(ROOT)}: duplicate id {id}" for id in page.duplicates)
    for href in page.links:
        url = urlsplit(href)
        if url.scheme and url.scheme not in ("http", "https"):
            continue
        if url.netloc and url.netloc != "agentrust-io.com":
            continue
        if not url.path:
            dest = path
        else:
            dest = (ROOT / unquote(url.path).lstrip("/") if url.path.startswith("/")
                    else path.parent / unquote(url.path)).resolve()
        if dest.is_dir():
            dest /= "index.html"
        checked += 1
        if not dest.is_file():
            errors.append(f"{path.relative_to(ROOT)}: missing destination {href}")
        elif url.fragment and dest in pages and unquote(url.fragment) not in pages[dest].ids:
            errors.append(f"{path.relative_to(ROOT)}: missing fragment {href}")
if errors:
    raise SystemExit("\n".join(errors))
print(f"PASS {len(pages)} HTML pages; {checked} local links/assets; unique IDs and valid JSON-LD")
