#!/usr/bin/env python3
"""PKPilot0003 · Shutterplate — 5종 프레임 여백 축소 · 수평 배치 개편 실측 캡처

    python3 tools/capture_5frames.py            # 로컬 저장소 그대로
    python3 tools/capture_5frames.py --live     # 배포본(hyangdan2.github.io) 실측

--live 는 로컬 서버를 띄우지 않고 라이브 페이지를 찍습니다. 결과는 verify/ 아래:

    verify/fix-5frames-gallery-portrait.png   Classic Gallery  (세로 1024×1536)
    verify/fix-5frames-gallery-landscape.png  Classic Gallery  (가로 1536×1024)
    verify/fix-5frames-dual-*.png             Dual Deck
    verify/fix-5frames-film-*.png             Film Sprocket  (좌하단 병렬 블록 · 우하단 ISO/SEC/F 가로 1줄)
    verify/fix-5frames-studio-*.png           Studio Dark
    verify/fix-5frames-pro-*.png              Pro Studio     (4열 가로 스펙 바)
    verify/fix-5frames-film-phone.png         390×844  앱 안의 Film Sprocket
    verify/fix-5frames-pro-phone.png          390×844  앱 안의 Pro Studio

플레이트는 라이브 페이지의 렌더러로 1600px 긴 변에 직접 그려 요소로 붙인 뒤 찍습니다.
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
LIVE = "https://hyangdan2.github.io/PKPilot0003/"

FRAMES = [
    ("gallery", "fix-5frames-gallery"),
    ("dual", "fix-5frames-dual"),
    ("film", "fix-5frames-film"),
    ("studio", "fix-5frames-studio"),
    ("pro", "fix-5frames-pro"),
]
SAMPLES = {"portrait": "assets/samples/sample-02.jpg", "landscape": "assets/samples/sample-01.jpg"}


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


# The plate itself, painted by the live page's own renderer at 1600px on its
# long edge and mounted as an element, so each margin can be counted in pixels.
PLATE_JS = """async (opts) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = opts.src; });
  const st = SPApp.state;
  const S = SPPlate.STYLES[opts.style];
  const L = SPPlate.layout({w: img.naturalWidth, h: img.naturalHeight, img: img}, {
    style: opts.style, fields: st.fields, emblem: opts.emblem || 'hd2lab',
    padPct: S.geo.pad, extraPct: S.geo.extra, radiusPct: S.geo.radius, ratio: 0,
    font: 'sans', stock: 'KODAK PORTRA 400', frameNo: '#03'
  });
  const k = 1600 / Math.max(L.W, L.H);
  const c = document.createElement('canvas');
  c.id = 'capturePlate';
  c.width = Math.round(L.W * k);
  c.height = Math.round(L.H * k);
  c.style.cssText = 'display:block;background:#0b0c0a;';
  const ctx = c.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  SPPlate.paint(ctx, L);
  const host = document.getElementById('captureHost');
  host.innerHTML = '';
  host.appendChild(c);
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;padding:0;margin:0;';
  const perf = SPPlate.helpers.filmPerf(L);
  return {
    w: c.width, h: c.height, plate: [L.W, L.H],
    pad: L.padX, padTop: L.padTop, band: L.band,
    bandDepth: +(((L.band - L.padX) / L.PH) * 100).toFixed(2),
    rail: {railH: +perf.railH.toFixed(2), topRuleY: +perf.topRuleY.toFixed(2),
           botRuleY: +perf.botRuleY.toFixed(2), flow: +perf.flow.toFixed(2)}
  };
}"""


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:  # pragma: no cover
        print(f"playwright unavailable: {e}")
        return 2

    os.makedirs(VERIFY, exist_ok=True)
    live = "--live" in sys.argv
    httpd = None
    if live:
        base = LIVE
    else:
        httpd, port = serve()
        base = f"http://127.0.0.1:{port}/"
    shots = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()

            # ① the plate at 1600px — every frame, portrait then landscape
            ctx = browser.new_context(viewport={"width": 1700, "height": 1300},
                                      device_scale_factor=1)
            page = ctx.new_page()
            page.goto(base, wait_until="networkidle")
            page.wait_for_timeout(600)
            page.click("#emptySampleBtn")
            page.wait_for_function("() => window.SPApp.state.photo", timeout=30000)
            page.wait_for_timeout(700)
            page.evaluate("""() => {
              const host = document.createElement('div');
              host.id = 'captureHost';
              document.body.appendChild(host);
            }""")
            for fid, prefix in FRAMES:
                for orient, src in SAMPLES.items():
                    info = page.evaluate(PLATE_JS, {"style": fid, "src": src})
                    page.wait_for_timeout(250)
                    path = os.path.join(VERIFY, f"{prefix}-{orient}.png")
                    page.locator("#capturePlate").screenshot(path=path)
                    shots.append(path)
                    print(f"  {fid:8s} {orient:9s} plate {info['plate'][0]}×{info['plate'][1]}  "
                          f"pad {info['pad']} band {info['band']} ({info['bandDepth']}%)  {info['rail']}")
            page.evaluate("() => { const h = document.getElementById('captureHost'); if (h) h.remove(); }")
            ctx.close()

            # ② the same two re-laid frames inside the phone UI
            mctx = browser.new_context(viewport={"width": 390, "height": 844},
                                       device_scale_factor=3, is_mobile=True, has_touch=True)
            mpage = mctx.new_page()
            mpage.goto(base, wait_until="networkidle")
            mpage.wait_for_timeout(600)
            mpage.tap("#emptySampleBtn")
            mpage.wait_for_function("() => window.SPApp.state.photo", timeout=30000)
            mpage.wait_for_timeout(900)
            for fid in ("film", "pro"):
                mpage.evaluate("(s) => SPApp.setStyle(s)", fid)
                mpage.wait_for_timeout(900)
                path = os.path.join(VERIFY, f"fix-5frames-{fid}-phone.png")
                mpage.screenshot(path=path)
                shots.append(path)
            mctx.close()
            browser.close()
    finally:
        if httpd:
            httpd.shutdown()

    for path in shots:
        print(f"{os.path.relpath(path, ROOT)}  {os.path.getsize(path):,} B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
