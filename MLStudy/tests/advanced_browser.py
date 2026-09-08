#!/usr/bin/env python3
"""Readability and static-image checks for advanced cases. Requires Playwright."""

from pathlib import Path
import json
import sys
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
package = '--package' in sys.argv
SITE = ROOT.parent / 'output/hd2lab-site' if package else ROOT
errors = []
checks = 0
images = 0
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in [390] if package else [1440, 390, 320]:
        context = browser.new_context(
            viewport={'width': width, 'height': 960}, reduced_motion='reduce'
        )
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        for path in sorted((SITE / 'chapters').glob('*.html')):
            page.goto(path.as_uri())
            expect(page.locator('section[id^="advanced-"]')).to_have_count(3)
            expect(page.locator('.advanced-figure')).to_have_count(4)
            for image in page.locator('.advanced-figure img').all():
                image.scroll_into_view_if_needed()
                expect(image).to_be_visible()
                expect(image).to_have_js_property('complete', True)
                assert image.evaluate('img => img.naturalWidth > 0'), (path, 'unloaded image')
                images += 1
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), (
                width,
                path,
                'overflow',
            )
            page.locator('.worked-code summary').first.click()
            assert page.locator('.worked-code').first.get_attribute('open') is not None
            if width < 700:
                scroll = page.locator('.advanced-figure .graph-scroll').first
                scroll.scroll_into_view_if_needed()
                scroll.focus()
                page.keyboard.press('ArrowRight')
                expect(scroll).to_be_focused()
                page.wait_for_timeout(150)
                assert scroll.evaluate('e => e.scrollLeft > 0'), (path, 'keyboard graph scroll')
            if width == 1440:
                figure = page.locator('.advanced-figure').first
                figure.screenshot(path=str(ROOT / 'docs' / f'advanced-{path.stem[:2]}-desktop.png'))
            if width == 390 and path.name.startswith('02-'):
                page.locator('#advanced-b').evaluate("e => e.scrollIntoView({behavior:'instant'})")
                page.screenshot(path=str(ROOT / 'docs/advanced-regression-mobile.png'))
            checks += 1
        context.close()
    nojs = browser.new_context(
        java_script_enabled=False, viewport={'width': 390, 'height': 960}, reduced_motion='reduce'
    )
    page = nojs.new_page()
    for path in sorted((SITE / 'chapters').glob('*.html')):
        page.goto(path.as_uri())
        page.locator('a[href="#advanced-a"]').first.click()
        expect(page).to_have_url(path.as_uri() + '#advanced-a')
        for image in page.locator('.advanced-figure img').all():
            image.evaluate("img => img.scrollIntoView({behavior:'instant',block:'center'})")
            expect(image).to_have_js_property('complete', True)
            # Browser DOM inspection still works with page scripts disabled.
            assert image.evaluate('img => img.complete && img.naturalWidth > 0')
        assert page.locator('.reproduce-box a[download]').count() == 4
        checks += 1
    nojs.close()
    if package:
        page = browser.new_page()
        for path in sorted((SITE / 'chapters').glob('*.html')):
            page.goto(
                'http://127.0.0.1:8765/output/hd2lab-webhq-site/MLStudy/chapters/' + path.name
            )
            for image in page.locator('.advanced-figure img').all():
                image.scroll_into_view_if_needed()
                expect(image).to_have_js_property('complete', True)
                assert image.evaluate('img => img.naturalWidth > 0')
            checks += 1
    browser.close()
assert not errors, errors
result = dict(
    mode='package' if package else 'source',
    page_checks=checks,
    loaded_images=images,
    javascript_errors=errors,
)
(
    ROOT / 'docs' / ('advanced-package-check.json' if package else 'advanced-browser-check.json')
).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
