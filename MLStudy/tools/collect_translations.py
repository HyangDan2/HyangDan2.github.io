#!/usr/bin/env python3
"""Append new Korean source strings without changing existing catalog IDs."""

from pathlib import Path
from html.parser import HTMLParser
import json, re
from localize_documents import map_prose, map_python

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'i18n/strings.json'
strings = json.loads(path.read_text()) if path.exists() else []


def collect(value):
    key = value.strip()
    if re.search('[가-힣]', key) and key not in strings:
        strings.append(key)
    return value


class Extract(HTMLParser):
    def handle_data(self, data):
        collect(data)

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('alt', 'title', 'aria-label', 'content') and value:
                collect(value)


# Use the generated Korean edition after a build; initial authoring HTML is also Korean.
base = ROOT / 'i18n/source-html' if (ROOT / 'i18n/source-html/main.html').exists() else ROOT
for source in [
    base / 'main.html',
    *[
        p
        for folder in ('chapters', 'labs', 'appendix')
        for p in sorted((base / folder).glob('*.html'))
    ],
    base / 'index.html',
]:
    Extract().feed(source.read_text())
for source in (ROOT / 'i18n/source-js').glob('*.js'):
    for match in re.finditer(r"'((?:\\.|[^'\\])*)'", source.read_text()):
        if re.search('[가-힣]', match[1]):
            Extract().feed(match[1])
for source in (ROOT / 'i18n/source-docs').rglob('*.md'):
    map_prose(source.read_text(), collect)
for source in (ROOT / 'i18n/source-downloads').iterdir():
    if source.suffix == '.py':
        map_python(source.read_text(), collect)
    elif source.suffix == '.ipynb':
        for cell in json.loads(source.read_text())['cells']:
            (map_prose if cell['cell_type'] == 'markdown' else map_python)(
                ''.join(cell['source']), collect
            )
path.write_text(json.dumps(strings, ensure_ascii=False, indent=2) + '\n')
print('Source strings:', len(strings))
