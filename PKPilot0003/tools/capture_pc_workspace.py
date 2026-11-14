#!/usr/bin/env python3
"""PKPilot0003 · Shutterplate — PC 2단 스튜디오 · 워크스페이스 실측 캡처

    python3 tools/capture_pc_workspace.py [-v]

배포본과 같은 로컬 정적 서버를 띄워 Chromium으로 찍습니다. 결과는 verify/ 아래:

    verify/pc-workspace-01-landing.png      1440×900  랜딩 (파일 열기 · 폴더 열기)
    verify/pc-workspace-02-inspector.png    1440×900  사진 + 우측 고정 인스펙터 + 도크
    verify/pc-workspace-03-strip.png        1440×900  다중 사진 워크스페이스 스트립
    verify/pc-workspace-04-mobile.png       390×844   모바일 기존 레이아웃 (회귀 확인)
    verify/pc-workspace-05-sheet.png        900×800   1024px 아래 바텀시트 경로

Playwright/Chromium이 없으면 아무것도 덮어쓰지 않고 안내만 하고 끝납니다.
"""
from __future__ import annotations

import os
import sys
import threading
import http.server
import socketserver

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERIFY = os.path.join(ROOT, "verify")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:  # pragma: no cover
        print(f"playwright unavailable: {e}")
        return 2

    os.makedirs(VERIFY, exist_ok=True)
    samples = [os.path.join(ROOT, "assets", "samples", f"sample-0{i}.jpg") for i in (1, 2, 3)]
    httpd, port = serve()
    base = f"http://127.0.0.1:{port}/"
    shots = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()

            # ① landing — the PC shell before a photo exists
            ctx = browser.new_context(viewport={"width": 1440, "height": 900},
                                      device_scale_factor=2)
            page = ctx.new_page()
            page.goto(base, wait_until="networkidle")
            page.wait_for_timeout(600)
            path = os.path.join(VERIFY, "pc-workspace-01-landing.png")
            page.screenshot(path=path)
            shots.append(path)

            # ② photo + right inspector + export dock
            page.click("#emptySampleBtn")
            page.wait_for_function("() => window.SPApp.state.photo", timeout=20000)
            page.wait_for_timeout(1200)
            path = os.path.join(VERIFY, "pc-workspace-02-inspector.png")
            page.screenshot(path=path)
            shots.append(path)

            # ③ several photos → workspace strip (click the second one so the
            #    counter, the highlight and the re-read EXIF are all in frame)
            page.set_input_files("#wsFileInput", samples)
            page.wait_for_function("() => SPApp.workspace().entries.length === 3", timeout=30000)
            page.wait_for_timeout(1600)
            page.click(".ws-item:nth-child(2)")
            page.wait_for_timeout(1400)
            path = os.path.join(VERIFY, "pc-workspace-03-strip.png")
            page.screenshot(path=path)
            shots.append(path)
            ctx.close()

            # ④ phone 390 — the layout the brief keeps untouched
            mctx = browser.new_context(viewport={"width": 390, "height": 844},
                                       device_scale_factor=3, is_mobile=True, has_touch=True)
            mpage = mctx.new_page()
            mpage.goto(base, wait_until="networkidle")
            mpage.wait_for_timeout(400)
            mpage.tap("#emptySampleBtn")
            mpage.wait_for_function("() => window.SPApp.state.photo", timeout=20000)
            mpage.wait_for_timeout(1200)
            path = os.path.join(VERIFY, "pc-workspace-04-mobile.png")
            mpage.screenshot(path=path)
            shots.append(path)
            mctx.close()

            # ⑤ tablet 900 — below the breakpoint the bottom sheet is still the way in
            tctx = browser.new_context(viewport={"width": 900, "height": 800})
            tpage = tctx.new_page()
            tpage.goto(base, wait_until="networkidle")
            tpage.wait_for_timeout(400)
            tpage.click("#emptySampleBtn")
            tpage.wait_for_function("() => window.SPApp.state.photo", timeout=20000)
            tpage.wait_for_timeout(3600)   # let the EXIF toast clear the sheet header
            tpage.click('[data-sheet="geometry"]')
            tpage.wait_for_timeout(500)
            path = os.path.join(VERIFY, "pc-workspace-05-sheet.png")
            tpage.screenshot(path=path)
            shots.append(path)
            tctx.close()
            browser.close()
    finally:
        httpd.shutdown()

    for path in shots:
        print(f"{os.path.relpath(path, ROOT)}  {os.path.getsize(path):,} B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
