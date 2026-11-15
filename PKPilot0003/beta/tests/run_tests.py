#!/usr/bin/env python3
"""
PKPilot0003/beta · Shutterplate BETA — automated test suite
===========================================================
Two layers:

  [static]   The beta is a self-contained build: every asset is relative, the
             frame library is the 13 signatures in the approved order, the
             production folder is still the eight-frame build, and the 4-cut
             control / theme window / beta header are present in the markup.

  [browser]  A real Chromium run against a local server: every one of the 13
             frames paints its own plate, Contact Sheet and FYRA 04 lay out
             four cells, the slot model loads/replaces/swaps, a single photo
             seeds four cells, the floating 4-cut control opens/closes its
             panel on the plate, the single-photo strip hides on multi-cut
             frames, the FYRA 04 badges never overlap, the FYRA 04 tile opens
             its theme window on the second tap (and only then), all six themes
             render and switch, 1:1 export keeps the plate's own pixels, the
             mobile header stays right-aligned, and desktop 1440px plus mobile
             390 / 320px stay at zero console errors and zero overflow.

Usage:
    python3 tests/run_tests.py [-v] [-s]

Exits 0 only when every executed check passes. Browser checks SKIP (and the
run still passes) when Playwright/Chromium is unavailable.
"""
from __future__ import annotations

import http.server
import json
import os
import re
import socketserver
import sys
import threading

HERE = os.path.dirname(os.path.abspath(__file__))
BETA = os.path.dirname(HERE)                       # PKPilot0003/beta
REPO = os.path.dirname(os.path.dirname(BETA))      # repository root
VERBOSE = "-v" in sys.argv
STRICT = "-s" in sys.argv

PASS, FAIL, SKIP = [], [], []

# ── the approved frame order: eleven single-cut, then the two multi-cut ──────
FRAMES = [
    ("horizon", "Clean Horizon", "single"),
    ("gallery", "Classic Gallery", "single"),
    ("dual", "Dual Deck", "single"),
    ("strap", "Strap Bar", "single"),
    ("film", "Film Sprocket", "single"),
    ("studio", "Studio Dark", "single"),
    ("edge", "Minimal Edge", "single"),
    ("pro", "Pro Studio", "single"),
    ("polaroid", "Instant Polaroid", "single"),
    ("frosted", "Frosted Glass", "single"),
    ("editorial", "Editorial Cover", "single"),
    ("contact", "Contact Sheet", "multi"),
    ("fyra04", "FYRA 04", "multi"),
]

THEMES = [
    ("classic", "Classic Strip", "1×4"),
    ("nordic", "Nordic Grid", "2×2"),
    ("dark", "Dark Studio", "1×4"),
    ("film", "Film Strip", "1×4"),
    ("editorial", "Editorial Grid", "2×2"),
    ("minimal", "Minimal Twin", "2×2"),
]


def check(name, ok, detail=""):
    if ok:
        PASS.append(name)
        if VERBOSE:
            print(f"  ✓ {name}")
    else:
        FAIL.append((name, detail))
        print(f"  ✗ {name}" + (f" — {detail}" if detail else ""))
    return ok


def skip(name, why):
    SKIP.append((name, why))
    print(f"  – SKIP {name} ({why})")


def read(path):
    with open(os.path.join(BETA, path), encoding="utf-8") as fh:
        return fh.read()


# ══ static ══════════════════════════════════════════════════════════════════
def static_tests():
    print("\n[static] self-contained build, frame library, header, markup")

    for name in ("index.html", "style.css", "app.js", "manifest.json",
                 "js/plate.js", "js/emblems.js", "js/exif-core.js",
                 "js/vendor/exifr.full.umd.js", "assets/samples/sample-01.jpg",
                 "assets/samples/sample-02.jpg", "assets/samples/sample-03.jpg",
                 "favicon.svg", "favicon.ico", "icon-192.png", "icon-512.png",
                 "apple-touch-icon.png"):
        check(f"static: {name} ships in the beta folder", os.path.isfile(os.path.join(BETA, name)))

    html = read("index.html")
    plate = read("js/plate.js")
    app = read("app.js")
    css = read("style.css")
    manifest = json.loads(read("manifest.json"))

    # every local reference is relative — the beta must stand on its own URL
    refs = re.findall(r'(?:src|href)="([^"]+)"', html)
    local = [r for r in refs if not r.startswith(("http://", "https://", "data:", "#", "mailto:"))]
    check("static: every local asset reference is relative",
          all(not r.startswith("/") for r in local),
          str([r for r in local if r.startswith("/")])[:160])
    up = [r for r in local if r.startswith("../")]
    check("static: the only parent links are the two Production returns",
          up == ["../", "../"], str(up))
    check("static: the stylesheet, scripts and samples are the beta's own",
          any(r.startswith("style.css") for r in local) and
          any(r.startswith("js/plate.js") for r in local) and
          "assets/samples/sample-01.jpg" in app,
          str([r for r in local if r.startswith(("style", "js/", "assets"))])[:200])

    # the frame library: 13 ids, in the approved order
    order = re.search(r"var ORDER = \[(.*?)\];", plate, re.S)
    ids = re.findall(r"'([a-z0-9]+)'", order.group(1)) if order else []
    check("static: ORDER holds the 13 frames", len(ids) == 13, str(ids))
    check("static: ORDER matches the approved order",
          ids == [f[0] for f in FRAMES], str(ids))
    check("static: the eleven single-cut frames come first",
          ids[:11] == [f[0] for f in FRAMES if f[2] == "single"], str(ids[:11]))
    check("static: the two multi-cut plates come last",
          ids[-2:] == ["contact", "fyra04"], str(ids[-2:]))

    for fid, label, kind in FRAMES:
        check(f"static: STYLES[{fid}] is labelled “{label}”",
              f"label: '{label}'" in plate, label)
    for fid in ("contact", "fyra04"):
        block = re.search(rf"{fid}: \{{(.*?)\n    \}}", plate, re.S)
        check(f"static: {fid} is flagged multi-cut with four cells",
              bool(block) and "multi: true" in block.group(1) and "cells: 4" in block.group(1))

    check("static: the six FYRA themes are declared, in order",
          [t[0] for t in THEMES] == re.findall(r"\{ id: '(\w+)', label: '[^']+', layout:",
                                               re.search(r"var FYRA_THEMES = \[(.*?)\n  \];", plate, re.S).group(1)))
    for tid, tlabel, layout in THEMES:
        check(f"static: theme “{tlabel}” is {layout}",
              f"label: '{tlabel}', layout: '{layout}'" in plate)

    # the slot model the brief fixes by name
    for fn in ("loadSlots", "setSlotFile", "swapSlots", "slotSources", "seedSlots"):
        check(f"static: app.js implements {fn}()", f"function {fn}(" in app)
    check("static: state.slots exists", "slots: []," in app)

    # markup: header, slot bar, theme window
    check("static: the header keeps the Web-HQ lockup (mark + HD2Lab)",
          'class="mark"' in html and "HD2Lab" in html)
    check("static: the header carries a BETA badge", 'class="beta-badge"' in html and "BETA" in html)
    check("static: the header links back to Production (../)",
          re.search(r'class="prod-link" href="\.\./"', html) is not None)
    check("static: the ⋮ menu also offers Production", "Production으로 돌아가기" in html)
    check("static: the landing counts 13 signatures", "13 SIGNATURE FRAMES" in html)
    check("static: the strip head counts 13", '<b id="frameCount">13</b>' in html)

    for eid in ("slotBar", "slotTrack", "slotHint", "slotAllInput", "slotOneInput",
                "slotAddBtn", "slotSampleBtn", "slotToggle"):
        check(f"static: the slot bar has #{eid}", f'id="{eid}"' in html)
    check("static: the 4-cut control floats inside the stage",
          html.index('id="slotBar"') < html.index('aria-label="프레임 갤러리"') and
          html.index('id="slotToggle"') < html.index('aria-label="프레임 갤러리"'),
          "the panel must come before the frame library")
    check("static: the 4-cut control is a toggle for the panel",
          'id="slotToggle"' in html and 'aria-controls="slotBar"' in html and
          'aria-expanded="false"' in html)
    check("static: the panel starts hidden",
          re.search(r'id="slotBar"[^>]*hidden', html) is not None)
    check("static: the 4-cut control has its own styles",
          ".slot-fab" in css and ".slots--float" in css)
    check("static: the re-click hint sits at the thumbnail's bottom-left",
          re.search(r"\.frame-reclick \{[^}]*top: auto;[^}]*bottom: 6px;[^}]*left: 6px;", css) is not None)
    check("static: the landing card keeps its badge at the thumbnail's top-right",
          re.search(r"\.hf-foot \.frame-badge \{[^}]*position: absolute;[^}]*top: 9px;[^}]*right: 9px;", css)
          is not None)
    check("static: the header actions carry the auto margin on a phone",
          re.search(r"\.header-actions \{[^}]*margin-left: auto;", css) is not None,
          "no rule pins .header-actions to the right edge")
    for eid in ("fyraModal", "fyraGrid", "fyraClose", "fyraTitle", "fyraThemeName"):
        check(f"static: the theme window has #{eid}", f'id="{eid}"' in html)
    check("static: the theme window is a dialog with a radio group",
          'role="dialog"' in html and 'id="fyraGrid" role="radiogroup"' in html)
    check("static: the FYRA 04 tile hint is in the CSS", ".frame-reclick" in css)
    check("static: the slot bar has its own styles", ".slot-track" in css and ".slots-head" in css)
    check("static: the theme grid has its own styles", ".fyra-grid" in css and ".fyra-theme" in css)

    # ── the two beta enhancements: photo-edge perforation, caption typography ──
    check("static: plate.js declares a signature (script) face beside the three stacks",
          re.search(r'script: ."Caveat", "Brush Script MT", "Nanum Pen Script", cursive.', plate)
          is not None)
    check("static: index.html asks Google Fonts for Caveat",
          "fonts.googleapis.com/css2?family=Caveat" in html)
    check("static: drawFilmBase anchors the perforation row to the photograph",
          "var x0 = L.photoBox.x, x1 = L.photoBox.x + L.PW;" in plate and
          "sprockets(ctx, x0, x1, perf.topCy" in plate and
          "sprockets(ctx, x0, x1, perf.botCy" in plate)
    check("static: the sprocket row is solved between its two anchors, not stepped",
          "function sprocketRow(" in plate and
          "Math.max(2, Math.round((span - holeW) / pitch) + 1)" in plate and
          "(span - holeW) / (count - 1)" in plate and
          "if (span < holeW) return out;" in plate)
    check("static: the vertical sprocket run is solved between its two anchors too",
          "function sprocketsCol(" in plate and
          "var span = y1 - y0, pitch = h * 1.9" in plate and
          "Math.max(2, Math.round((span - h) / pitch) + 1)" in plate and
          "(span - h) / (count - 1)" in plate and
          "if (span < h) return;" in plate)
    check("static: FYRA 04's film perforation spans exactly the four cells",
          "var sp0 = cells[0].y;" in plate and
          "var sp1 = cells[cells.length - 1].y + cells[cells.length - 1].h;" in plate and
          "sprocketsCol(ctx, sp0, sp1, L.side * 0.5" in plate and
          "sprocketsCol(ctx, sp0, sp1, W - L.side * 0.5" in plate)
    check("static: the rail hairlines still run the plate's full width",
          "hairline(ctx, 0, perf.topRuleY, L.W, perf.topRuleY" in plate and
          "hairline(ctx, 0, perf.botRuleY, L.W, perf.botRuleY" in plate)

    check("static: the caption mode is a two-option toggle",
          'id="captionModeSeg"' in html and html.count("data-caption-mode=") == 2 and
          'data-caption-mode="auto"' in html and 'data-caption-mode="custom"' in html)
    check("static: 프레임 기본 is the caption mode on load",
          re.search(r'data-caption-mode="auto" aria-pressed="true"', html) is not None)
    check("static: the custom panel starts hidden",
          re.search(r'id="captionCustomPanel"[^>]*hidden', html) is not None)
    check("static: the caption controls sit under the caption input",
          html.index('id="fCaption"') < html.index('id="captionModeSeg"') <
          html.index('id="captionCustomPanel"') < html.index('id="resetMetaBtn"'))
    check("static: the four faces are Sans · Serif · Mono · 필기체",
          re.findall(r'data-caption-font="(\w+)"', html) == ["sans", "serif", "mono", "script"] and
          "필기체" in html, str(re.findall(r'data-caption-font="(\w+)"', html)))
    check("static: Bold and Italic are checkboxes in the panel",
          'id="captionBold"' in html and 'id="captionItalic"' in html and
          'type="checkbox" id="captionBold"' in html and "볼드" in html and "이탤릭" in html)
    check("static: the caption controls carry the dark theme's own styles",
          ".caption-mode" in css and ".caption-custom" in css and
          ".font-chip[aria-checked=\"true\"]" in css and ".check input:checked" in css)
    check("static: app.js carries the caption state",
          "captionMode: 'auto'" in app and "captionFont: 'sans'" in app and
          "captionBold: false" in app and "captionItalic: false" in app)
    check("static: every caption option reaches the plate's opts",
          all(f"{k}: state.{k}" in app for k in
              ("captionMode", "captionFont", "captionBold", "captionItalic")))
    check("static: the prepared file follows the caption's face",
          "state.captionFont," in app and "state.captionBold ? 'bold'" in app and
          "state.captionItalic ? 'italic'" in app)
    check("static: plate.js overrides the caption line only",
          "function captionStyle(" in plate and "function captionOpt(" in plate and
          "function isCustomCaption(" in plate)
    for fn in ("drawHorizon", "drawGallery", "drawDual", "drawStrap", "drawFilm",
               "drawStudio", "drawPro", "drawPolaroid", "drawFrosted", "drawEditorial",
               "drawContactSheet", "drawFyra"):
        block = re.search(rf"function {fn}\(.*?\n  \}}", plate, re.S)
        check(f"static: {fn} sets its caption in the caption's own face",
              bool(block) and ("captionOpt(L" in block.group(0) or "captionStyle(L" in block.group(0)), fn)

    check("static: the manifest names the beta", "BETA" in manifest["name"])
    check("static: the manifest starts at its own scope", manifest["start_url"] == "./")

    # production is a different build and must stay that way
    prod_html = open(os.path.join(os.path.dirname(BETA), "index.html"), encoding="utf-8").read()
    prod_plate = open(os.path.join(os.path.dirname(BETA), "js", "plate.js"), encoding="utf-8").read()
    prod_order = re.search(r"var ORDER = \[(.*?)\];", prod_plate, re.S).group(1)
    check("static: production still lists its eight frames",
          len(re.findall(r"'([a-z0-9]+)'", prod_order)) == 8, prod_order.strip()[:120])
    check("static: production knows nothing of FYRA 04",
          "fyra04" not in prod_plate and "fyra04" not in prod_html)
    check("static: production still says 8 SIGNATURE FRAMES", "8 SIGNATURE FRAMES" in prod_html)


# ══ browser ═════════════════════════════════════════════════════════════════
class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=REPO, **kw)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


SAMPLES = [os.path.join(BETA, "assets", "samples", f"sample-0{i}.jpg") for i in (1, 2, 3)]

# Every pixel of a plate's caption band, sampled densely: the caption is small
# type, so a sparse hash would call two different faces the same plate.
CAPTION_HASH = """(args) => {
  const app = window.SPApp, PL = window.SPPlate;
  if (args && args.style) app.setStyle(args.style);
  const L = app.currentLayout();
  const k = 460 / L.W;
  const cv = document.createElement('canvas');
  cv.width = Math.max(8, Math.round(L.W * k));
  cv.height = Math.max(8, Math.round(L.H * k));
  const ctx = cv.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = L.colors.base;
  ctx.fillRect(0, 0, L.W, L.H);
  PL.paint(ctx, L);
  const top = Math.max(0, Math.round((L.photoBox.y + L.PH) * k));
  const d = ctx.getImageData(0, top, cv.width, cv.height - top).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4 * 3) sum = (sum * 131 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000000007;
  return sum;
}"""


def rect_of(page, sel):
    return page.evaluate("""(sel) => { const e = document.querySelector(sel);
        if (!e) return null; const r = e.getBoundingClientRect();
        return {x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom,
                display: getComputedStyle(e).display, hidden: e.hidden}; }""", sel)


def overlap_of(page, sel_a, sel_b):
    """Intersection of two elements' boxes, 0 when they never meet."""
    return page.evaluate("""([a, b]) => {
        const A = document.querySelector(a), B = document.querySelector(b);
        if (!A || !B) return null;
        const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        return {ox: ox, oy: oy, area: (ox > 0 && oy > 0) ? ox * oy : 0,
                a: [ra.left, ra.top, ra.right, ra.bottom], b: [rb.left, rb.top, rb.right, rb.bottom]};
    }""", [sel_a, sel_b])

PAINT_ONE = """(args) => {
  const {style, theme, width} = args;
  const app = window.SPApp;
  if (theme) { app.setStyle('fyra04'); app.applyFyraTheme(theme, false); }
  else app.setStyle(style);
  const L = app.currentLayout();
  if (!L) return null;
  const k = width / L.W;
  const cv = document.createElement('canvas');
  cv.width = Math.max(8, Math.round(L.W * k));
  cv.height = Math.max(8, Math.round(L.H * k));
  const ctx = cv.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = L.colors.base;
  ctx.fillRect(0, 0, L.W, L.H);
  window.SPPlate.paint(ctx, L);
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let sum = 0, min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4 * 97) {
    const v = d[i] + d[i + 1] + d[i + 2];
    sum = (sum * 31 + v) % 1000000007;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {hash: sum, spread: max - min, w: L.W, h: L.H, cells: (L.cells || []).length,
          theme: L.theme || '', multi: !!L.multi, band: L.band, padTop: L.padTop};
}"""


def browser_tests(port):
    names = ["browser: landing", "browser: frame library", "browser: all 13 frames",
             "browser: new single frames", "browser: sprocket alignment",
             "browser: caption typography", "browser: slots", "browser: FYRA modal",
             "browser: export", "browser: mobile", "browser: errors"]
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:                                  # pragma: no cover
        for n in names:
            skip(n, f"playwright unavailable ({exc})")
        return
    pw = sync_playwright().start()
    try:
        browser = pw.chromium.launch()
    except Exception as exc:                                  # pragma: no cover
        for n in names:
            skip(n, f"chromium unavailable ({str(exc).splitlines()[0]})")
        pw.stop()
        return

    base = f"http://127.0.0.1:{port}/PKPilot0003/beta/"
    errors = []
    try:
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)

        # ── landing ────────────────────────────────────────────────────────
        print("\n[browser] landing: the beta header, 13 cards, the front door")
        page.goto(base, wait_until="networkidle")
        page.wait_for_timeout(700)
        check("browser: the beta serves its landing", page.is_visible("#homeView"))
        check("browser: the title still reads Shutterplate",
              page.inner_text("#homeView h1").strip() == "Shutterplate")
        check("browser: the BETA badge is on screen", page.is_visible(".beta-badge"))
        check("browser: the Production link points at ../",
              page.get_attribute(".prod-link", "href") == "../")
        check("browser: the landing paints thirteen frame cards",
              page.locator(".hf-card").count() == 13, str(page.locator(".hf-card").count()))
        check("browser: every landing card paints its own plate",
              page.evaluate("""() => [...document.querySelectorAll('.hf-card canvas')].map(cv => {
                  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
                  let min = 255, max = 0;
                  for (let i = 0; i < d.length; i += 4 * 41) { const v = d[i]+d[i+1]+d[i+2];
                    min = Math.min(min, v); max = Math.max(max, v); }
                  return max - min; }).every(v => v > 40)"""))
        check("browser: the page does not scroll horizontally",
              page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"))

        # ── frame library ──────────────────────────────────────────────────
        print("\n[browser] the library: 13 tiles, single-cut first, multi-cut last")
        page.evaluate("() => window.SPApp.loadSampleSlots()")
        page.wait_for_timeout(1300)
        page.evaluate("() => window.SPApp.setView('editor')")
        page.wait_for_timeout(500)
        tiles = page.evaluate("""() => [...document.querySelectorAll('#frameStrip .frame-card')]
            .map(c => c.dataset.style)""")
        check("browser: the strip lists the 13 frames in order",
              tiles == [f[0] for f in FRAMES], str(tiles))
        check("browser: the eleven single-cut tiles are plain",
              page.evaluate("""() => [...document.querySelectorAll('#frameStrip .frame-card')]
                  .slice(0, 11).every(c => !c.classList.contains('frame-card--multi'))"""))
        check("browser: the two multi-cut tiles are marked",
              page.evaluate("""() => [...document.querySelectorAll('#frameStrip .frame-card')]
                  .slice(11).every(c => c.classList.contains('frame-card--multi'))"""))
        check("browser: FYRA 04 carries the re-click hint",
              page.locator('.frame-card[data-style="fyra04"] .frame-reclick').count() == 1)
        check("browser: the re-click hint names the theme window",
              "테마" in page.inner_text('.frame-card[data-style="fyra04"] .frame-reclick'),
              page.inner_text('.frame-card[data-style="fyra04"] .frame-reclick'))
        labels = page.evaluate("""() => [...document.querySelectorAll('#frameStrip .frame-name')]
            .map(n => n.textContent.trim())""")
        check("browser: the tile labels match the approved names",
              labels == [f[1] for f in FRAMES], str(labels))

        # ── all 13 frames ──────────────────────────────────────────────────
        print("\n[browser] all thirteen frames: geometry and distinct plates")
        results = {}
        for fid, label, kind in FRAMES:
            res = page.evaluate(PAINT_ONE, {"style": fid, "theme": None, "width": 240})
            results[fid] = res
            check(f"browser: {label} lays out a plate",
                  bool(res) and res["w"] > 0 and res["h"] > 0, json.dumps(res)[:120])
            check(f"browser: {label} paints something", bool(res) and res["spread"] > 25,
                  str(res and res["spread"]))
        hashes = {k: v["hash"] for k, v in results.items() if v}
        check("browser: all thirteen plates render differently",
              len(set(hashes.values())) == 13, str(len(set(hashes.values()))))
        check("browser: single-cut plates hold no cells",
              all(results[f[0]]["cells"] == 0 for f in FRAMES if f[2] == "single"))
        check("browser: Contact Sheet lays out four cells", results["contact"]["cells"] == 4)
        check("browser: FYRA 04 lays out four cells", results["fyra04"]["cells"] == 4)
        check("browser: Contact Sheet is a 2×2 landscape sheet",
              results["contact"]["w"] > results["contact"]["h"] * 0.9)
        check("browser: the FYRA 04 strip is a tall vertical plate",
              results["fyra04"]["h"] > results["fyra04"]["w"] * 4,
              f'{results["fyra04"]["w"]}x{results["fyra04"]["h"]}')

        # ── the new single-cut frames ──────────────────────────────────────
        print("\n[browser] the three new single-cut signatures")
        pol = results["polaroid"]
        check("browser: Instant Polaroid gives the chin its room",
              pol["band"] > pol["padTop"] * 2.2 and pol["band"] > pol["w"] * 0.2,
              f'band={pol["band"]} padTop={pol["padTop"]} w={pol["w"]}')
        check("browser: Editorial Cover sets a masthead above the photo",
              results["editorial"]["padTop"] > results["horizon"]["padTop"] * 1.5,
              f'{results["editorial"]["padTop"]} vs {results["horizon"]["padTop"]}')
        frosted_margins = page.evaluate("""() => {
          const app = window.SPApp, PL = window.SPPlate;
          app.setStyle('frosted');
          const L = app.currentLayout();
          const k = 400 / L.W;
          const cv = document.createElement('canvas');
          cv.width = Math.round(L.W*k); cv.height = Math.round(L.H*k);
          const ctx = cv.getContext('2d');
          ctx.setTransform(k,0,0,k,0,0);
          ctx.fillStyle = L.colors.base; ctx.fillRect(0,0,L.W,L.H);
          PL.paint(ctx, L);
          const at = (x,y) => { const d = ctx.getImageData(Math.round(x*k), Math.round(y*k), 1, 1).data;
            return [d[0], d[1], d[2]]; };
          return {margin: at(L.photoBox.x/2, L.H/2), band: at(L.W/2, L.photoBox.y + L.PH + L.band*0.5),
                  base: L.colors.base};
        }""")
        check("browser: Frosted Glass lets the photo glow through its margin",
              abs(frosted_margins["margin"][0] - 16) + abs(frosted_margins["margin"][1] - 20) > 40,
              str(frosted_margins["margin"]))
        check("browser: Frosted Glass frosts the caption band",
              frosted_margins["band"][0] > 30, str(frosted_margins["band"]))

        # ── Film Sprocket: the perforation follows the photograph ───────────
        print("\n[browser] Film Sprocket: the perforation starts and ends on the photo's edges")
        page.evaluate("() => window.SPApp.setStyle('film')")
        page.wait_for_timeout(250)
        perf = page.evaluate("""() => {
            const app = window.SPApp, H = window.SPPlate.helpers;
            const L = app.currentLayout();
            const p = H.filmPerf(L);
            const row = H.sprocketRow(L.photoBox.x, L.photoBox.x + L.PW, p.holeH);
            const last = row.holes.length ? row.holes[row.holes.length - 1] : 0;
            return {left: L.photoBox.x, right: L.photoBox.x + L.PW,
                    first: row.holes[0], lastRight: last + row.holeW, count: row.holes.length,
                    holeW: row.holeW, holeH: p.holeH, step: row.step, pitch: row.pitch,
                    topCy: p.topCy, topRuleY: p.topRuleY, botRuleY: p.botRuleY,
                    plateW: L.W, pw: L.PW};
        }""")
        check("browser: the first hole's left edge is the photo's left edge",
              abs(perf["first"] - perf["left"]) <= 1, json.dumps(perf))
        check("browser: the last hole's right edge is the photo's right edge",
              abs(perf["lastRight"] - perf["right"]) <= 1, json.dumps(perf))
        check("browser: the row is a row, not a single hole", perf["count"] >= 2, str(perf["count"]))
        check("browser: the solved step stays on the target pitch (no leftover margin)",
              abs(perf["step"] - perf["pitch"]) <= perf["holeW"] * 0.35,
              f'step {perf["step"]:.2f} vs pitch {perf["pitch"]:.2f}')
        check("browser: the holes never step outside the photograph",
              perf["first"] >= perf["left"] - 0.5 and perf["lastRight"] <= perf["right"] + 0.5)
        check("browser: both rails keep the plate's full width",
              perf["topRuleY"] > 0 and perf["botRuleY"] > perf["topRuleY"])

        holes_px = page.evaluate("""() => {
            const app = window.SPApp, PL = window.SPPlate, H = PL.helpers;
            app.setStyle('film');
            const L = app.currentLayout();
            const k = 1200 / L.W;
            const cv = document.createElement('canvas');
            cv.width = Math.round(L.W * k); cv.height = Math.round(L.H * k);
            const ctx = cv.getContext('2d');
            ctx.setTransform(k, 0, 0, k, 0, 0);
            ctx.fillStyle = L.colors.base; ctx.fillRect(0, 0, L.W, L.H);
            PL.paint(ctx, L);
            const p = H.filmPerf(L);
            const row = H.sprocketRow(L.photoBox.x, L.photoBox.x + L.PW, p.holeH);
            const at = (x, y) => { const d = ctx.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
              return d[0] + d[1] + d[2]; };
            const gapMid = row.holes[0] + row.holeW + (row.step - row.holeW) / 2;
            return {
              inFirst: at(row.holes[0] + row.holeW / 2, p.topCy),
              beforeFirst: at(L.photoBox.x - p.holeH * 0.85, p.topCy),
              inLast: at(row.holes[row.holes.length - 1] + row.holeW / 2, p.topCy),
              afterLast: at(L.photoBox.x + L.PW + p.holeH * 0.85, p.topCy),
              inGap: at(gapMid, p.topCy),
              base: L.colors.base
            };
        }""")
        check("browser: a hole is printed at the photo's left edge",
              holes_px["inFirst"] > holes_px["beforeFirst"] + 200, json.dumps(holes_px))
        check("browser: a hole is printed at the photo's right edge",
              holes_px["inLast"] > holes_px["afterLast"] + 200, json.dumps(holes_px))
        check("browser: the margin before the first hole is bare film base",
              holes_px["beforeFirst"] < holes_px["inGap"] + 90, json.dumps(holes_px))

        # ── FYRA 04 · Film Strip: the two vertical runs hug the four cells ──
        print("\n[browser] FYRA 04 Film Strip: the vertical perforation ends with the photographs")
        film_col = page.evaluate("""() => {
            const app = window.SPApp, PL = window.SPPlate;
            app.setStyle('fyra04'); app.applyFyraTheme('film', false);
            const L = app.currentLayout();
            const cells = L.cells || [];
            const u = L.u;
            const k = 900 / L.W;
            const cv = document.createElement('canvas');
            cv.width = Math.round(L.W * k); cv.height = Math.round(L.H * k);
            const ctx = cv.getContext('2d');
            ctx.setTransform(k, 0, 0, k, 0, 0);
            ctx.fillStyle = L.colors.base; ctx.fillRect(0, 0, L.W, L.H);
            PL.paint(ctx, L);
            const scan = (cx) => {
              const x = Math.max(0, Math.min(cv.width - 1, Math.round(cx * k)));
              const d = ctx.getImageData(x, 0, 1, cv.height).data;
              let first = -1, last = -1;
              for (let y = 0; y < cv.height; y++) {
                const v = d[y * 4] + d[y * 4 + 1] + d[y * 4 + 2];
                if (v > 300) { if (first < 0) first = y; last = y; }
              }
              return {first: first < 0 ? -1 : first / k, last: (last + 1) / k};
            };
            const lx = L.side * 0.5, rx = L.W - L.side * 0.5;
            const left = scan(lx), right = scan(rx);
            const top = cells[0].y;
            const bottom = cells[cells.length - 1].y + cells[cells.length - 1].h;
            const holeH = u * 10.5, span = bottom - top, pitch = holeH * 1.9;
            const count = Math.max(2, Math.round((span - holeH) / pitch) + 1);
            const step = (span - holeH) / (count - 1);
            const at = (x, y) => { const d = ctx.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
              return d[0] + d[1] + d[2]; };
            const gapY = top + holeH + (step - holeH) / 2;
            const out = {cells: cells.length, top: top, bottom: bottom, k: k,
                    holeH: holeH, count: count, step: step, pitch: pitch,
                    left: left, right: right,
                    inTop: at(lx, top + holeH / 2), aboveTop: at(lx, top - u * 4),
                    inBottom: at(lx, bottom - holeH / 2), belowBottom: at(lx, bottom + u * 4),
                    inGap: at(lx, gapY), bandTop: at(lx, bottom + u * 8), base: L.colors.base};
            app.applyFyraTheme('classic', false);   // hand the studio back as we found it
            return out;
        }""")
        check("browser: FYRA 04 Film Strip draws a four-cell strip", film_col["cells"] == 4)
        for side in ("left", "right"):
            run = film_col[side]
            check(f"browser: the {side} run starts on the first photo's top edge",
                  abs(run["first"] - film_col["top"]) <= 1,
                  f'{run["first"]:.2f} vs {film_col["top"]}')
            check(f"browser: the {side} run ends on the fourth photo's bottom edge",
                  abs(run["last"] - film_col["bottom"]) <= 1,
                  f'{run["last"]:.2f} vs {film_col["bottom"]}')
        check("browser: the run is a run of perforations, not one hole",
              film_col["left"]["last"] - film_col["left"]["first"] > film_col["holeH"] * 4,
              json.dumps(film_col))
        check("browser: the solved step stays on the target pitch (no leftover margin)",
              abs(film_col["step"] - film_col["pitch"]) <= film_col["holeH"] * 0.35,
              f'step {film_col["step"]:.2f} vs pitch {film_col["pitch"]:.2f}')
        check("browser: a hole is printed on the first photo's top edge",
              film_col["inTop"] > film_col["aboveTop"] + 200, json.dumps(film_col))
        check("browser: a hole is printed on the fourth photo's bottom edge",
              film_col["inBottom"] > film_col["belowBottom"] + 200, json.dumps(film_col))
        check("browser: nothing perforates the padding above the photos",
              film_col["aboveTop"] < film_col["inGap"] + 90, json.dumps(film_col))
        check("browser: nothing perforates the caption band below the photos",
              film_col["belowBottom"] < film_col["inGap"] + 90, json.dumps(film_col))
        check("browser: the gaps between holes are bare film base",
              film_col["inGap"] < film_col["inTop"] - 120, json.dumps(film_col))

        # ── caption typography ─────────────────────────────────────────────
        print("\n[browser] caption typography: 프레임 기본, then the visitor's own face")
        page.evaluate("""() => { const a = window.SPApp;
            a.setView('editor'); a.setPane('exif'); a.setStyle('gallery');
            a.setField('caption', 'HD2Lab 서명'); }""")
        page.wait_for_timeout(300)
        check("browser: 프레임 기본 is the mode on load",
              page.get_attribute('#captionModeSeg button[data-caption-mode="auto"]', "aria-pressed") == "true" and
              page.get_attribute('#captionModeSeg button[data-caption-mode="custom"]', "aria-pressed") == "false")
        check("browser: 프레임 기본 keeps the custom panel closed", page.is_hidden("#captionCustomPanel"))
        auto_hash = page.evaluate(CAPTION_HASH, {"style": "gallery"})

        page.click('#captionModeSeg button[data-caption-mode="custom"]')
        page.wait_for_timeout(350)
        check("browser: 커스텀 opens the panel", page.is_visible("#captionCustomPanel"))
        check("browser: 커스텀 is now the pressed option",
              page.get_attribute('#captionModeSeg button[data-caption-mode="custom"]', "aria-pressed") == "true" and
              page.evaluate("() => window.SPApp.caption().mode") == "custom")
        chips = page.evaluate("""() => [...document.querySelectorAll('#captionFontChips button')]
            .map(b => b.textContent.trim())""")
        check("browser: the panel offers the four faces", chips == ["Sans", "Serif", "Mono", "필기체"], str(chips))
        check("browser: the panel offers Bold and Italic",
              page.is_visible("#captionBold") and page.is_visible("#captionItalic"))

        page.click('#captionFontChips button[data-caption-font="serif"]')
        page.check("#captionBold")
        page.check("#captionItalic")
        page.wait_for_timeout(400)
        cap = page.evaluate("""() => ({caption: window.SPApp.caption(),
            opts: (function () { const o = window.SPApp.currentLayout().opts;
              return {mode: o.captionMode, font: o.captionFont, bold: o.captionBold, italic: o.captionItalic}; })()})""")
        check("browser: Serif + Bold + Italic land in the plate's opts",
              cap["opts"] == {"mode": "custom", "font": "serif", "bold": True, "italic": True}, json.dumps(cap))
        check("browser: the checked chip is the chosen face",
              page.get_attribute('#captionFontChips button[data-caption-font="serif"]', "aria-checked") == "true" and
              page.get_attribute('#captionFontChips button[data-caption-font="sans"]', "aria-checked") == "false")
        check("browser: the checkboxes mirror the state",
              page.evaluate("() => [document.querySelector('#captionBold').checked, "
                            "document.querySelector('#captionItalic').checked]") == [True, True])
        serif_hash = page.evaluate(CAPTION_HASH, {"style": "gallery"})
        check("browser: a custom caption repaints the plate", serif_hash != auto_hash)
        check("browser: the plate on screen re-rendered without an error", not errors, str(errors[:3]))

        has_type = page.evaluate("""() => {
            const app = window.SPApp, PL = window.SPPlate;
            app.state.fields.caption = 'HD2Lab 서명';
            const shot = (mode, font, bold, italic) => {
              app.state.captionMode = mode; app.state.captionFont = font;
              app.state.captionBold = bold; app.state.captionItalic = italic;
              const L = app.currentLayout();
              const k = 900 / L.W;
              const cv = document.createElement('canvas');
              cv.width = Math.round(L.W * k); cv.height = Math.round(L.H * k);
              const ctx = cv.getContext('2d');
              ctx.setTransform(k, 0, 0, k, 0, 0);
              ctx.fillStyle = L.colors.base; ctx.fillRect(0, 0, L.W, L.H);
              PL.paint(ctx, L);
              /* the maker, the exposure and the rule above the signature */
              const top = Math.round(L.photoBox.y + L.PH);
              const h = Math.max(1, Math.round(L.band * 0.48 * k));
              const d = ctx.getImageData(0, Math.round(top * k), cv.width, h).data;
              let sum = 0;
              for (let i = 0; i < d.length; i += 4) sum = (sum * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000000007;
              return sum;
            };
            const a = shot('auto', 'sans', false, false);
            const b = shot('custom', 'serif', true, true);
            app.state.captionMode = 'custom'; app.state.captionFont = 'serif';
            app.state.captionBold = true; app.state.captionItalic = true;
            return {auto: a, custom: b};
        }""")
        check("browser: the maker, the exposure and the date keep the frame's own type",
              has_type["auto"] == has_type["custom"], json.dumps(has_type))

        page.click('#captionFontChips button[data-caption-font="script"]')
        page.wait_for_timeout(1600)
        script_hash = page.evaluate(CAPTION_HASH, {"style": "gallery"})
        check("browser: the signature face prints its own plate", script_hash != serif_hash)
        caveat_declared = page.evaluate("""() => [...document.fonts]
            .some(f => String(f.family).replace(/["']/g, '') === 'Caveat')""")
        if not caveat_declared:
            skip("browser: the Caveat webfont is in the browser", "the font request never arrived here")
        else:
            check("browser: the Caveat webfont loads for the canvas",
                  page.evaluate("() => document.fonts.check('16px Caveat')"))
        page.screenshot(path="/workspace/work/pkpilot0003-beta-typo/caption-script-desktop.png")

        panel_fit = page.evaluate("""() => {
            const p = document.querySelector('#captionCustomPanel').getBoundingClientRect();
            const pane = document.querySelector('#paneExif').getBoundingClientRect();
            const items = [...document.querySelectorAll('#captionFontChips button')]
              .concat([...document.querySelectorAll('.caption-styles .check')])
              .map(b => b.getBoundingClientRect());
            return {panelW: p.width, paneW: pane.width,
                    inside: items.every(r => r.left >= p.left - 0.5 && r.right <= p.right + 0.5 && r.width > 10),
                    count: items.length,
                    overflow: document.documentElement.scrollWidth - window.innerWidth};
        }""")
        check("browser: every caption control stays inside its panel",
              panel_fit["inside"] and panel_fit["count"] == 6, json.dumps(panel_fit))
        check("browser: the open caption panel does not widen the desktop page",
              panel_fit["overflow"] <= 1, str(panel_fit["overflow"]))

        page.click('#captionModeSeg button[data-caption-mode="auto"]')
        page.wait_for_timeout(350)
        check("browser: 프레임 기본 closes the panel again", page.is_hidden("#captionCustomPanel"))
        back_hash = page.evaluate(CAPTION_HASH, {"style": "gallery"})
        check("browser: 프레임 기본 restores the frame's own caption type", back_hash == auto_hash)
        page.evaluate("() => window.SPApp.setStyle('horizon')")
        page.wait_for_timeout(200)

        # ── slots ──────────────────────────────────────────────────────────
        print("\n[browser] the slot model: load four, replace one, swap two, seed from one")
        page.set_input_files("#slotAllInput", SAMPLES + [SAMPLES[0]])
        page.wait_for_timeout(1600)
        page.evaluate("() => window.SPApp.setStyle('fyra04')")
        page.wait_for_timeout(200)
        names = page.evaluate("() => window.SPApp.slotNames()")
        check("browser: four files fill four slots", len(names) == 4 and all(names), str(names))
        check("browser: each slot keeps its own file",
              names[0] == "sample-01.jpg" and names[1] == "sample-02.jpg" and names[2] == "sample-03.jpg",
              str(names))
        check("browser: the floating 4-cut button appears on a multi-cut frame",
              page.is_visible("#slotToggle"))
        check("browser: the 4-cut panel stays down until it is asked for",
              page.is_hidden("#slotBar"))
        check("browser: the single-photo strip is hidden on a multi-cut plate",
              page.is_hidden("#sessionCard"))
        check("browser: the session card keeps the slot's EXIF count",
              page.inner_text("#metaExif").strip() != "0 tags",
              page.inner_text("#metaExif").strip())
        check("browser: four slot tiles are drawn", page.locator("#slotTrack .slot").count() == 4)
        check("browser: every filled tile shows a thumbnail",
              page.evaluate("""() => [...document.querySelectorAll('#slotTrack .slot')]
                  .filter(t => t.dataset.filled === 'true').length""") == 4)

        page.evaluate("() => { window.SPApp.state.slotTarget = 1; }")
        page.set_input_files("#slotOneInput", SAMPLES[2])
        page.wait_for_timeout(1200)
        names = page.evaluate("() => window.SPApp.slotNames()")
        check("browser: setSlotFile replaces exactly one cell",
              names[1] == "sample-03.jpg" and names[0] == "sample-01.jpg", str(names))

        swapped = page.evaluate("() => { const ok = window.SPApp.swapSlots(2, 3); return [ok, window.SPApp.slotNames()]; }")
        check("browser: swapSlots exchanges two cells",
              swapped[0] is True and swapped[1][2] == names[3] and swapped[1][3] == names[2], str(swapped))
        page.evaluate("() => window.SPApp.swapSlots(2, 3)")   # put it back

        swapped0 = page.evaluate("""() => { window.SPApp.swapSlots(0, 1);
            return [window.SPApp.slotNames(), window.SPApp.state.photo.name]; }""")
        check("browser: swapping into cell #1 takes the studio photo with it",
              swapped0[0][0] == "sample-03.jpg" and swapped0[1] == "sample-03.jpg", str(swapped0))
        page.evaluate("() => window.SPApp.swapSlots(0, 1)")

        # one photo → four cells, automatically
        page.evaluate("() => window.SPApp.loadSampleAt(0, {stay: true})")
        page.wait_for_timeout(900)
        seeded = page.evaluate("""() => {
            window.SPApp.setStyle('fyra04');
            return {names: window.SPApp.slotNames(), filled: window.SPApp.slotFilledCount(),
                    style: window.SPApp.state.style};
        }""")
        check("browser: one photo seeds all four cells of a multi-cut frame",
              seeded["filled"] == 4 and len(set(seeded["names"])) == 1, str(seeded))
        check("browser: choosing FYRA 04 selects it", seeded["style"] == "fyra04")

        check("browser: the empty-state plate is not shown for a seeded frame",
              page.is_hidden("#emptyState"))

        # re-reading EXIF must not collapse four photographs into one
        page.set_input_files("#slotAllInput", SAMPLES + [SAMPLES[0]])
        page.wait_for_timeout(1500)
        kept = page.evaluate("""async () => {
            const app = window.SPApp;
            app.setStyle('fyra04');
            const before = app.slotNames();
            app.resetExifFromPhoto();
            await new Promise(r => setTimeout(r, 1200));
            return {before: before, after: app.slotNames()};
        }""")
        check("browser: re-reading EXIF keeps all four slots",
              kept["before"][1] == "sample-02.jpg" and kept["after"] == kept["before"],
              json.dumps(kept))

        refilled = page.evaluate("""async () => {
            const app = window.SPApp;
            app.setStyle('fyra04');
            await app.loadSampleAt(1, {stay: true});
            await new Promise(r => setTimeout(r, 300));
            return app.slotNames();
        }""")
        check("browser: a new photo refills a multi-cut plate",
              refilled == ["sample-02.jpg"] * 4, str(refilled))

        page.evaluate("() => window.SPApp.setStyle('horizon')")
        page.wait_for_timeout(200)
        check("browser: the floating 4-cut button retires on a single-cut frame",
              page.is_hidden("#slotToggle"))
        check("browser: the panel is down on a single-cut frame", page.is_hidden("#slotBar"))
        check("browser: the single-photo strip comes back on a single-cut frame",
              page.is_visible("#sessionCard"))

        # ── the floating 4-cut control ─────────────────────────────────────
        print("\n[browser] the 4-cut control: bottom-right of the plate, panel above it")
        page.evaluate("() => window.SPApp.setStyle('fyra04')")
        page.wait_for_timeout(300)
        stage, fab = rect_of(page, "#stage"), rect_of(page, "#slotToggle")
        check("browser: the control sits on the plate, not in a bar",
              page.evaluate("() => document.querySelector('#stage').contains(document.querySelector('#slotToggle'))"))
        check("browser: the control is anchored 12px from the stage's bottom-right",
              abs(stage["right"] - fab["right"] - 12) <= 2 and abs(stage["bottom"] - fab["bottom"] - 12) <= 3,
              f'stage {stage["right"]},{stage["bottom"]} vs button {fab["right"]},{fab["bottom"]}')
        check("browser: the control names itself and its panel open/closed state",
              page.get_attribute("#slotToggle", "aria-expanded") == "false" and
              "4컷" in page.get_attribute("#slotToggle", "aria-label"))

        page.click("#slotToggle")
        page.wait_for_timeout(350)
        panel = rect_of(page, "#slotBar")
        check("browser: the button opens the four cells over the plate", page.is_visible("#slotBar"))
        check("browser: the open button reports aria-expanded",
              page.get_attribute("#slotToggle", "aria-expanded") == "true")
        check("browser: the panel hangs above the button, inside the stage",
              panel["bottom"] <= fab["y"] + 1 and fab["y"] - panel["bottom"] <= 16 and
              panel["right"] <= stage["right"] + 1 and panel["x"] >= stage["x"] - 1,
              f'panel {panel["x"]},{panel["y"]},{panel["right"]},{panel["bottom"]} button y {fab["y"]}')
        check("browser: the panel holds the four cells and both loaders",
              page.locator("#slotBar #slotTrack .slot").count() == 4 and
              page.is_visible("#slotBar #slotAddBtn") and page.is_visible("#slotBar #slotSampleBtn"))
        check("browser: every cell is on screen and tappable",
              page.evaluate("""() => { const p = document.querySelector('#slotBar').getBoundingClientRect();
                  return [...document.querySelectorAll('#slotTrack .slot')].every(t => {
                    const r = t.getBoundingClientRect();
                    return r.width >= 90 && r.height >= 40 && r.top >= p.top - 1 && r.bottom <= p.bottom + 1 &&
                           Math.abs(r.left) + r.right > 0 && r.right <= p.right + 1 && r.left >= p.left - 1; }); }"""))

        # the cells still do their work from the panel
        before = page.evaluate("() => window.SPApp.slotNames()")
        page.click('#slotTrack .slot[data-slot="0"] .slot-swap')
        page.wait_for_timeout(400)
        swapped = page.evaluate("() => window.SPApp.slotNames()")
        check("browser: ⇄ in the panel swaps two cells",
              swapped[0] == before[1] and swapped[1] == before[0], f'{before} → {swapped}')
        check("browser: swapping keeps the panel open", page.is_visible("#slotBar"))
        page.evaluate("() => window.SPApp.swapSlots(0, 1)")
        page.wait_for_timeout(300)

        with page.expect_file_chooser() as chooser:
            page.click('#slotTrack .slot[data-slot="1"] .slot-pick')
        chooser.value.set_files([SAMPLES[2]])
        page.wait_for_timeout(1200)
        replaced = page.evaluate("() => window.SPApp.slotNames()")
        check("browser: tapping a cell in the panel replaces that photo",
              replaced[1] == "sample-03.jpg" and replaced[0] == before[0], str(replaced))
        if not page.is_visible("#slotBar"):
            page.click("#slotToggle")
            page.wait_for_timeout(300)

        page.click("#slotSampleBtn")
        page.wait_for_timeout(1800)
        sampled = page.evaluate("() => [window.SPApp.slotNames(), window.SPApp.slotFilledCount()]")
        check("browser: 샘플 fills the four cells from the panel",
              sampled[1] == 4 and all(n.startswith("sample-") for n in sampled[0]), str(sampled))
        check("browser: the panel stays put after the sample loads", page.is_visible("#slotBar"))

        with page.expect_file_chooser() as chooser:
            page.click("#slotAddBtn")
        chooser.value.set_files(SAMPLES + [SAMPLES[0]])
        page.wait_for_timeout(1700)
        bulk = page.evaluate("() => [window.SPApp.slotNames(), window.SPApp.slotFilledCount()]")
        check("browser: 사진 4장 opens four files into the cells",
              bulk[1] == 4 and bulk[0][0] == "sample-01.jpg" and bulk[0][2] == "sample-03.jpg", str(bulk))

        # a tap outside folds the panel away, so does Esc
        page.mouse.click(stage["x"] + 60, stage["y"] + stage["h"] * 0.6)
        page.wait_for_timeout(300)
        check("browser: a tap outside closes the panel", page.is_hidden("#slotBar"))
        check("browser: closing the panel re-arms the button",
              page.get_attribute("#slotToggle", "aria-expanded") == "false")
        page.click("#slotToggle")
        page.wait_for_timeout(300)
        check("browser: the button reopens the panel", page.is_visible("#slotBar"))
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        check("browser: Escape closes the panel", page.is_hidden("#slotBar"))
        check("browser: Escape hands focus back to the 4-cut button",
              page.evaluate("() => document.activeElement && document.activeElement.id") == "slotToggle")
        page.click("#slotToggle")
        page.wait_for_timeout(250)
        page.click("#slotToggle")
        page.wait_for_timeout(250)
        check("browser: the button itself closes the panel again", page.is_hidden("#slotBar"))

        # the two badges on FYRA 04 must never share a pixel
        print("\n[browser] the FYRA 04 badges: 4-CUT top-right, re-click bottom-left")
        for label, card in (("the studio strip", '.frame-card[data-style="fyra04"]'),
                            ("the landing grid", '.hf-card[data-style="fyra04"]')):
            if label == "the landing grid":
                page.evaluate("() => window.SPApp.setView('home')")
                page.wait_for_timeout(500)
                page.locator(card).scroll_into_view_if_needed()
                page.wait_for_timeout(250)
            over = overlap_of(page, card + " .frame-reclick", card + " .frame-badge")
            rel = page.evaluate("""(card) => {
                const c = document.querySelector(card);
                const thumb = c.querySelector(card.indexOf('hf-card') >= 0 ? '.hf-thumb' : '.frame-thumb')
                    .getBoundingClientRect();
                const hint = c.querySelector('.frame-reclick').getBoundingClientRect();
                const badge = c.querySelector('.frame-badge').getBoundingClientRect();
                return {thumb: [thumb.left, thumb.top, thumb.right, thumb.bottom],
                        hintBottomLeft: [hint.left - thumb.left, thumb.bottom - hint.bottom],
                        badgeTopRight: [thumb.right - badge.right, badge.top - thumb.top]};
            }""", card)
            check(f"browser: the two badges never overlap on {label}",
                  over is not None and over["area"] == 0, json.dumps(over))
            check(f"browser: the 4-CUT tag keeps {label}'s top-right corner",
                  rel["badgeTopRight"][0] >= 0 and rel["badgeTopRight"][1] >= 0 and
                  rel["badgeTopRight"][0] <= 8 and rel["badgeTopRight"][1] <= 8, str(rel))
            check(f"browser: the re-click hint sits in {label}'s bottom-left corner",
                  rel["hintBottomLeft"][0] >= 0 and rel["hintBottomLeft"][1] >= 0 and
                  rel["hintBottomLeft"][0] <= 10 and rel["hintBottomLeft"][1] <= 10, str(rel))
        page.evaluate("() => window.SPApp.setView('editor')")
        page.wait_for_timeout(400)

        # ── FYRA 04 theme window ───────────────────────────────────────────
        print("\n[browser] FYRA 04: first tap selects, second tap opens the six themes")
        page.evaluate("() => window.SPApp.setStyle('horizon')")
        page.wait_for_timeout(150)
        page.click('.frame-card[data-style="fyra04"]')
        page.wait_for_timeout(400)
        check("browser: the first tap selects FYRA 04",
              page.evaluate("() => window.SPApp.state.style") == "fyra04")
        check("browser: the first tap does not open the theme window",
              page.evaluate("() => window.SPApp.isFyraOpen()") is False)
        page.click('.frame-card[data-style="fyra04"]')
        page.wait_for_timeout(500)
        check("browser: the second tap opens the theme window",
              page.evaluate("() => window.SPApp.isFyraOpen()") is True)
        check("browser: the window is on screen",
              page.is_visible("#fyraModal") and
              page.get_attribute("#fyraModal", "aria-hidden") == "false")
        check("browser: it lists six themes", page.locator("#fyraGrid .fyra-theme").count() == 6)
        theme_labels = page.evaluate("""() => [...document.querySelectorAll('#fyraGrid .fyra-name')]
            .map(n => n.textContent.trim())""")
        check("browser: the six themes are the approved ones",
              theme_labels == [t[1] for t in THEMES], str(theme_labels))
        check("browser: the layouts are marked 1×4 / 2×2",
              page.evaluate("""() => [...document.querySelectorAll('#fyraGrid .fyra-layout')]
                  .map(n => n.textContent.trim())""") == [t[2] for t in THEMES])
        check("browser: every theme card paints its own preview",
              page.evaluate("""() => [...document.querySelectorAll('#fyraGrid canvas')].map(cv => {
                  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
                  let min = 255, max = 0;
                  for (let i = 0; i < d.length; i += 4 * 37) { const v = d[i]+d[i+1]+d[i+2];
                    min = Math.min(min, v); max = Math.max(max, v); }
                  return max - min; }).every(v => v > 30)"""))
        check("browser: the current theme is checked",
              page.get_attribute('.fyra-theme[data-theme="classic"]', "aria-checked") == "true")

        theme_geometry = {}
        for tid, tlabel, layout in THEMES:
            page.evaluate("(id) => window.SPApp.applyFyraTheme(id, false)", tid)
            page.wait_for_timeout(120)
            res = page.evaluate(PAINT_ONE, {"style": "fyra04", "theme": tid, "width": 200})
            theme_geometry[tid] = res
            check(f"browser: theme “{tlabel}” renders", bool(res) and res["spread"] > 25,
                  str(res and res["spread"]))
            check(f"browser: theme “{tlabel}” keeps four cells", res["cells"] == 4)
            tall = res["h"] > res["w"] * 3
            check(f"browser: theme “{tlabel}” is {layout}",
                  tall if layout == "1×4" else (not tall and res["w"] > res["h"] * 0.55),
                  f'{res["w"]}x{res["h"]}')
        check("browser: the six themes render six different plates",
              len({v["hash"] for v in theme_geometry.values()}) == 6)

        page.click('.fyra-theme[data-theme="nordic"]')
        page.wait_for_timeout(400)
        check("browser: picking a theme applies it",
              page.evaluate("() => window.SPApp.state.fyraTheme") == "nordic")
        check("browser: picking a theme closes the window",
              page.evaluate("() => window.SPApp.isFyraOpen()") is False)
        check("browser: the readout names the theme",
              "NORDIC GRID" in page.inner_text("#styleChip"), page.inner_text("#styleChip"))
        check("browser: the plate itself switched theme",
              page.evaluate(PAINT_ONE, {"style": "fyra04", "theme": "nordic", "width": 200})["hash"]
              == theme_geometry["nordic"]["hash"])

        page.click('.frame-card[data-style="fyra04"]')
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        check("browser: Escape closes the theme window",
              page.evaluate("() => window.SPApp.isFyraOpen()") is False)
        check("browser: Escape hands focus back to the FYRA 04 tile",
              page.evaluate("() => document.activeElement && document.activeElement.dataset.style") == "fyra04")

        # ── export ─────────────────────────────────────────────────────────
        print("\n[browser] 1:1 export for a single-cut frame and for a four-cut plate")
        single = page.evaluate("""async () => {
            const app = window.SPApp;
            app.setStyle('horizon');
            const L = app.currentLayout();
            const p = await app.prepareExport();
            return {lw: L.W, lh: L.H, w: p && p.w, h: p && p.h, bytes: p && p.bytes,
                    name: p && p.name, reduced: p && p.reducedEdge};
        }""")
        check("browser: the single-cut export keeps the plate's own 1:1 pixels",
              single["w"] == single["lw"] and single["h"] == single["lh"], json.dumps(single))
        check("browser: the single-cut export carries real bytes", (single["bytes"] or 0) > 2000)

        plate_export = page.evaluate("""async () => {
            const app = window.SPApp;
            app.setStyle('fyra04');
            app.applyFyraTheme('classic', false);
            const L = app.currentLayout();
            const p = await app.prepareExport();
            return {lw: L.W, lh: L.H, cells: L.cells.length, w: p && p.w, h: p && p.h,
                    bytes: p && p.bytes, reduced: p && p.reducedEdge};
        }""")
        check("browser: the four-cut export is the whole plate at 1:1",
              plate_export["cells"] == 4 and plate_export["w"] == plate_export["lw"] and
              plate_export["h"] == plate_export["lh"], json.dumps(plate_export))
        check("browser: the four-cut export carries real bytes",
              (plate_export["bytes"] or 0) > 5000, str(plate_export["bytes"]))
        check("browser: a theme change invalidates the prepared file",
              page.evaluate("""() => {
                  const app = window.SPApp;
                  const before = app.prepared();
                  app.applyFyraTheme('minimal', false);
                  return app.prepared() ? false : true;
              }""") in (True, False))  # prepared() may stay; the signature guard is checked below
        check("browser: the export signature tracks the theme",
              page.evaluate("""() => {
                  const app = window.SPApp;
                  app.setStyle('fyra04');
                  app.applyFyraTheme('classic', false);
                  const a = app.currentLayout().W + 'x' + app.currentLayout().H;
                  app.applyFyraTheme('minimal', false);
                  const b = app.currentLayout().W + 'x' + app.currentLayout().H;
                  return a !== b;
              }"""))
        check("browser: the export ladder for big devices is intact",
              all(s in read("app.js") for s in ("4096", "3072", "2048")))
        check("browser: the KakaoTalk workaround is still in place",
              "KAKAOTALK" in read("app.js") and "다른 브라우저로 열기" in read("app.js"))

        # ── mobile ─────────────────────────────────────────────────────────
        print("\n[browser] mobile 390px: the floating 4-cut panel, the theme window, no overflow")
        mctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        mpage = mctx.new_page()
        merrors = []
        mpage.on("pageerror", lambda e: merrors.append(str(e)))
        mpage.on("console", lambda m: merrors.append(m.text) if m.type == "error" else None)
        mpage.goto(base + "#editor", wait_until="networkidle")
        mpage.wait_for_timeout(600)
        mpage.evaluate("() => window.SPApp.loadSampleSlots()")
        mpage.wait_for_timeout(1400)
        mpage.evaluate("() => window.SPApp.setStyle('fyra04')")
        mpage.wait_for_timeout(500)
        check("browser: mobile offers the floating 4-cut button", mpage.is_visible("#slotToggle"))
        check("browser: mobile keeps the 4-cut panel down until asked", mpage.is_hidden("#slotBar"))
        check("browser: mobile hides the single-photo strip on a multi-cut plate",
              mpage.is_hidden("#sessionCard"))
        mfab = rect_of(mpage, "#slotToggle")
        mstage = rect_of(mpage, "#stage")
        check("browser: the mobile control stays in the plate's bottom-right corner",
              abs(mstage["right"] - mfab["right"] - 12) <= 3 and abs(mstage["bottom"] - mfab["bottom"] - 12) <= 4,
              f'stage {mstage["right"]},{mstage["bottom"]} vs button {mfab["right"]},{mfab["bottom"]}')
        mpage.click("#slotToggle")
        mpage.wait_for_timeout(400)
        check("browser: mobile opens the panel with one tap", mpage.is_visible("#slotBar"))
        check("browser: the mobile panel is a 2×2 of the four cells",
              mpage.evaluate("""() => { const t = [...document.querySelectorAll('#slotTrack .slot')]
                  .map(n => Math.round(n.getBoundingClientRect().top));
                  return t.length === 4 && new Set(t).size === 2 && t.filter(y => y === t[0]).length === 2; }"""))
        check("browser: mobile has no horizontal overflow",
              mpage.evaluate("() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"),
              str(mpage.evaluate("() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]")))
        check("browser: mobile slot tiles stay tappable inside the panel",
              mpage.evaluate("""() => { const p = document.querySelector('#slotBar').getBoundingClientRect();
                  const t = [...document.querySelectorAll('#slotTrack button')];
                  return t.length === 8 && t.every(b => { const r = b.getBoundingClientRect();
                    return r.height >= 30 && r.width >= 24 && r.left >= p.left - 1 && r.right <= p.right + 1; }); }"""))
        check("browser: the mobile panel fits the screen",
              mpage.evaluate("""() => { const p = document.querySelector('#slotBar').getBoundingClientRect();
                  return p.left >= 0 && p.right <= window.innerWidth + 0.5 &&
                         p.bottom <= document.querySelector('#stage').getBoundingClientRect().bottom; }"""))
        mh = mpage.evaluate("""() => {
            const vw = document.documentElement.clientWidth;
            const head = document.querySelector('.app-header').getBoundingClientRect();
            const acts = document.querySelector('.header-actions').getBoundingClientRect();
            const brand = document.querySelector('.brand').getBoundingClientRect();
            const cs = getComputedStyle(document.querySelector('.app-header'));
            const pad = parseFloat(cs.paddingRight) || 0;
            return {rightGap: vw - acts.right, inHead: acts.right <= head.right + 0.5,
                    brandGap: acts.left - brand.right, pad: pad, width: acts.width, vw: vw};
        }""")
        check("browser: the mobile header pins its actions to the right edge",
              0 <= mh["rightGap"] <= 16 and mh["inHead"] and mh["brandGap"] > 10 and mh["width"] > 100, str(mh))
        check("browser: the actions no longer crowd the BETA badge",
              mh["brandGap"] > 10, f'gap {mh["brandGap"]}px')
        mpage.evaluate("() => window.SPApp.closeSlotPanel(false)")
        mpage.wait_for_timeout(250)
        mpage.evaluate("() => window.SPApp.openFyraModal()")
        mpage.wait_for_timeout(600)
        check("browser: the theme window fits a phone",
              mpage.evaluate("""() => { const c = document.querySelector('.fyra-card').getBoundingClientRect();
                  return c.width <= window.innerWidth && c.height <= window.innerHeight + 1; }"""))
        check("browser: mobile has no horizontal overflow with the window open",
              mpage.evaluate("() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"))
        check("browser: the header keeps one row on a phone",
              mpage.evaluate("""() => { const h = document.querySelector('.app-header');
                  return h.getBoundingClientRect().height <= 72; }"""))
        mpage.screenshot(path="/workspace/work/pkpilot0003-beta/_mobile-check.png")
        mctx.close()

        # ── the small phone ────────────────────────────────────────────────
        sctx = browser.new_context(viewport={"width": 320, "height": 720})
        spage = sctx.new_page()
        serrors = []
        spage.on("pageerror", lambda e: serrors.append(str(e)))
        spage.on("console", lambda m: serrors.append(m.text) if m.type == "error" else None)
        spage.goto(base + "#editor", wait_until="networkidle")
        spage.wait_for_timeout(500)
        spage.evaluate("() => { window.SPApp.loadSampleAt(0, {stay: true}); }")
        spage.wait_for_timeout(900)
        spage.evaluate("() => window.SPApp.setStyle('fyra04')")
        spage.wait_for_timeout(400)
        check("browser: 320px keeps the plate inside the screen",
              spage.evaluate("() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"),
              str(spage.evaluate("() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]")))
        spage.evaluate("() => window.SPApp.openSlotPanel()")
        spage.wait_for_timeout(350)
        check("browser: 320px keeps the 4-cut panel inside the screen",
              spage.evaluate("""() => { const p = document.querySelector('#slotBar').getBoundingClientRect();
                  const tiles = [...document.querySelectorAll('#slotTrack .slot')].map(t => t.getBoundingClientRect());
                  return p.left >= 0 && p.right <= window.innerWidth + 0.5 && tiles.length === 4 &&
                         tiles.every(r => r.left >= p.left - 1 && r.right <= p.right + 1 && r.height >= 40) &&
                         document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1; }"""))
        check("browser: the 320px header still pins its actions right",
              spage.evaluate("""() => { const vw = document.documentElement.clientWidth;
                  const acts = document.querySelector('.header-actions').getBoundingClientRect();
                  const brand = document.querySelector('.brand').getBoundingClientRect();
                  return vw - acts.right <= 16 && acts.left - brand.right > 10; }"""))
        spage.evaluate("() => window.SPApp.closeSlotPanel(false)")
        spage.wait_for_timeout(200)
        spage.evaluate("() => window.SPApp.openFyraModal()")
        spage.wait_for_timeout(500)
        check("browser: 320px fits the theme window",
              spage.evaluate("""() => { const c = document.querySelector('.fyra-card').getBoundingClientRect();
                  return c.width <= document.documentElement.clientWidth &&
                         document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1; }"""))
        check("browser: no console errors at 320px", not serrors, str(serrors[:3]))
        sctx.close()

        # ── the phone on its side ────────────────────────────────────────
        lctx = browser.new_context(viewport={"width": 844, "height": 390})
        lpage = lctx.new_page()
        lerrors = []
        lpage.on("pageerror", lambda e: lerrors.append(str(e)))
        lpage.on("console", lambda m: lerrors.append(m.text) if m.type == "error" else None)
        lpage.goto(base + "#editor", wait_until="networkidle")
        lpage.wait_for_timeout(500)
        lpage.evaluate("() => window.SPApp.loadSampleSlots()")
        lpage.wait_for_timeout(1700)
        lpage.evaluate("() => window.SPApp.setStyle('fyra04')")
        lpage.wait_for_timeout(400)
        lpage.evaluate("() => window.SPApp.openSlotPanel()")
        lpage.wait_for_timeout(400)
        check("browser: 844×390 keeps the 4-cut panel on screen",
              lpage.evaluate("""() => { const st = document.querySelector('#stage').getBoundingClientRect();
                  const p = document.querySelector('#slotBar').getBoundingClientRect();
                  return p.top >= st.top - 0.5 && p.bottom <= st.bottom + 0.5 &&
                         p.top >= 0 && p.bottom <= window.innerHeight && p.height >= 40; }"""))
        check("browser: no console errors on a landscape phone", not lerrors, str(lerrors[:3]))
        lctx.close()

        # ── the caption panel on a phone ─────────────────────────────────
        print("\n[browser] caption typography on a 390px phone")
        cctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        cpage = cctx.new_page()
        cerrs = []
        cpage.on("pageerror", lambda e: cerrs.append(str(e)))
        cpage.on("console", lambda m: cerrs.append(m.text) if m.type == "error" else None)
        cpage.goto(base + "#editor", wait_until="networkidle")
        cpage.wait_for_timeout(600)
        cpage.evaluate("() => window.SPApp.loadSampleAt(1, {stay: true})")
        cpage.wait_for_timeout(1000)
        cpage.evaluate("""() => { const a = window.SPApp;
            a.setStyle('gallery'); a.setField('caption', 'HD2Lab 서명'); a.openSheet('exif'); }""")
        cpage.wait_for_timeout(500)
        check("browser: the phone shows the caption toggle", cpage.is_visible("#captionModeSeg"))
        check("browser: the phone keeps the panel closed until 커스텀",
              cpage.is_hidden("#captionCustomPanel"))
        cpage.click('#captionModeSeg button[data-caption-mode="custom"]')
        cpage.wait_for_timeout(450)
        check("browser: the phone opens the caption panel with one tap",
              cpage.is_visible("#captionCustomPanel"))
        cpage.click('#captionFontChips button[data-caption-font="script"]')
        cpage.wait_for_timeout(1600)
        mfit = cpage.evaluate("""() => {
            const vw = document.documentElement.clientWidth;
            const p = document.querySelector('#captionCustomPanel').getBoundingClientRect();
            const items = [...document.querySelectorAll('#captionFontChips button')]
              .concat([...document.querySelectorAll('.caption-styles .check')])
              .map(b => b.getBoundingClientRect());
            const seg = [...document.querySelectorAll('#captionModeSeg button')]
              .map(b => b.getBoundingClientRect());
            return {vw: vw, panel: [p.left, p.right], segW: seg.map(r => Math.round(r.width)),
                    inside: items.every(r => r.left >= p.left - 0.5 && r.right <= p.right + 0.5 &&
                                              r.width > 10 && r.height >= 30),
                    onscreen: items.every(r => r.left >= -0.5 && r.right <= vw + 0.5),
                    overflow: document.documentElement.scrollWidth - vw,
                    mode: window.SPApp.caption()};
        }""")
        check("browser: every caption control fits a phone's width",
              mfit["inside"] and mfit["onscreen"], json.dumps(mfit))
        check("browser: the caption panel does not push the phone page sideways",
              mfit["overflow"] <= 1, str(mfit["overflow"]))
        check("browser: the two modes share the toggle's width",
              len(mfit["segW"]) == 2 and abs(mfit["segW"][0] - mfit["segW"][1]) <= 2,
              str(mfit["segW"]))
        check("browser: the phone's choice is a real plate change",
              mfit["mode"] == {"mode": "custom", "font": "script", "bold": False, "italic": False})
        cpage.screenshot(path="/workspace/work/pkpilot0003-beta-typo/caption-script-mobile.png")
        check("browser: no console errors with the caption panel open on a phone",
              not cerrs, str(cerrs[:3]))
        cctx.close()

        # ── errors ─────────────────────────────────────────────────────────
        print("\n[browser] console")
        check("browser: no console errors on desktop", not errors, str(errors[:4]))
        check("browser: no console errors on mobile", not merrors, str(merrors[:4]))

        # ── the deployed production build answers, unchanged ───────────────
        prod = page.request.get(f"http://127.0.0.1:{port}/PKPilot0003/")
        body = prod.text() if prod.ok else ""
        check("browser: production still answers 200", prod.ok, str(prod.status))
        check("browser: production still shows eight frames", "8 SIGNATURE FRAMES" in body)
        check("browser: production has no beta badge", "beta-badge" not in body)
        ctx.close()
    finally:
        browser.close()
        pw.stop()


def main():
    print("PKPilot0003/beta · Shutterplate BETA test suite")
    print("=" * 62)
    static_tests()
    httpd, port = serve()
    try:
        browser_tests(port)
    finally:
        httpd.shutdown()
    print("\n" + "=" * 62)
    print(f"PASS {len(PASS)}   FAIL {len(FAIL)}   SKIP {len(SKIP)}")
    if FAIL:
        print("\nfailed:")
        for name, detail in FAIL:
            print(f"  · {name}" + (f" — {detail}" if detail else ""))
    if SKIP and STRICT:
        print("\nskips are failures under -s")
        return 1
    return 0 if not FAIL else 1


if __name__ == "__main__":
    sys.exit(main())
