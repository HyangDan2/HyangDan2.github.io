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
- 약속 코스(내장 거점) — 역삼·교대(강남역) · 합정·신촌(홍대입구) · 부전·전포(서면) · 김해시청·부원(김해시청역)
- 실시간 인앱 탐색(비허브 거점) — 사당·이수(이수역) · 의정부·가능(의정부역) · 천안·봉명(천안역) · 구미·김천구미(구미역)
  에서 앱 안에서 OpenStreetMap 실시간 조회로 맛집·카페·코스가 뜨는지, 외부 지도로 쫓아내지 않는지 확인
- 실시간 fallback — 조회 0곳/실패를 모의 응답으로 재현해 스켈레톤 → '반경 2km로 넓혀 찾기' → '다시 찾기' 동작 확인
- 모바일 — 390px 시트·코스·실시간 탐색 가로 넘침 확인
"""
from __future__ import annotations

import argparse
import http.server
import json
import re
import sys
import threading
import urllib.parse
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


def nearby_ready(page, timeout_ms: int = 4000):
    """맛집·카페 섹션이 그려질 때까지 기다린다."""
    page.wait_for_selector("#nearbySection", timeout=timeout_ms)
    page.wait_for_timeout(350)


def wait_live(page, timeout_ms: int = 60_000):
    """실시간 인앱 조회가 끝날 때까지 (칩이 ready/empty/error)."""
    page.wait_for_selector(
        ".nearby-live[data-live='ready'], .nearby-live[data-live='empty'], .nearby-live[data-live='error']",
        timeout=timeout_ms,
    )
    page.wait_for_timeout(400)


def live_status(page) -> str:
    chip = page.locator(".nearby-live")
    return chip.first.get_attribute("data-live") if chip.count() else "none"


def tab_counts(page):
    """탭 라벨에서 (맛집, 카페) 개수를 꺼낸다."""
    texts = page.locator(".nearby-tabs button").all_inner_texts()
    numbers = []
    for text in texts[1:]:
        found = re.search(r"(\d+)", text)
        numbers.append(int(found.group(1)) if found else 0)
    while len(numbers) < 2:
        numbers.append(0)
    return numbers[0], numbers[1]


def live_scenario(page, terms, shots: bool, problems: list, label: str, shot_name: str = None):
    """비허브 거점 — 앱 안 실시간 조회로 맛집·카페·코스가 뜨는지 검증."""
    reset_all(page)
    for term in terms:
        add_search(page, term)
    settle(page, 1200)
    nearby_ready(page)
    anchor = page.locator(".nearby-anchor").first.inner_text().strip()
    wait_live(page)
    status = live_status(page)
    if status != "ready":
        problems.append(f"[{label}] 실시간 조회 결과가 없습니다 (chip: {status}) — 거점: {anchor}")
        return None

    restaurants, cafes = tab_counts(page)
    if restaurants == 0 or cafes == 0:
        problems.append(f"[{label}] 실시간 맛집·카페 수가 부족합니다: 맛집 {restaurants} · 카페 {cafes} — 거점: {anchor}")
    courses = page.locator(".course-card").count()
    if courses == 0:
        problems.append(f"[{label}] 실시간 POI 로 추천 코스가 만들어지지 않았습니다 — 거점: {anchor}")
    if page.locator(".pin-course").count() != 2:
        problems.append(f"[{label}] 지도 ①·② 핀이 2개가 아닙니다")

    # 외부 지도로 쫓아내는 문구·링크가 없어야 한다
    if page.locator(".nearby-links").count() != 0:
        problems.append(f"[{label}] 외부 지도 탐색 fallback 링크가 남아 있습니다")
    fallback_text = page.locator("#nearbySection").inner_text()
    if "카카오·네이버 지도에서" in fallback_text:
        problems.append(f"[{label}] '카카오·네이버 지도에서 찾아보세요' 문구가 남아 있습니다")

    page.click(".nearby-tabs button[data-place-view='restaurant']")
    page.wait_for_timeout(450)
    rows = page.locator(".place-card").count()
    names = page.locator(".place-card .place-name").all_inner_texts()
    if rows == 0 or not any(name.strip() for name in names):
        problems.append(f"[{label}] 실시간 맛집 목록이 비었습니다")
    page.click(".nearby-tabs button[data-place-view='course']")
    page.wait_for_timeout(450)

    if shots:
        page.eval_on_selector("#nearbySection", "n => n.scrollIntoView({block: 'start'})")
        page.wait_for_timeout(400)
        shot(page, shot_name or f"desktop-live-{label}")
    return {"anchor": anchor, "restaurants": restaurants, "cafes": cafes, "courses": courses, "names": names[:5]}


def mock_live_payload(center_lat: float, center_lng: float) -> dict:
    """모의 응답 — 거점 바로 앞 식당 2곳 + 도보 3분 거리 카페 2곳."""
    def node(nid, name, amenity, lat, lng, extra=None):
        tags = {"amenity": amenity, "name": name}
        tags.update(extra or {})
        return {"type": "node", "id": nid, "lat": lat, "lon": lng, "tags": tags}

    return {
        "elements": [
            node(1, "모의 손칼국수", "restaurant", center_lat + 0.0003, center_lng, {"cuisine": "korean"}),
            node(2, "모의 왕족발", "restaurant", center_lat - 0.0003, center_lng + 0.0002, {"cuisine": "korean"}),
            node(3, "모의 카페", "cafe", center_lat + 0.0003, center_lng + 0.0024, {"outdoor_seating": "yes"}),
            node(4, "모의 로스터리", "cafe", center_lat - 0.0003, center_lng + 0.0026),
        ],
    }


def install_live_mock(page, state: dict):
    """실시간 조회 응답을 모의한다 — 빈 결과/실패/정상 결과를 전환한다."""
    def handler(route, request):
        if state.get("mode") == "error":
            route.abort()
            return
        body = request.post_data or ""
        center = None
        around = re.search(r"around:\d+,([\d.]+),([\d.]+)", urllib.parse.unquote(body))
        if around:
            center = (float(around.group(1)), float(around.group(2)))
        else:
            bbox = re.search(r"bbox=([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)", request.url)
            if bbox:
                west, south, east, north = (float(value) for value in bbox.groups())
                center = ((south + north) / 2, (west + east) / 2)
        if state.get("mode") == "empty" or center is None:
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"elements": []}))
            return
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(mock_live_payload(*center), ensure_ascii=False),
        )

    page.route("**/api/interpreter", handler)
    page.route("**/api/0.6/map.json*", handler)


def course_scenario(page, terms, expect_spot: str, shots: bool, problems: list, label: str, shot_name: str = None):
    """두 출발지 검색 → 기대 거점 → 코스 카드·마커·딥링크 검증."""
    reset_all(page)
    for term in terms:
        add_search(page, term)
    settle(page, 1600)
    spot = station_name(page)
    if expect_spot not in spot:
        problems.append(f"[{label}] 추천 거점이 {expect_spot}가 아니라 {spot}입니다")
    nearby_ready(page)
    if not page.locator("#nearbySection").is_visible():
        problems.append(f"[{label}] 맛집·카페 섹션이 보이지 않습니다")
        return
    tabs = page.locator(".nearby-tabs button")
    if tabs.count() != 3:
        problems.append(f"[{label}] 탭이 3개가 아닙니다: {tabs.count()}")
    tab_texts = tabs.all_inner_texts()
    if "추천 코스" not in tab_texts[0] or "맛집" not in tab_texts[1] or "카페" not in tab_texts[2]:
        problems.append(f"[{label}] 탭 라벨이 이상합니다: {tab_texts}")

    courses = page.locator(".course-card")
    if courses.count() == 0:
        problems.append(f"[{label}] 추천 코스 카드가 없습니다")
        return
    first_course = courses.first.inner_text()
    for keyword in ("1차", "2차", "도보"):
        if keyword not in first_course:
            problems.append(f"[{label}] 코스 카드에 '{keyword}' 표기가 없습니다: {first_course}")
    if page.locator(".course-card.is-active").count() != 1:
        problems.append(f"[{label}] 선택된 코스 카드가 1개가 아닙니다")
    if page.locator(".pin-course").count() != 2:
        problems.append(f"[{label}] 지도 코스 마커가 2개가 아닙니다: {page.locator('.pin-course').count()}")
    if page.locator(".course-label").count() < 1:
        problems.append(f"[{label}] 코스 도보 라벨이 없습니다")

    # 코스 액션 링크 — 네이버 도보 / 카카오 도보
    walk_hrefs = page.locator(".course-actions a").evaluate_all("nodes => nodes.map(n => n.href)")
    if not any(href.endswith("/walk") and "map.naver.com" in href for href in walk_hrefs):
        problems.append(f"[{label}] 네이버 도보 길찾기 링크가 없습니다: {walk_hrefs}")
    if not any("map.kakao.com" in href and "by=FOOT" in href for href in walk_hrefs):
        problems.append(f"[{label}] 카카오 도보 길찾기 링크가 없습니다: {walk_hrefs}")

    # 맛집·카페 탭
    page.click(".nearby-tabs button[data-place-view='restaurant']")
    page.wait_for_timeout(450)
    restaurants = page.locator(".place-card").count()
    if restaurants == 0:
        problems.append(f"[{label}] 맛집 목록이 비었습니다")
    if page.locator(".pin-course").count() != 0:
        problems.append(f"[{label}] 맛집 탭에서 코스 마커가 남아 있습니다")
    page.click(".nearby-tabs button[data-place-view='cafe']")
    page.wait_for_timeout(450)
    cafes = page.locator(".place-card").count()
    if cafes == 0:
        problems.append(f"[{label}] 카페 목록이 비었습니다")
    place_links = page.locator(".place-card .place-link").count()
    if place_links < cafes * 2:
        problems.append(f"[{label}] 장소별 네이버·카카오 링크가 모자랍니다: {place_links}")
    if page.locator(".place-card .mini-btn").count() < cafes:
        problems.append(f"[{label}] '지도에서' 버튼이 모자랍니다")

    page.click(".nearby-tabs button[data-place-view='course']")
    page.wait_for_timeout(450)
    if shots:
        page.eval_on_selector("#nearbySection", "n => n.scrollIntoView({block: 'start'})")
        page.wait_for_timeout(350)
        shot(page, shot_name or f"desktop-{label}-course")
    return restaurants, cafes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="검증만 수행")
    parser.add_argument(
        "--base",
        default=None,
        help="검증할 앱 주소 (기본: 로컬 서버). NAVER 지도는 NCP 콘솔에 등록된 도메인에서만 뜨므로 "
             "로컬 127.0.0.1 에서는 지도 타일이 401 로 막힌다 — 그때는 --base https://hyangdan2.github.io/PKPilot0002/ 로 배포본을 검증한다",
    )
    args = parser.parse_args()
    shots = not args.check

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

        # ---------------- 데스크톱 ----------------
        page = browser.new_page(viewport=DESKTOP, device_scale_factor=1.5)
        console_errors: list[str] = []

        def on_console(msg):
            if msg.type != "error":
                return
            url = (msg.location or {}).get("url", "") or ""
            # 실시간 조회 미러의 일시적 5xx·타임아웃은 fallback 이 처리한다 (정상 동작)
            if "Failed to load resource" in msg.text and ("overpass" in url or "openstreetmap.org" in url):
                return
            console_errors.append(f"{msg.text} [{url}]")

        page.on("pageerror", lambda exc: console_errors.append(str(exc)))
        page.on("console", on_console)

        page.goto(base, wait_until="load")
        settle(page, 2600)
        if page.evaluate(
            "Array.from(document.querySelectorAll('#map img')).filter(i => i.complete && i.naturalWidth > 0).length"
        ) == 0:
            problems.append("지도 타일이 로드되지 않았습니다")
        for control in ("#zoomInBtn", "#zoomOutBtn", "#fitBtnMap", "#styleBtn"):
            if page.locator(control).count() == 0:
                problems.append(f"지도 도구 {control} 가 없습니다")
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

        # ---------------- 약속 코스 · 맛집·카페 ----------------
        restaurants, cafes = course_scenario(page, ["역삼역", "교대역"], "강남역", shots, problems, "강남", "desktop-course-view")
        if restaurants < 10 or cafes < 5:
            problems.append(f"강남역 주변 목록이 적습니다: 맛집 {restaurants} · 카페 {cafes}")

        # 코스 2순위 선택 → 선택 표시와 마커가 유지된다
        if page.locator(".course-card").count() >= 2:
            page.locator(".course-card").nth(1).click()
            page.wait_for_timeout(650)
            active_text = page.locator(".course-card.is-active").first.inner_text()
            if "2순위" not in active_text:
                problems.append(f"코스 선택이 바뀌지 않았습니다: {active_text[:40]}")
            if page.locator(".pin-course").count() != 2:
                problems.append("코스 변경 후 지도 마커가 사라졌습니다")
            page.locator(".course-card").first.click()
            page.wait_for_timeout(500)

        # 맛집 목록 스크린샷 + '지도에서' 동작
        page.click(".nearby-tabs button[data-place-view='restaurant']")
        page.wait_for_timeout(500)
        page.eval_on_selector("#nearbySection", "n => n.scrollIntoView({block: 'start'})")
        page.wait_for_timeout(350)
        if shots:
            shot(page, "desktop-places-list")
        page.locator(".place-card .mini-btn").first.click()
        page.wait_for_timeout(700)
        if page.locator(".pin-focus").count() != 1:
            problems.append("'지도에서' 버튼이 지도에 장소를 표시하지 않습니다")
        page.click(".nearby-tabs button[data-place-view='course']")
        page.wait_for_timeout(400)

        # 홍대입구 — 합정·신촌
        course_scenario(page, ["합정역", "신촌역"], "홍대입구역", shots, problems, "홍대", "desktop-hongdae-course")

        # 영남권 — 부전·전포(서면), 김해시청·부원(김해시청역)
        course_scenario(page, ["부전역", "전포역"], "서면역", shots, problems, "서면", "desktop-seomyeon-course")
        course_scenario(page, ["김해시청역", "부원역"], "김해시청역", shots, problems, "김해", "desktop-gimhae-course")

        # ---------------- 실시간 인앱 탐색 — 30개 허브 밖 거점 ----------------
        # 내장 스냅샷이 없는 거점에서도 앱 밖으로 나가지 않고 OpenStreetMap 실시간 조회로
        # 맛집·카페·1차+2차 코스를 그려야 한다.
        live_su = live_scenario(page, ["사당역", "이수역"], shots, problems, "이수", "desktop-live-places")
        live_ui = live_scenario(page, ["의정부역", "가능역"], shots, problems, "의정부", "desktop-live-uijeongbu")
        live_cc = live_scenario(page, ["천안역", "봉명역"], shots, problems, "천안", "desktop-live-cheonan")
        live_gu = live_scenario(page, ["구미역", "김천구미역"], shots, problems, "구미", "desktop-live-gumi")
        for label, info in (("이수", live_su), ("의정부", live_ui), ("천안", live_cc), ("구미", live_gu)):
            if info:
                print(f"  · 실시간 {label}: {info['anchor']} · 맛집 {info['restaurants']} · 카페 {info['cafes']} · 코스 {info['courses']}")

        # 같은 거점을 다시 계산해도 재조회 없이 바로 뜨는지 (세션 캐시)
        if live_su:
            reset_all(page)
            for term in ("사당역", "이수역"):
                add_search(page, term)
            settle(page, 900)
            nearby_ready(page)
            if live_status(page) != "ready":
                problems.append("[이수] 같은 거점 재계산에서 실시간 결과가 즉시 나오지 않습니다")
            if page.locator(".course-card").count() == 0:
                problems.append("[이수] 같은 거점 재계산에서 코스가 비었습니다")

        # 자차 모드에서도 코스 섹션이 깨지지 않는다 (거점이 IC·휴게소)
        reset_all(page)
        set_travel(page, "car")
        add_search(page, "판교IC")
        add_search(page, "기흥IC")
        settle(page, 1400)
        nearby_ready(page)
        wait_live(page)
        if page.locator("#nearbySection").count() == 0:
            problems.append("자차 모드에서 맛집·카페 섹션이 사라졌습니다")
        if live_status(page) not in ("ready", "empty"):
            problems.append(f"자차 모드 실시간 조회가 끝나지 않았습니다: {live_status(page)}")
        if page.locator(".nearby-live").count() and "실시간" not in page.locator(".nearby-live").first.inner_text():
            problems.append("자차 모드 실시간 표기가 이상합니다")
        if shots:
            page.eval_on_selector("#nearbySection", "n => n.scrollIntoView({block: 'start'})")
            page.wait_for_timeout(350)
            shot(page, "desktop-live-car")
        set_travel(page, "transit")

        # ---------------- 실시간 fallback — 0곳 · 실패 → 반경 넓히기·다시 찾기 ----------------
        # 네트워크는 모의 응답으로 고정해 UI 상태 전환만 결정적으로 검증한다.
        mock_page = browser.new_page(viewport=DESKTOP, device_scale_factor=1.5)
        mock_page.on("pageerror", lambda exc: console_errors.append("mock: " + str(exc)))
        state = {"mode": "empty"}
        install_live_mock(mock_page, state)
        mock_page.goto(base, wait_until="load")
        settle(mock_page, 1200)
        add_search(mock_page, "안양역")
        add_search(mock_page, "명학역")
        settle(mock_page, 900)
        nearby_ready(mock_page, 6000)
        # 스켈레톤이 먼저 떠야 한다 (조회 중 화면이 멈추지 않음)
        try:
            mock_page.wait_for_selector(".nearby-loading", timeout=3000)
        except Exception:
            problems.append("실시간 조회 중 스켈레톤(.nearby-loading)이 뜨지 않았습니다")
        wait_live(mock_page, 20_000)
        if live_status(mock_page) != "empty":
            problems.append(f"0곳 모의 응답에서 상태가 empty 가 아닙니다: {live_status(mock_page)}")
        if mock_page.locator(".nearby-empty").count() == 0:
            problems.append("0곳일 때 인앱 안내(.nearby-empty)가 없습니다")
        if mock_page.locator(".nearby-links").count() != 0:
            problems.append("0곳일 때 외부 지도 링크로 쫓아냅니다")
        widen = mock_page.locator("[data-widen]")
        if widen.count() == 0:
            problems.append("0곳일 때 '반경 넓혀 찾기' 버튼이 없습니다")
        else:
            if "2km" not in widen.first.inner_text():
                problems.append(f"반경 넓히기 버튼 문구가 이상합니다: {widen.first.inner_text()}")
            if shots:
                mock_page.eval_on_selector("#nearbySection", "n => n.scrollIntoView({block: 'start'})")
                mock_page.wait_for_timeout(350)
                shot(mock_page, "desktop-live-widen")
            state["mode"] = "filled"
            widen.first.click()
            wait_live(mock_page, 20_000)
            if live_status(mock_page) != "ready":
                problems.append(f"반경을 넓혀도 실시간 결과가 없습니다: {live_status(mock_page)}")
            if mock_page.locator(".course-card").count() == 0:
                problems.append("반경을 넓혔는데 코스가 만들어지지 않았습니다")
            if "반경 2km" not in mock_page.locator(".nearby-anchor").first.inner_text():
                problems.append(f"넓힌 반경이 화면에 반영되지 않았습니다: {mock_page.locator('.nearby-anchor').first.inner_text()}")

        # 조회 실패 → '다시 찾기'로 복구
        reset_all(mock_page)
        state["mode"] = "error"
        add_search(mock_page, "천안역")
        add_search(mock_page, "봉명역")
        settle(mock_page, 900)
        nearby_ready(mock_page, 6000)
        wait_live(mock_page, 25_000)
        if live_status(mock_page) != "error":
            problems.append(f"조회 실패 상태가 표시되지 않았습니다: {live_status(mock_page)}")
        if mock_page.locator("[data-retry-live]").count() == 0:
            problems.append("조회 실패 시 '다시 찾기' 버튼이 없습니다")
        state["mode"] = "filled"
        mock_page.locator("[data-retry-live]").first.click()
        wait_live(mock_page, 20_000)
        if live_status(mock_page) != "ready":
            problems.append(f"'다시 찾기' 후에도 결과가 없습니다: {live_status(mock_page)}")
        mock_page.close()

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

        # 모바일 약속 코스 — 역삼·교대 → 강남역
        reset_all(m)
        add_search(m, "역삼역")
        add_search(m, "교대역")
        settle(m, 1800)
        if m.locator("#panel").get_attribute("data-sheet") != "full":
            m.click("#sheetGrab")
            m.wait_for_timeout(700)
        nearby_ready(m)
        if m.locator(".course-card").count() == 0:
            problems.append("모바일에서 추천 코스 카드가 없습니다")
        if m.locator(".nearby").evaluate("node => node.scrollWidth > node.clientWidth + 1"):
            problems.append("모바일에서 맛집·카페 섹션이 가로로 넘칩니다")
        m.eval_on_selector("#nearbySection", "n => n.scrollIntoView({block: 'start'})")
        m.wait_for_timeout(450)
        if shots:
            shot(m, "mobile-course-view")
        m.click(".nearby-tabs button[data-place-view='cafe']")
        m.wait_for_timeout(600)
        if m.locator(".place-card").count() == 0:
            problems.append("모바일 카페 목록이 비었습니다")
        m.eval_on_selector("#nearbySection", "n => n.scrollIntoView({block: 'start'})")
        m.wait_for_timeout(400)
        if shots:
            shot(m, "mobile-places-list")
        m.click(".nearby-tabs button[data-place-view='course']")
        m.wait_for_timeout(450)

        # 코스 카드 탭 → 지도로 내려가기 (핀 유지)
        m.locator(".course-card").first.click()
        m.wait_for_timeout(900)
        if m.locator("#panel").get_attribute("data-sheet") != "peek":
            problems.append("모바일에서 코스 선택 후 패널이 접히지 않습니다")
        if m.locator(".pin-course").count() != 2:
            problems.append("모바일 코스 선택 후 지도 마커가 2개가 아닙니다")
        if shots:
            shot(m, "mobile-course-map")


        # 모바일 실시간 탐색 — 비허브 거점(사당·이수 → 이수역)
        reset_all(m)
        add_search(m, "사당역")
        add_search(m, "이수역")
        settle(m, 1400)
        if m.locator("#panel").get_attribute("data-sheet") != "full":
            m.click("#sheetGrab")
            m.wait_for_timeout(700)
        nearby_ready(m)
        wait_live(m)
        if live_status(m) != "ready":
            problems.append(f"모바일 실시간 조회 결과가 없습니다: {live_status(m)}")
        if m.locator(".course-card").count() == 0:
            problems.append("모바일에서 실시간 코스 카드가 없습니다")
        if m.locator(".nearby").evaluate("node => node.scrollWidth > node.clientWidth + 1"):
            problems.append("모바일에서 실시간 맛집·카페 섹션이 가로로 넘칩니다")
        if m.locator(".nearby-head").evaluate("node => node.scrollWidth > node.clientWidth + 1"):
            problems.append("모바일에서 맛집·카페 헤더(실시간 칩·거점명)가 넘칩니다")
        m.eval_on_selector("#nearbySection", "n => n.scrollIntoView({block: 'start'})")
        m.wait_for_timeout(450)
        if shots:
            shot(m, "mobile-live-places")
        m.click(".nearby-tabs button[data-place-view='restaurant']")
        m.wait_for_timeout(600)
        if m.locator(".place-card").count() == 0:
            problems.append("모바일 실시간 맛집 목록이 비었습니다")
        m.eval_on_selector("#nearbySection", "n => n.scrollIntoView({block: 'start'})")
        m.wait_for_timeout(400)
        if shots:
            shot(m, "mobile-live-list")

        if console_errors:
            problems.extend(f"[console] {e}" for e in console_errors)

        browser.close()

    if server:
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
