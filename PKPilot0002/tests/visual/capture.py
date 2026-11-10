#!/usr/bin/env python3
"""PKPilot0002 화면 검증 + 스크린샷 캡처.

Chromium(Playwright)으로 실제 화면을 띄워 시나리오를 클릭으로 진행하고,
docs/screenshots/ 에 데스크톱(1440px)·모바일(390px) 스크린샷을 남긴다.

    python3 tests/visual/capture.py          # 캡처 + 검증
    python3 tests/visual/capture.py --check  # 검증만 (스크린샷 갱신 없음)

시나리오
- 기본(수도권 대중교통) — 프리셋 3곳의 중간 지점·추천 역·공유 링크 왕복
- 모드 토글 — 대중교통 ↔ 자차 전환 시 프리셋·추천 거점·URL 상태가 같이 바뀐다
- 영남권 — 창원·부산 입력 → 대중교통(부산 전철·김해경전) / 자차(남해고속도로 IC)
- 장거리 — 서울역↔부산역 → 대중교통(KTX 환승역) / 자차(고속도로 휴게소·IC)
- 길찾기 링크 — 참가자별 카카오맵·네이버지도(자차는 티맵 포함) 딥링크
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


def serve(port: int = 0):
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(REPO))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, server.socket.getsockname()[1]


def add_preset(page, label: str, wait: int = 500):
    page.click(f'.chip:has-text("{label}")')
    page.wait_for_timeout(wait)


def add_search(page, term: str, wait: int = 700):
    """검색 자동완성으로 출발지를 추가한다."""
    page.fill("#searchInput", term)
    page.wait_for_selector("#searchResults li.res-row", timeout=8000)
    page.click(f'#searchResults li.res-row:has-text("{term}")')
    page.wait_for_timeout(wait)


def shot(page, name: str):
    """용량을 아껴 JPEG로 저장한다 (문서·PR 본문에 그대로 쓴다)."""
    page.screenshot(path=str(SHOTS / f"{name}.jpg"), type="jpeg", quality=84)


def scroll_panel(page, selector: str = None):
    if selector:
        page.eval_on_selector(selector, "node => node.scrollIntoView({block: 'start'})")
        page.wait_for_timeout(400)
    else:
        page.evaluate("document.getElementById('panelScroll').scrollTop = 0")
        page.wait_for_timeout(250)


def settle(page, ms: int = 2400):
    """지도 타일·역지오코딩이 채워질 때까지 기다린다."""
    page.wait_for_timeout(ms)


def set_travel(page, mode: str):
    page.click(f'#modeToggle button[data-travel="{mode}"]')
    page.wait_for_timeout(600)


def reset_all(page):
    if page.locator(".participant").count():
        page.click("#resetBtn")
        page.wait_for_timeout(500)


def station_name(page) -> str:
    return page.locator(".station-name").first.inner_text().strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="검증만 수행")
    args = parser.parse_args()
    shots = not args.check

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright가 필요합니다: pip install playwright && playwright install chromium", file=sys.stderr)
        return 1

    SHOTS.mkdir(parents=True, exist_ok=True)
    server, port = serve()
    base = f"http://127.0.0.1:{port}/PKPilot0002/"
    problems: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------------- 데스크톱 ----------------
        page = browser.new_page(viewport=DESKTOP, device_scale_factor=1.5)
        console_errors: list[str] = []
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        page.goto(base, wait_until="load")
        settle(page, 2600)
        if page.locator(".leaflet-tile-loaded").count() == 0:
            problems.append("지도 타일이 로드되지 않았습니다")
        if page.locator("#resultCard").is_visible():
            problems.append("참가자가 없는데 결과 카드가 보입니다")
        if not page.locator("#modeToggle button[data-travel='transit']").is_visible():
            problems.append("이동 수단 토글이 보이지 않습니다")
        if page.locator("#modeToggle button[data-travel='transit']").get_attribute("aria-pressed") != "true":
            problems.append("기본 이동 수단이 대중교통이 아닙니다")
        if shots:
            shot(page, "desktop-empty")

        add_preset(page, "강남")
        add_preset(page, "홍대입구")
        add_search(page, "종로3가역")
        settle(page)

        if page.locator(".participant").count() != 3:
            problems.append(f"참가자 3명이 아니라 {page.locator('.participant').count()}명입니다")
        if page.locator(".pin-person").count() != 3:
            problems.append(f"지도 참가자 핀이 {page.locator('.pin-person').count()}개입니다")
        if page.locator(".pin-mid").count() != 1:
            problems.append("중간 지점 마커가 없습니다")
        if not page.locator("#resultCard").is_visible():
            problems.append("결과 카드가 보이지 않습니다")

        fairness = page.locator(".ring-inner b").inner_text().strip()
        if not fairness.isdigit():
            problems.append(f"공평도 숫자가 이상합니다: {fairness}")
        if int(fairness) < 85:
            problems.append(f"기본(공평점) 모드의 공평도가 낮습니다: {fairness}%")
        if "p=" not in page.url:
            problems.append(f"URL에 좌표 상태가 없습니다: {page.url}")
        if " " in page.url:
            problems.append("URL에 공백이 남아 있습니다")
        if "t=car" in page.url:
            problems.append("대중교통 모드인데 URL에 t=car가 있습니다")

        # 길찾기 딥링크 — 대중교통 모드는 카카오맵·네이버지도
        if page.locator(".dir-box").count() == 0:
            problems.append("길찾기 링크 영역(.dir-box)이 없습니다")
        transit_chips = page.locator(".nav-chip")
        if transit_chips.count() < 3 * 2:
            problems.append(f"대중교통 길찾기 버튼이 참가자×2개가 아닙니다: {transit_chips.count()}")
        kakao_href = page.locator(".nav-chip").first.get_attribute("href")
        if not kakao_href or not kakao_href.startswith("https://map.kakao.com/"):
            problems.append(f"카카오맵 링크가 이상합니다: {kakao_href}")
        naver_href = page.locator(".nav-chip").nth(1).get_attribute("href")
        if not naver_href or "map.naver.com/p/directions" not in naver_href or not naver_href.endswith("/transit"):
            problems.append(f"네이버지도 대중교통 링크가 이상합니다: {naver_href}")

        scroll_panel(page)
        if shots:
            shot(page, "desktop-result")
        scroll_panel(page, ".station-card")
        if shots:
            shot(page, "desktop-detail")

        # 공유 링크 왕복
        share_url = page.evaluate("location.origin + location.pathname + location.search")
        page2 = browser.new_page(viewport=DESKTOP)
        page2.goto(share_url, wait_until="load")
        settle(page2, 2200)
        if page2.locator(".participant").count() != 3:
            problems.append(f"공유 링크에서 참가자 {page2.locator('.participant').count()}명만 복원됐습니다")
        if page2.locator(".ring-inner b").inner_text().strip() != fairness:
            problems.append("공유 링크의 공평도가 원본과 다릅니다")
        page2.close()

        # 계산 방식 전환
        for mode, label in (("median", "균형점"), ("centroid", "무게중심"), ("fair", "공평점")):
            page.click(f'.mode-switch button[data-mode="{mode}"]')
            page.wait_for_timeout(420)
            if page.locator(f'.mode-switch button[data-mode="{mode}"]').get_attribute("aria-pressed") != "true":
                problems.append(f"{label} 모드로 전환되지 않습니다")
        if "m=" in page.url:
            problems.append("기본 모드인데 URL에 m= 파라미터가 남아 있습니다")

        # ---------------- 자차 모드 전환 ----------------
        set_travel(page, "car")
        if page.locator("#modeToggle button[data-travel='car']").get_attribute("aria-pressed") != "true":
            problems.append("자차 모드로 전환되지 않습니다")
        if "t=car" not in page.url:
            problems.append("자차 모드인데 URL에 t=car가 없습니다")
        if page.locator(".chip:has-text('판교IC')").count() == 0:
            problems.append("자차 모드에서 IC 프리셋이 나오지 않습니다")
        if page.locator(".parking-badge").count() == 0:
            problems.append("자차 모드인데 '주차 편리' 배지가 없습니다")
        car_naver = page.locator(".nav-chip").nth(1).get_attribute("href")
        if not car_naver or not car_naver.endswith("/car"):
            problems.append(f"자차 모드 네이버 길찾기가 /car가 아닙니다: {car_naver}")
        if page.locator(".nav-chip").count() < 3 * 3:
            problems.append("자차 모드에서 티맵 버튼이 추가되지 않습니다")
        scroll_panel(page)
        if shots:
            shot(page, "desktop-car-result")

        set_travel(page, "transit")

        # ---------------- 영남권 — 창원·부산 ----------------
        reset_all(page)
        add_search(page, "연산역")
        add_search(page, "창원중앙역")
        settle(page, 1800)
        if page.locator(".participant").count() != 2:
            problems.append(f"영남권 참가자가 2명이 아닙니다: {page.locator('.participant').count()}")
        yeongnam_station = station_name(page)
        if not yeongnam_station:
            problems.append("영남권 대중교통 추천 거점이 비어 있습니다")
        if "평택" in yeongnam_station:
            problems.append(f"영남권인데 수도권 역이 추천됐습니다: {yeongnam_station}")
        spot_kicker = page.locator(".station-kicker").first.inner_text().strip()
        if "환승" not in spot_kicker and "만남" not in spot_kicker:
            problems.append(f"영남권 추천 키커가 이상합니다: {spot_kicker}")
        scroll_panel(page)
        if shots:
            shot(page, "desktop-yeongnam-transit")

        set_travel(page, "car")
        car_spot = station_name(page)
        if not any(word in car_spot for word in ("IC", "휴게소")):
            problems.append(f"영남권 자차 모드 추천이 IC·휴게소가 아닙니다: {car_spot}")
        scroll_panel(page)
        if shots:
            shot(page, "desktop-yeongnam-car")
        set_travel(page, "transit")

        # ---------------- 장거리 — 서울역 ↔ 부산역 ----------------
        reset_all(page)
        add_preset(page, "서울역")
        add_preset(page, "부산역")
        settle(page, 1800)
        long_station = station_name(page)
        if not long_station:
            problems.append("장거리 대중교통 추천이 비어 있습니다")
        if "환승" not in page.locator(".station-kicker").first.inner_text():
            problems.append(f"장거리인데 광역 환승 거점 키커가 아닙니다: {long_station}")
        scroll_panel(page)
        if shots:
            shot(page, "desktop-longdistance-transit")

        set_travel(page, "car")
        long_car = station_name(page)
        if not any(word in long_car for word in ("IC", "휴게소")):
            problems.append(f"장거리 자차 모드 추천이 IC·휴게소가 아닙니다: {long_car}")
        if shots:
            shot(page, "desktop-longdistance-car")

        # 개별 삭제 · 전체 초기화
        set_travel(page, "transit")
        page.locator(".p-del").first.click()
        page.wait_for_timeout(500)
        if page.locator(".participant").count() != 1:
            problems.append("개별 삭제가 동작하지 않습니다")
        page.click("#resetBtn")
        page.wait_for_timeout(500)
        if page.locator(".participant").count() != 0 or page.locator("#resultCard").is_visible():
            problems.append("전체 초기화가 동작하지 않습니다")
        if "p=" in page.url:
            problems.append("초기화 후에도 URL에 좌표가 남아 있습니다")
        if "t=car" in page.url:
            problems.append("대중교통 복귀 후에도 URL에 t=car가 남아 있습니다")

        # ---------------- 모바일 ----------------
        m = browser.new_page(viewport=MOBILE, device_scale_factor=2, is_mobile=True, has_touch=True)
        m.on("pageerror", lambda exc: console_errors.append("mobile: " + str(exc)))
        m.goto(base, wait_until="load")
        settle(m, 2400)
        if m.locator("#panel").get_attribute("data-sheet") != "peek":
            problems.append("모바일 패널이 접힌 상태로 시작하지 않습니다")
        if not m.locator(".search").is_visible():
            problems.append("접힌 시트에서 검색창이 보이지 않습니다")
        if not m.locator("#modeToggle").is_visible():
            problems.append("모바일에서 이동 수단 토글이 보이지 않습니다")
        if shots:
            shot(m, "mobile-empty")

        add_preset(m, "강남")
        add_preset(m, "홍대입구")
        settle(m)
        if m.locator("#panel").get_attribute("data-sheet") != "full":
            m.click("#sheetGrab")
            m.wait_for_timeout(700)
        if not m.locator("#resultCard").is_visible():
            problems.append("모바일에서 결과 카드가 보이지 않습니다")
        m.evaluate("document.getElementById('panelScroll').scrollTop = 0")
        m.wait_for_timeout(300)
        if shots:
            shot(m, "mobile-result")

        m.eval_on_selector(".station-card", "node => node.scrollIntoView({block: 'center'})")
        m.wait_for_timeout(400)
        if shots:
            shot(m, "mobile-detail")

        # 시트 접기 → 지도 + 핀
        m.click("#sheetGrab")
        m.wait_for_timeout(800)
        if m.locator("#panel").get_attribute("data-sheet") != "peek":
            problems.append("시트가 다시 접히지 않습니다")
        if shots:
            shot(m, "mobile-peek")

        if console_errors:
            problems.extend(f"[console] {e}" for e in console_errors)

        browser.close()

    server.shutdown()

    if problems:
        print("검증 실패:")
        for item in problems:
            print("  ✗", item)
        return 1

    print("검증 통과 · 스크린샷:", ", ".join(sorted(f.name for f in SHOTS.glob("*.jpg"))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
