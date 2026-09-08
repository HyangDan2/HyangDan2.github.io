#!/usr/bin/env python3
"""Check the shared favicon on every published page and in the deployment bundle."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import json

ROOT = Path(__file__).resolve().parents[2]


class Icons(HTMLParser):
    def __init__(self):
        super().__init__()
        self.icons = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'icon' in attrs.get('rel', '').split():
            self.icons.append(attrs)


def check(page, icon):
    parser = Icons()
    parser.feed(page.read_text())
    assert len(parser.icons) == 1, (page, parser.icons)
    link = parser.icons[0]
    assert link.get('type') == 'image/svg+xml', page
    url = urlsplit(link['href'])
    assert not url.scheme and not url.netloc and not url.path.startswith('/'), page
    assert (page.parent / url.path).resolve() == icon.resolve(), (page, url.path)
    assert icon.is_file(), icon


pages = [*ROOT.glob('*.html'), *(ROOT / 'analysis').rglob('*.html')]
for edition in [ROOT / 'MLStudy', ROOT / 'MLStudy/ko', ROOT / 'MLStudy/ja']:
    pages.extend(edition.glob('*.html'))
    for folder in ['chapters', 'labs', 'appendix']:
        pages.extend((edition / folder).glob('*.html'))
for page in pages:
    check(page, ROOT / 'assets/favicon.svg')
assert not (ROOT / 'MLStudy/assets/images/favicon.svg').exists()

bundle = ROOT / 'output/hd2lab-webhq-site'
packaged = list((bundle / 'MLStudy').rglob('*.html')) if bundle.exists() else []
for page in packaged:
    check(page, bundle / 'assets/favicon.svg')
if packaged:
    assert (bundle / 'assets/favicon.svg').read_bytes() == (
        ROOT / 'assets/favicon.svg'
    ).read_bytes()
print(json.dumps({'status': 'passed', 'pages': len(pages), 'packaged_pages': len(packaged)}))
