#!/usr/bin/env python3
"""PKPilot0002 헤더 포털 메뉴(… 드롭다운) 검증 + 스크린샷.

데스크톱(1440)·모바일(390)에서 삼점 버튼을 실제로 눌러
- 드롭다운 노출/숨김과 aria-expanded 상태
- 메뉴 링크 4곳의 주소(Web-HQ·ApplicationHub·GameHub·TechnicalHub)
- 바깥 클릭 닫힘, Escape 닫힘 + 포커스 복귀
- 화면 밖으로 잘리지 않는지 (뷰포트 안 우측 정렬)
를 확인하고 docs/screenshots/portal-menu-*.jpg 를 남긴다.

    python3 tests/visual/portal_menu_check.py            # 검증 + 캡처
    python3 tests/visual/portal_menu_check.py --check    # 검증만
"""
from __future__ import annotations

import argparse
import http.server
import sys
import threading
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent   # PKPilot0002/
REPO = ROOT.parent
SHOTS = ROOT / "docs" / "screenshots"

DESKTOP = {"width": 1440, "height": 960}
MOBILE = {"width": 390, "height": 844}

EXPECTED = [
    ("web-hq", "https://hyangdan2.github.io/"),
    ("application-hub", "https://hyangdan2.github.io/ApplicationHub/"),
    ("game-hub", "https://hyangdan2.github.io/GameHub/"),
    ("technical-hub", "https://hyangdan2.github.io/TechnicalHub/"),
]


def serve():
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(REPO))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, server.socket.getsockname()[1]


def check_page(page, label: str, shot: bool, problems: list[str]) -> None:
    btn = page.locator("#portalMenuBtn")
    menu = page.locator("#portalMenuDropdown")

    if btn.count() == 0:
        problems.append(f"[{label}] 삼점 버튼(#portalMenuBtn)이 없습니다")
        return
    if not btn.is_visible():
        problems.append(f"[{label}] 삼점 버튼이 보이지 않습니다")
    if btn.get_attribute("aria-expanded") != "false":
        problems.append(f"[{label}] 초기 aria-expanded 가 false 가 아닙니다")
    if menu.is_visible():
        problems.append(f"[{label}] 처음부터 드롭다운이 열려 있습니다")

    # 1) 클릭해서 열기
    btn.click()
    page.wait_for_timeout(260)
    if not menu.is_visible():
        problems.append(f"[{label}] 삼점 버튼을 눌러도 드롭다운이 열리지 않습니다")
        return
    if btn.get_attribute("aria-expanded") != "true":
        problems.append(f"[{label}] 열린 뒤 aria-expanded 가 true 가 아닙니다")

    rows = page.locator("#portalMenuDropdown .portal-item")
    if rows.count() != len(EXPECTED):
        problems.append(f"[{label}] 메뉴 항목이 {rows.count()}개입니다 (기대 {len(EXPECTED)})")
    for key, url in EXPECTED:
        item = page.locator(f'#portalMenuDropdown .portal-item[data-portal="{key}"]')
        if item.count() == 0:
            problems.append(f"[{label}] 메뉴 항목 {key} 가 없습니다")
            continue
        href = item.get_attribute("href")
        if href != url:
            problems.append(f"[{label}] {key} 링크가 {href} 입니다 (기대 {url})")
        if item.get_attribute("target") != "_blank":
            problems.append(f"[{label}] {key} 가 새 탭으로 열리지 않습니다")

    # 뷰포트 안에 들어오는지
    box = menu.bounding_box()
    vw = page.evaluate("window.innerWidth")
    vh = page.evaluate("window.innerHeight")
    if box:
        if box["x"] < 0 or box["x"] + box["width"] > vw + 0.5:
            problems.append(f"[{label}] 드롭다운이 가로로 잘립니다 (x={box['x']:.0f}, w={box['width']:.0f}, vw={vw})")
        if box["y"] + box["height"] > vh + 0.5:
            problems.append(f"[{label}] 드롭다운이 화면 아래로 잘립니다 (bottom={box['y'] + box['height']:.0f}, vh={vh})")
        if box["y"] < 0:
            problems.append(f"[{label}] 드롭다운이 화면 위로 잘립니다")

    if shot:
        page.screenshot(path=str(SHOTS / f"portal-menu-{label}.jpg"), type="jpeg", quality=86)

    # 2) 바깥 클릭으로 닫기
    page.mouse.click(vw // 2, vh - 60)
    page.wait_for_timeout(240)
    if menu.is_visible():
        problems.append(f"[{label}] 바깥을 눌러도 드롭다운이 닫히지 않습니다")
    if btn.get_attribute("aria-expanded") != "false":
        problems.append(f"[{label}] 닫힌 뒤 aria-expanded 가 false 가 아닙니다")

    # 3) Escape 로 닫기 + 포커스 복귀
    btn.click()
    page.wait_for_timeout(220)
    page.keyboard.press("Escape")
    page.wait_for_timeout(220)
    if menu.is_visible():
        problems.append(f"[{label}] Escape 로 드롭다운이 닫히지 않습니다")
    focused = page.evaluate("document.activeElement && document.activeElement.id")
    if focused != "portalMenuBtn":
        problems.append(f"[{label}] Escape 후 포커스가 삼점 버튼으로 돌아오지 않습니다 (activeElement={focused})")

    # 4) 가로 스크롤이 생기지 않는지
    overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    if overflow > 1:
        problems.append(f"[{label}] 가로 스크롤이 {overflow}px 생깁니다")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="검증만 (스크린샷 갱신 없음)")
    parser.add_argument("--base", default=None,
                        help="검증할 앱 주소 (기본: 로컬 서버). 예: https://hyangdan2.github.io/PKPilot0002/")
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright가 필요합니다: pip install playwright && playwright install chromium", file=sys.stderr)
        return 1

    SHOTS.mkdir(parents=True, exist_ok=True)
    server = None
    base = args.base
    if not base:
        server, port = serve()
        base = f"http://127.0.0.1:{port}/PKPilot0002/"
    if not base.endswith("/"):
        base += "/"

    problems: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for label, viewport in (("desktop", DESKTOP), ("mobile", MOBILE)):
            page = browser.new_page(viewport=viewport, device_scale_factor=1.5)
            page.goto(base, wait_until="load")
            page.wait_for_timeout(1200)
            check_page(page, label, not args.check, problems)
            page.close()
        browser.close()

    if server:
        server.shutdown()

    if problems:
        print("포털 메뉴 검증 실패:")
        for item in problems:
            print("  ✗", item)
        return 1
    print("포털 메뉴 검증 통과 — 데스크톱·모바일에서 열기/닫기, 링크, 화면 정렬 확인")
    return 0


if __name__ == "__main__":
    sys.exit(main())
