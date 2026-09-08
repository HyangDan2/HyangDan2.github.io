#!/usr/bin/env python3
"""Publish English documentation and localize download prose without changing execution."""

from pathlib import Path
import json, re, tokenize, io, copy, os

ROOT = Path(__file__).resolve().parents[1]


def map_prose(text, translate):
    # Preserve fenced code, inline code, link destinations, and table structure.
    out = []
    fence = False
    for line in text.splitlines(keepends=True):
        if re.match(r'\s*(~~~|```)', line):
            fence = not fence
            out.append(line)
            continue
        if fence:
            if '#' in line and re.search('[가-힣]', line.split('#', 1)[1]):
                a, b = line.split('#', 1)
                line = a + '# ' + translate(b.strip()) + ('\n' if line.endswith('\n') else '')
            out.append(line)
            continue
        parts = re.split(r'(`[^`]+`|\[[^\]]*\]\([^)]*\)|\|)', line)
        chunks = []
        for part in parts:
            if part.startswith('`') or part == '|':
                chunks.append(part)
                continue
            match = re.fullmatch(r'\[([^\]]*)\]\(([^)]*)\)', part)
            if match:
                chunks.append('[' + translate(match[1]) + '](' + match[2] + ')')
                continue
            prefix = re.match(r'^(\s*(?:#{1,6} |[-*] |\d+\. )?)', part)[0]
            body = part[len(prefix) :]
            end = body[len(body.rstrip()) :]
            body = body.rstrip()
            chunks.append(prefix + translate(body) + end)
        out.append(''.join(chunks))
    return ''.join(out)


def map_python(text, translate):
    # Token spans allow changes to comments and docstrings without changing execution.
    tokens = []
    for token in tokenize.generate_tokens(io.StringIO(text).readline):
        if token.type == tokenize.COMMENT:
            token = token._replace(string='# ' + translate(token.string[1:].strip()))
        elif token.type == tokenize.STRING and re.search('[가-힣]', token.string):
            if token.string.startswith(('"""', "'''")):
                q = token.string[:3]
                token = token._replace(
                    string=q + '\n'.join(translate(s) for s in token.string[3:-3].split('\n')) + q
                )
        tokens.append(token)
    return tokenize.untokenize(tokens)


def build_documents(catalog):
    for lang in ('en', 'ko', 'ja'):
        base = ROOT if lang == 'en' else ROOT / lang

        def tr(value):
            key = value.strip()
            if not re.search('[가-힣]', key):
                return value
            translated = key if lang == 'ko' else catalog[lang].get(key)
            if translated is None:
                raise ValueError('Missing document translation: ' + key)
            return (
                value[: len(value) - len(value.lstrip())]
                + translated
                + value[len(value.rstrip()) :]
            )

        # English is canonical for documentation, regardless of the website edition.
        sources = {
            p.relative_to(ROOT / 'i18n/source-docs'): p
            for p in (ROOT / 'i18n/source-docs').rglob('*.md')
        }
        overrides = ROOT / 'i18n/document-overrides/en'
        sources.update({p.relative_to(overrides): p for p in overrides.rglob('*.md')})
        for relative, source in sorted(sources.items()):
            target = base / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            text = source.read_text()
            if lang != 'en' and source.is_relative_to(overrides):
                mirror = ROOT / 'i18n/document-overrides' / lang / relative
                mirror.parent.mkdir(parents=True, exist_ok=True)
                mirror.write_text(text)
            if str(relative) == 'docs/progress.md':
                notes = ROOT / 'i18n/progress-notes.json'
                if notes.exists():
                    text = json.loads(notes.read_text())['en'] + text
            if lang != 'en':

                def shared_link(m):
                    destination = m[1]
                    original = (ROOT / relative.parent / destination).resolve()
                    if original.exists() and (
                        not original.is_relative_to(ROOT) or original.suffix in ('.json', '.png')
                    ):
                        return '](' + os.path.relpath(original, target.parent) + ')'
                    return m[0]

                text = re.sub(r'\]\(([^)]+)\)', shared_link, text)
            links = []
            for code, label in [
                ('en', 'Main edition docs'),
                ('ko', 'Korean edition docs'),
                ('ja', 'Japanese edition docs'),
            ]:
                dest = (ROOT if code == 'en' else ROOT / code) / relative
                links.append(f'[{label}]({os.path.relpath(dest, target.parent)})')
            target.write_text(' | '.join(links) + '\n\n' + text)
        for source in (ROOT / 'i18n/source-downloads').iterdir():
            target = base / 'downloads' / source.name
            target.parent.mkdir(parents=True, exist_ok=True)
            if source.suffix == '.py':
                target.write_text(map_python(source.read_text(), tr))
            elif source.suffix == '.ipynb':
                nb = json.loads(source.read_text())
                for cell in nb['cells']:
                    text = ''.join(cell['source'])
                    if cell['cell_type'] == 'markdown':
                        text = map_prose(text, tr)
                    elif cell['cell_type'] == 'code':
                        text = map_python(text, tr)
                    cell['source'] = text.splitlines(keepends=True)
                nb.setdefault('metadata', {})['language'] = lang
                target.write_text(json.dumps(nb, ensure_ascii=False, indent=2) + '\n')
            else:
                target.write_bytes(source.read_bytes())
