#!/usr/bin/env python3
"""Local Chromium checks, no external navigation. Requires Playwright."""

from pathlib import Path
import json, os, sys
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('HD2LAB_TEST_URL', 'http://127.0.0.1:8765/MLStudy/ko/')
out = ROOT / 'docs'
pages = [str(p.relative_to(ROOT / 'ko')) for p in (ROOT / 'ko').rglob('*.html')]
errors = []
failures = []
checks = 0
if '--svm-smoke' in sys.argv:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto((ROOT.parent / 'output/hd2lab-webhq-site/MLStudy/ko/labs/svm.html').as_uri())
        expect(page.locator('#mode')).to_contain_text('수렴 확인')
        page.screenshot(path=str(out / 'svm-desktop.png'), full_page=True)
        page.locator('#logC').focus()
        page.keyboard.press('End')
        page.locator('#featureScale').focus()
        page.keyboard.press('End')
        page.locator('#standardize').uncheck()
        page.locator('#outlier').check()
        expect(page.locator('#mode')).to_contain_text('미수렴')
        page.get_by_role('button', name='기본 설정으로 초기화').click()
        expect(page.locator('#mode')).to_contain_text('수렴 확인')
        page.set_viewport_size({'width': 390, 'height': 844})
        page.screenshot(path=str(out / 'svm-mobile.png'), full_page=True)
        browser.close()
    assert not errors, errors
    print('Final SVM package: file loading, converged/unconverged banner, reset, desktop/mobile OK')
    sys.exit(0)
if '--package-smoke' in sys.argv:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('response', lambda r: failures.append(r.url) if r.status >= 400 else None)
        page.goto('http://127.0.0.1:8765/output/hd2lab-webhq-site/MLStudy/index.html')
        expect(page.locator('h1')).to_contain_text('머신러닝 공부')
        page.screenshot(path=str(out / 'desktop-preview.png'), full_page=True)
        for slug in ['regression', 'gradient-descent', 'pca', 'clustering', 'svm']:
            page.goto(
                (ROOT.parent / 'output/hd2lab-webhq-site/MLStudy/labs' / f'{slug}.html').as_uri()
            )
            expect(page.locator('#mode')).to_contain_text('실시간')
            assert page.locator('#primary-plot svg').count() == 1
        page.goto('http://127.0.0.1:8765/output/hd2lab-webhq-site/MLStudy/labs/regression.html')
        expect(page.locator('#mode')).to_contain_text('실시간')
        page.set_viewport_size({'width': 390, 'height': 844})
        page.goto('http://127.0.0.1:8765/output/hd2lab-webhq-site/MLStudy/main.html')
        page.screenshot(path=str(out / 'mobile-preview.png'), full_page=True)
        browser.close()
    assert not errors and not failures, (errors, failures)
    print('Package smoke: nested HTTP entry and lab, all five labs via file://, no errors')
    sys.exit(0)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width, height in [(1440, 1000), (390, 844), (320, 760)]:
        context = browser.new_context(
            viewport={'width': width, 'height': height}, reduced_motion='reduce'
        )
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('response', lambda r: failures.append(r.url) if r.status >= 400 else None)
        for path in pages:
            page.goto(BASE + path, wait_until='networkidle')
            expect(page.locator('h1')).to_have_count(1)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (
                width,
                path,
                'overflow',
            )
            assert page.locator('a.skip').count() == 1
            if path.startswith('labs/'):
                expect(page.locator('#mode')).to_contain_text('실시간')
                assert page.locator('#primary-plot svg').count() == 1
                assert page.locator('#secondary-plot svg').count() == 1
                assert 'NaN' not in page.locator('#metrics').inner_text()
            checks += 1
        if width == 390:
            page.goto(BASE + 'main.html')
            page.screenshot(path=str(out / 'mobile-preview.png'), full_page=True)
            page.goto(BASE + 'labs/regression.html')
            page.screenshot(path=str(out / 'mobile-lab.png'), full_page=True)
        context.close()
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + 'labs/regression.html')
    before = page.locator('#metrics').inner_text()
    page.locator('#degree').focus()
    page.keyboard.press('End')
    expect(page.locator('output[for=degree]')).to_have_text('9')
    assert before != page.locator('#metrics').inner_text()
    page.get_by_role('button', name='기본 설정으로 초기화').click()
    expect(page.locator('output[for=degree]')).to_have_text('3')
    expect(page.locator('#metrics')).to_have_text(before, use_inner_text=True)
    page.screenshot(path=str(out / 'desktop-lab.png'), full_page=True)
    page.goto(BASE + 'labs/gradient-descent.html')
    page.locator('#curvature').focus()
    page.keyboard.press('End')
    page.locator('#rate').focus()
    page.keyboard.press('End')
    expect(page.locator('#status')).to_contain_text('발산')
    page.locator('#scaled').check()
    expect(page.locator('#status')).not_to_contain_text('발산')
    page.goto(BASE + 'labs/pca.html')
    page.locator('#k').focus()
    page.keyboard.press('End')
    expect(page.locator('output[for=k]')).to_have_text('6')
    expect(page.locator('#metrics')).to_contain_text('100%')
    page.goto(BASE + 'labs/clustering.html')
    first = page.locator('#metrics').inner_text()
    page.locator('#steps').focus()
    page.keyboard.press('Home')
    expect(page.locator('output[for=steps]')).to_have_text('0')
    assert first != page.locator('#metrics').inner_text()
    page.locator('#seed').focus()
    page.keyboard.press('ArrowRight')
    expect(page.locator('output[for=seed]')).to_have_text('30')
    page.get_by_role('button', name='기본 설정으로 초기화').click()
    expect(page.locator('#metrics')).to_have_text(first, use_inner_text=True)
    page.goto(BASE + 'labs/svm.html')
    expect(page.locator('#standardize')).to_be_checked()
    before = page.locator('#metrics').inner_text()
    page.locator('#logC').focus()
    page.keyboard.press('Home')
    expect(page.locator('output[for=logC]')).to_have_text('-2')
    assert page.locator('#metrics').inner_text() != before
    page.locator('#outlier').check()
    expect(page.locator('#metrics')).to_contain_text('/ 49')
    page.locator('#standardize').uncheck()
    expect(page.locator('#status')).to_contain_text('표준화 없음')
    page.locator('#featureScale').focus()
    page.keyboard.press('End')
    expect(page.locator('output[for=featureScale]')).to_have_text('8')
    page.locator('#seed').focus()
    page.keyboard.press('ArrowRight')
    expect(page.locator('output[for=seed]')).to_have_text('18')
    page.get_by_role('button', name='기본 설정으로 초기화').click()
    expect(page.locator('#metrics')).to_have_text(before, use_inner_text=True)
    expect(page.locator('#standardize')).to_be_checked()
    assert page.locator('#experiment-details tbody td').count() == 4
    page.screenshot(path=str(out / 'svm-desktop.png'), full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(out / 'svm-mobile.png'), full_page=True)
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.goto(BASE + 'chapters/05-pca-and-svd.html')
    page.screenshot(path=str(out / 'desktop-chapter.png'), full_page=True)
    page.locator('details.answer').first.locator('summary').click()
    assert page.locator('details.answer').first.get_attribute('open') is not None
    page.goto(BASE + 'main.html')
    page.keyboard.press('Tab')
    assert page.evaluate('document.activeElement.className') == 'skip'
    page.keyboard.press('Enter')
    assert page.evaluate('document.activeElement.id') == 'content'
    context.close()
    nojs = browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 844})
    page = nojs.new_page()
    for slug in ['regression', 'gradient-descent', 'pca', 'clustering', 'svm']:
        page.goto(BASE + 'labs/' + slug + '.html')
        expect(page.locator('#mode')).to_contain_text('사전 계산')
        assert page.locator('#primary-plot svg').count() == 1
        assert page.locator('#metrics strong').count() == (6 if slug == 'svm' else 3)
    page.goto(BASE + 'chapters/04-probability-and-inference.html')
    assert page.locator('.equation').count() >= 5
    page.locator('details.answer').first.locator('summary').click()
    assert page.locator('details.answer').first.get_attribute('open') is not None
    nojs.close()
    browser.close()
assert not errors, errors
assert not failures, failures
result = {
    'status': 'passed',
    'pageViewportChecks': checks,
    'widths': [1440, 390, 320],
    'interactions': [
        'regression degree/reset',
        'gradient divergence/correction',
        'PCA full reconstruction',
        'GMM iterations/seed/reset',
        'SVM C/outlier/scaling/seed/reset/confusion',
        'keyboard skip link',
        'expand answers',
    ],
    'noJavaScript': '5 lab snapshots and chapter equations',
    'javascriptErrors': errors,
    'httpFailures': failures,
}
(out / 'browser-check.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False))
