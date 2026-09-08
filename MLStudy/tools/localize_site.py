#!/usr/bin/env python3
"""Compile reviewed local translation catalogs into static pages. No network required."""

from pathlib import Path
from html.parser import HTMLParser
from html import escape
from urllib.parse import urlsplit
import json, re, shutil

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = {'en': 'English', 'ko': '한국어', 'ja': '日本語'}
PAGE_PATHS = ['main.html'] + [
    str(p.relative_to(ROOT))
    for folder in ('chapters', 'labs', 'appendix')
    for p in sorted((ROOT / folder).glob('*.html'))
]


def catalogs():
    sources = json.loads((ROOT / 'i18n/strings.json').read_text())
    result = {lang: {} for lang in ('en', 'ja')}
    auto = ROOT / 'i18n/translations.json'
    if auto.exists():
        for key, values in json.loads(auto.read_text()).items():
            for lang in result:
                result[lang][sources[int(key)]] = values[lang]
    for line in (ROOT / 'i18n/translations.tsv').read_text().splitlines():
        if not line:
            continue
        key, en, ja = line.split('\t')
        result['en'][sources[int(key)]] = en
        result['ja'][sources[int(key)]] = ja
    reviewed = ROOT / 'i18n/reviewed.json'
    if reviewed.exists():
        for key, values in json.loads(reviewed.read_text()).items():
            for lang, value in values.items():
                result[lang][sources[int(key)]] = value
    return result


class LocalizedHTML(HTMLParser):
    def __init__(self, lang, prefix, translations):
        super().__init__(convert_charrefs=True)
        self.lang, self.prefix, self.translations = lang, prefix, translations
        self.parts = []

    def translate(self, value):
        key = value.strip()
        if key in self.translations:
            return (
                value[: len(value) - len(value.lstrip())]
                + self.translations[key]
                + value[len(value.rstrip()) :]
            )
        if self.lang != 'ko' and re.search('[가-힣]', value):
            raise ValueError('Missing translation: ' + value[:160])
        return value

    def handle_decl(self, value):
        self.parts.append('<!' + value + '>')

    def handle_comment(self, value):
        self.parts.append('<!--' + value + '-->')

    def handle_entityref(self, name):
        self.parts.append('&' + name + ';')

    def handle_charref(self, name):
        self.parts.append('&#' + name + ';')

    def handle_starttag(self, tag, attrs):
        out = []
        for key, value in attrs:
            if tag == 'html' and key == 'lang':
                value = self.lang
            elif key in ('alt', 'title', 'aria-label') or (tag == 'meta' and key == 'content'):
                value = self.translate(value or '')
            elif (
                key in ('href', 'src')
                and self.lang != 'en'
                and value
                and re.match(r'(?:\.\./)*assets/(?:css|images)/', value)
            ):
                value = '../' + value
            out.append(key if value is None else f'{key}="{escape(value, quote=True)}"')
        self.parts.append('<' + tag + (' ' + ' '.join(out) if out else '') + '>')

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.parts[-1] = self.parts[-1][:-1] + '/>'

    def handle_endtag(self, tag):
        self.parts.append('</' + tag + '>')

    def handle_data(self, data):
        self.parts.append(escape(self.translate(data), quote=False))


def build():
    translations = catalogs()
    originals = {p: (ROOT / 'i18n/source-html' / p).read_text() for p in PAGE_PATHS}
    if any('lang="ko"' not in source for source in originals.values()):
        raise ValueError('Run render_site.py to regenerate the Korean authoring input first.')
    # Validate every page before replacing any existing localized HTML.
    for lang in ('en', 'ja'):
        for path, source in originals.items():
            check = LocalizedHTML(lang, '', translations[lang])
            check.feed(source)
    labels = {
        'en': ('Language', 'Dark mode', 'Back to Web-HQ'),
        'ko': ('언어', '다크 모드', 'Web-HQ로 돌아가기'),
        'ja': ('言語', 'ダークモード', 'Web-HQに戻る'),
    }
    for lang in LANGUAGES:
        base = ROOT if lang == 'en' else ROOT / lang
        for path, source in originals.items():
            prefix = '../' if '/' in path else ''
            to_root = prefix + ('' if lang == 'en' else '../')
            parser = LocalizedHTML(lang, prefix, translations.get(lang, {}))
            parser.feed(source)
            html = ''.join(parser.parts)
            html = re.sub(
                r'<link rel="icon"[^>]*>',
                f'<link rel="icon" type="image/svg+xml" href="{to_root}../assets/favicon.svg">',
                html,
            )
            links = ''.join(
                f'<a href="{to_root}{"" if code == "en" else code + "/"}{path}" lang="{code}" hreflang="{code}" data-language="{code}"'
                + (' aria-current="true"' if code == lang else '')
                + f'>{name}</a>'
                for code, name in LANGUAGES.items()
            )
            ui = f'<div class="preferences"><nav class="language-switch" aria-label="{labels[lang][0]}">{links}</nav><button type="button" class="theme-toggle" data-theme-toggle aria-pressed="false" hidden>{labels[lang][1]}</button></div>'
            html = html.replace(
                '</nav></div></header>',
                f'<a class="hq-link" href="{to_root}../index.html">← Web-HQ</a></nav>{ui}</div></header>',
                1,
            )
            html = html.replace('<html ', f'<html data-language="{lang}" ', 1)
            html = html.replace(
                '</head>', f'<script src="{to_root}assets/js/preferences.js"></script></head>'
            )
            target = base / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(html)
        (base / 'assets/js').mkdir(parents=True, exist_ok=True)
        for source in (ROOT / 'i18n/source-js').glob('*.js'):
            code = source.read_text()
            if lang != 'ko':
                # Translate only quoted string contents; preserve JS syntax and calculations.
                def replace_literal(match):
                    literal = match[1]
                    if not re.search('[가-힣]', literal):
                        return match[0]
                    if '<' in literal:
                        p = LocalizedHTML(lang, '', translations[lang])
                        p.feed(literal)
                        translated = ''.join(p.parts)
                    else:
                        translated = LocalizedHTML(lang, '', translations[lang]).translate(literal)
                    return (
                        "'"
                        + translated.replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r")
                        + "'"
                    )

                code = re.sub(r"'((?:\\.|[^'\\])*)'", replace_literal, code)
            (base / 'assets/js' / source.name).write_text(code)
        for name in ('navigation.js', 'svm-core.js'):
            if lang != 'en':
                shutil.copyfile(ROOT / 'assets/js' / name, base / 'assets/js' / name)
    for lang in LANGUAGES:
        base = ROOT if lang == 'en' else ROOT / lang
        title = {'en': 'Machine Learning Studies', 'ko': '머신러닝 공부', 'ja': '機械学習の学習'}[
            lang
        ]
        script = (
            '<script src="assets/js/entry.js"></script>'
            if lang == 'en'
            else '<meta http-equiv="refresh" content="0;url=main.html">'
        )
        (base / 'index.html').write_text(
            f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} | HD2Lab</title><link rel="icon" type="image/svg+xml" href="{"../" if lang == "en" else "../../"}assets/favicon.svg">{script}</head><body><p><a href="main.html">{title} →</a></p></body></html>'
        )
    from localize_documents import build_documents

    build_documents(translations)
    from format_sources import format_sources

    format_sources()
    print('Localized 16 content pages × 3 languages, entry pages, documents and downloads.')


if __name__ == '__main__':
    build()
