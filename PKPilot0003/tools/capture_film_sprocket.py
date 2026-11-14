#!/usr/bin/env python3
"""PKPilot0003 · Shutterplate — Film Sprocket 대칭 · 엠블럼 컬러 실측 캡처

    python3 tools/capture_film_sprocket.py            # 로컬 저장소 그대로
    python3 tools/capture_film_sprocket.py --live     # 배포본(hyangdan2.github.io) 실측

--live 는 로컬 서버를 띄우지 않고 라이브 페이지를 찍습니다. 결과는 verify/ 아래:

    verify/fix-film-sprocket-01-portrait.png   390×844   세로 사진 + Film Sprocket (위/아래 여백)
    verify/fix-film-sprocket-02-landscape.png  플레이트  가로 사진 1:1 (위/아래 스프로켓 대칭)
    verify/fix-film-sprocket-03-pad0.png       플레이트  여백 0% (스프로켓이 살아남는지)
    verify/fix-emblem-color-desktop.png        1440×900  엠블럼 탭 — 원본 컬러 (PC 인스펙터)
    verify/fix-emblem-allblack-desktop.png     1440×900  엠블럼 탭 — All Black (단색)
    verify/fix-emblem-color-mobile.png         390×844   엠블럼 탭 — 원본 컬러 (모바일 시트)

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
# long edge and mounted as an element, so the margins can be counted in pixels
# rather than guessed from a screenshot at UI scale.
PLATE_JS = """async (opts) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = opts.src; });
  const st = SPApp.state;
  const L = SPPlate.layout({w: img.naturalWidth, h: img.naturalHeight, img: img}, {
    style: 'film', fields: st.fields, emblem: 'hd2lab',
    emblemMono: !!opts.mono,
    padPct: opts.pad, extraPct: SPPlate.STYLES.film.geo.extra,
    radiusPct: SPPlate.STYLES.film.geo.radius, ratio: 0,
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
  return {w: c.width, h: c.height,
          holeTop: null, perf: (() => {
            const p = SPPlate.helpers.filmPerf ? SPPlate.helpers.filmPerf(L) : null;
            return p ? {holeH: p.holeH, edgeCy: p.edgeCy, topCy: p.topCy, botCy: p.botCy} : null;
          })()};
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

            # ① phone 390 — portrait sample in the Film Sprocket frame, so both
            #    margins of the plate are in one picture
            mctx = browser.new_context(viewport={"width": 390, "height": 844},
                                       device_scale_factor=3, is_mobile=True, has_touch=True)
            mpage = mctx.new_page()
            mpage.goto(base, wait_until="networkidle")
            mpage.wait_for_timeout(600)
            mpage.tap("#emptySampleBtn")
            mpage.wait_for_function("() => window.SPApp.state.photo", timeout=30000)
            mpage.wait_for_timeout(900)
            mpage.evaluate("() => SPApp.setStyle('film')")
            mpage.wait_for_timeout(900)
            path = os.path.join(VERIFY, "fix-film-sprocket-01-portrait.png")
            mpage.screenshot(path=path)
            shots.append(path)

            # ⑥ the same phone, emblem sheet, original colours
            mpage.evaluate("() => SPApp.openSheet('emblem')")
            mpage.wait_for_timeout(700)
            path = os.path.join(VERIFY, "fix-emblem-color-mobile.png")
            mpage.screenshot(path=path)
            shots.append(path)
            mctx.close()

            # ②③ the plate at 1600px — landscape 1:1, then no padding at all
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
            info = page.evaluate(PLATE_JS, {"src": "assets/samples/sample-01.jpg",
                                            "pad": 6, "mono": False})
            page.wait_for_timeout(300)
            path = os.path.join(VERIFY, "fix-film-sprocket-02-landscape.png")
            page.locator("#capturePlate").screenshot(path=path)
            shots.append(path)
            print(f"  ① landscape plate {info['w']}×{info['h']}  perf={info['perf']}")

            info = page.evaluate(PLATE_JS, {"src": "assets/samples/sample-02.jpg",
                                            "pad": 0, "mono": False})
            page.wait_for_timeout(300)
            path = os.path.join(VERIFY, "fix-film-sprocket-03-pad0.png")
            page.locator("#capturePlate").screenshot(path=path)
            shots.append(path)
            print(f"  ② padPct 0 plate {info['w']}×{info['h']}  perf={info['perf']}")

            # ④⑤ the emblem pane on the PC inspector — original colours, then All Black.
            #    Film Sprocket + the HD2Lab mark so the plate itself shows the change.
            page.evaluate("() => { const h = document.getElementById('captureHost'); if (h) h.remove(); }")
            page.evaluate("() => { SPApp.setStyle('film'); SPApp.state.emblemChoice = 'hd2lab'; SPApp.render(); }")
            page.wait_for_timeout(500)
            page.click('#insTabs [data-tab="emblem"]')
            page.wait_for_timeout(500)
            path = os.path.join(VERIFY, "fix-emblem-color-desktop.png")
            page.screenshot(path=path)
            shots.append(path)
            page.click('#emblemMonoSeg [data-emblem-mono="mono"]')
            page.wait_for_timeout(600)
            path = os.path.join(VERIFY, "fix-emblem-allblack-desktop.png")
            page.screenshot(path=path)
            shots.append(path)
            ctx.close()
            browser.close()
    finally:
        if httpd:
            httpd.shutdown()

    for path in shots:
        print(f"{os.path.relpath(path, ROOT)}  {os.path.getsize(path):,} B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
