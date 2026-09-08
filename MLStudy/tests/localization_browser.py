#!/usr/bin/env python3
"""Real-browser regression test; use an isolated headless browser profile."""

from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('MLSTUDY_TEST_URL', 'http://127.0.0.1:8765/MLStudy/')
with sync_playwright() as p:
    options = {'headless': True}
    if os.environ.get('MLSTUDY_CHROME'):
        options['executable_path'] = os.environ['MLSTUDY_CHROME']
    browser = p.chromium.launch(**options)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, color_scheme='light')
    page = context.new_page()
    errors = []
    failures = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: failures.append(r.url) if r.status >= 400 else None)
    page.goto(BASE + 'index.html')
    expect(page.locator('html')).to_have_attribute('lang', 'en')
    expect(page.locator('html')).to_have_attribute('data-theme', 'light')
    page.locator('[data-theme-toggle]').click()
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
    page.locator('a[href="chapters/01-data-and-models.html"]').first.click()
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
    page.goto(page.url + '#advanced-a')
    for lang in ['ja', 'ko', 'en']:
        page.locator(f'a[data-language="{lang}"]').click()
        expect(page.locator('html')).to_have_attribute('lang', lang)
        assert page.url.endswith('/chapters/01-data-and-models.html#advanced-a'), page.url
    page.locator('a[data-language="ja"]').click()
    page.goto(BASE + 'index.html')
    expect(page.locator('html')).to_have_attribute('lang', 'ja')
    for lang in ['en', 'ko', 'ja']:
        prefix = '' if lang == 'en' else lang + '/'
        for lab in ['regression', 'gradient-descent', 'pca', 'clustering', 'svm']:
            page.goto(BASE + prefix + 'labs/' + lab + '.html')
            expect(page.locator('[data-lab] input').first).to_be_enabled()
            before = page.locator('#metrics').inner_text()
            slider = page.locator('[data-lab] input[type=range]').first
            slider.focus()
            slider.press('ArrowRight')
            page.wait_for_timeout(300)
            assert page.locator('#status').inner_text().strip()
            page.locator('[type=reset]').click()
            page.wait_for_timeout(300)
            assert page.locator('#metrics').inner_text() == before, (lang, lab)
            if lang != 'ko':
                assert not __import__('re').search(
                    '[가-힣]', page.locator('body').inner_text().replace('한국어', '')
                ), (lang, lab)
    for width in [1440, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 900})
        for lang in ['en', 'ko', 'ja']:
            prefix = '' if lang == 'en' else lang + '/'
            page.goto(BASE + prefix + 'main.html')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), (
                width,
                lang,
            )
            if width in [1440, 390]:
                page.screenshot(
                    path=str(ROOT / 'docs' / f'localization-{lang}-{width}-dark.png'),
                    full_page=True,
                )
    content_checks = 0
    for width in [1440, 320]:
        page.set_viewport_size({'width': width, 'height': 900})
        for lang in ['en', 'ko', 'ja']:
            prefix = '' if lang == 'en' else lang + '/'
            for folder in ['chapters', 'appendix']:
                for source in sorted((ROOT / folder).glob('*.html')):
                    page.goto(BASE + prefix + folder + '/' + source.name)
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), (
                        width,
                        lang,
                        source.name,
                    )
                    for figure in page.locator('.advanced-figure img').all():
                        figure.scroll_into_view_if_needed()
                        expect(figure).to_have_js_property('complete', True)
                        assert figure.evaluate('image => image.naturalWidth > 0'), (
                            lang,
                            source.name,
                        )
                    if source.name.startswith('01-'):
                        page.locator('h1').scroll_into_view_if_needed()
                        page.screenshot(
                            path=str(
                                ROOT / 'docs' / f'localization-chapter-{lang}-{width}-dark.png'
                            )
                        )
                    content_checks += 1
    page.locator('.hq-link').click()
    expect(page.locator('h1')).to_contain_text('HD2Lab')
    page.locator('a[href="MLStudy/index.html"]').click()
    expect(page.locator('html')).to_have_attribute('lang', 'ja')
    context.close()
    system = browser.new_context(color_scheme='dark')
    system_page = system.new_page()
    system_page.goto(BASE + 'main.html')
    expect(system_page.locator('html')).to_have_attribute('data-theme', 'dark')
    system.close()
    blocked = browser.new_context(color_scheme='light')
    blocked.add_init_script(
        "Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked for test'); } });"
    )
    blocked_page = blocked.new_page()
    blocked_page.goto(BASE + 'main.html')
    blocked_page.locator('[data-theme-toggle]').click()
    expect(blocked_page.locator('html')).to_have_attribute('data-theme', 'dark')
    blocked_page.locator('a[data-language=ja]').click()
    expect(blocked_page.locator('html')).to_have_attribute('lang', 'ja')
    blocked.close()
    nojs = browser.new_context(java_script_enabled=False, color_scheme='light')
    page = nojs.new_page()
    for lang in ['en', 'ko', 'ja']:
        prefix = '' if lang == 'en' else lang + '/'
        page.goto(BASE + prefix + 'labs/svm.html')
        expect(page.locator('h1')).to_be_visible()
        expect(page.locator('#primary-plot svg')).to_be_visible()
        expect(page.locator('[data-lab] input').first).to_be_disabled()
        page.locator('a[data-language="en"]').click()
        expect(page.locator('html')).to_have_attribute('lang', 'en')
    browser.close()
    assert not errors, errors
    assert not failures, failures
    result = {
        'status': 'passed',
        'languageLabChecks': 15,
        'viewportChecks': 9,
        'contentViewportChecks': content_checks,
        'noJavaScriptLanguages': 3,
        'javascriptErrors': errors,
        'httpFailures': failures,
    }
    (ROOT / 'docs/localization-browser-check.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
