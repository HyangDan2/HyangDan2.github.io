#!/usr/bin/env python3
"""Audit language routes, translated content, download execution parity, and local links."""

from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import ast, json, re, sys

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []
        self.switches = {}
        self.lang = None
        self.text = []
        self.h1 = 0
        self.scripts = []
        self.equations = []
        self.tables = []
        self.math_depth = 0
        self.table_depth = 0
        self.math_text = []
        self.table_text = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'div' and ('equation' in a.get('class', '').split() or self.math_depth):
            self.math_depth += 1
        if tag == 'table':
            self.table_depth += 1
        if tag == 'html':
            self.lang = a.get('lang')
        if tag == 'h1':
            self.h1 += 1
        if 'id' in a:
            self.ids.append(a['id'])
        if tag in ('a', 'link') and a.get('href'):
            self.links.append(a['href'])
        if tag in ('img', 'script') and a.get('src'):
            self.links.append(a['src'])
        if tag == 'a' and a.get('data-language'):
            self.switches[a['data-language']] = a['href']

    def handle_data(self, data):
        if data.strip() != '한국어':
            self.text.append(data)
        if self.math_depth:
            self.math_text.append(data)
        if self.table_depth:
            self.table_text.append(data)

    def handle_endtag(self, tag):
        if tag == 'div' and self.math_depth:
            self.math_depth -= 1
            if not self.math_depth:
                self.equations.append(''.join(self.math_text))
                self.math_text = []
        if tag == 'table' and self.table_depth:
            self.table_depth -= 1
            if not self.table_depth:
                self.tables.append(' '.join(self.table_text))
                self.table_text = []


pages = {}
for base, lang in [(ROOT, 'en'), (ROOT / 'ko', 'ko'), (ROOT / 'ja', 'ja')]:
    for rel in [
        'index.html',
        'main.html',
        *[
            str(p.relative_to(ROOT))
            for d in ('chapters', 'labs', 'appendix')
            for p in sorted((ROOT / d).glob('*.html'))
        ],
    ]:
        path = base / rel
        p = Page()
        p.feed(path.read_text())
        pages[path.resolve()] = p
        assert p.lang == lang, (path, p.lang)
        assert len(p.ids) == len(set(p.ids)), path
        if rel != 'index.html':
            assert p.h1 == 1, path
            assert set(p.switches) == {'en', 'ko', 'ja'}, path
            for code, href in p.switches.items():
                expected = (ROOT if code == 'en' else ROOT / code) / rel
                assert (path.parent / href).resolve() == expected.resolve(), (path, href)
            assert any(
                (path.parent / urlsplit(h).path).resolve() == (ROOT.parent / 'index.html').resolve()
                for h in p.links
            ), path
        if lang != 'ko':
            assert not re.search('[가-힣]', ''.join(p.text)), path
for path, p in pages.items():
    for href in p.links:
        u = urlsplit(href)
        if u.scheme or u.netloc:
            continue
        assert not u.path.startswith('/'), (path, href)
        target = (path.parent / unquote(u.path)).resolve() if u.path else path
        assert target.exists(), (path, href)
        if u.fragment and target in pages:
            assert unquote(u.fragment) in pages[target].ids, (path, href)
for rel in [
    'main.html',
    *[
        str(p.relative_to(ROOT))
        for d in ('chapters', 'labs', 'appendix')
        for p in (ROOT / d).glob('*.html')
    ],
]:
    assert (
        pages[(ROOT / rel).resolve()].ids
        == pages[(ROOT / 'ko' / rel).resolve()].ids
        == pages[(ROOT / 'ja' / rel).resolve()].ids
    ), rel


# Equation and table numerals must retain their order across editions.
def numerals(text):
    return re.findall(r'[-−]?\d+(?:\.\d+)?', text)


for path, english in pages.items():
    if '/ko/' in str(path) or '/ja/' in str(path) or path.name == 'index.html':
        continue
    relative = path.relative_to(ROOT)
    for lang in ['ko', 'ja']:
        other = pages[(ROOT / lang / relative).resolve()]
        assert list(map(numerals, english.equations)) == list(map(numerals, other.equations)), (
            relative,
            lang,
            'equation numerals',
        )
        assert list(map(numerals, english.tables)) == list(map(numerals, other.tables)), (
            relative,
            lang,
            'table numerals',
        )


# Ignore only docstrings: executable Python ASTs and notebook outputs must be unchanged.
class StripDocs(ast.NodeTransformer):
    def visit_Expr(self, node):
        if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            return None
        return node


def tree(source):
    return ast.dump(StripDocs().visit(ast.parse(source)))


for source in (ROOT / 'i18n/source-downloads').glob('*.py'):
    for base in [ROOT, ROOT / 'ko', ROOT / 'ja']:
        assert tree(source.read_text()) == tree((base / 'downloads' / source.name).read_text()), (
            base,
            source,
        )
for source in (ROOT / 'i18n/source-downloads').glob('*.ipynb'):
    original = json.loads(source.read_text())
    for base in [ROOT, ROOT / 'ko', ROOT / 'ja']:
        nb = json.loads((base / 'downloads' / source.name).read_text())
        assert len(nb['cells']) == len(original['cells'])
        for a, b in zip(original['cells'], nb['cells']):
            if a['cell_type'] == 'code':
                assert tree(''.join(a['source'])) == tree(''.join(b['source'])) and a.get(
                    'outputs'
                ) == b.get('outputs'), (base, source)

# Check public documentation links, excluding archived authoring sources.
for base in [ROOT, ROOT / 'ko', ROOT / 'ja']:
    for document in [
        base / 'README.md',
        base / 'harnessguide.md',
        *sorted((base / 'docs').glob('*.md')),
    ]:
        text = document.read_text()
        for href in re.findall(r'\]\(([^)]+)\)', text):
            u = urlsplit(href)
            if u.scheme or u.netloc:
                continue
            assert (document.parent / unquote(u.path)).resolve().exists(), (document, href)
# Authoring sources and edition copies follow the same English documentation policy.
for document in ROOT.rglob('*.md'):
    if 'node_modules' in document.relative_to(ROOT).parts:
        continue
    assert not re.search('[가-힣\u3040-\u30ff\u3400-\u9fff]', document.read_text()), (
        document,
        'non-English documentation',
    )

print(
    json.dumps(
        {
            'status': 'passed',
            'pages': len(pages),
            'checks': [
                'languages',
                'same-page switches',
                'anchors',
                'local links',
                'Web-HQ return',
                'no Korean in English/Japanese body',
                'Python AST parity',
                'notebook output parity',
                'equation/table numerals',
                'documentation links',
                'English-only Markdown',
            ],
        }
    )
)
