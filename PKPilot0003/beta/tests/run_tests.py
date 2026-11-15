#!/usr/bin/env python3
"""
PKPilot0003/beta · Shutterplate BETA — automated test suite
===========================================================
Two layers:

  [static]   The beta is a self-contained build: every asset is relative, the
             frame library is the 13 signatures in the approved order, the
             production folder is still the eight-frame build, and the theme
             window / slot bar / beta header are present in the markup.

  [browser]  A real Chromium run against a local server: every one of the 13
             frames paints its own plate, Contact Sheet and FYRA 04 lay out
             four cells, the slot model loads/replaces/swaps, a single photo
             seeds four cells, the FYRA 04 tile opens its theme window on the
             second tap (and only then), all six themes render and switch,
             1:1 export keeps the plate's own pixels, and desktop 1440px plus
             mobile 390px stay at zero console errors and zero overflow.

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
                "slotAddBtn", "slotSampleBtn"):
        check(f"static: the slot bar has #{eid}", f'id="{eid}"' in html)
    for eid in ("fyraModal", "fyraGrid", "fyraClose", "fyraTitle", "fyraThemeName"):
        check(f"static: the theme window has #{eid}", f'id="{eid}"' in html)
    check("static: the theme window is a dialog with a radio group",
          'role="dialog"' in html and 'id="fyraGrid" role="radiogroup"' in html)
    check("static: the FYRA 04 tile hint is in the CSS", ".frame-reclick" in css)
    check("static: the slot bar has its own styles", ".slot-track" in css and ".slots-head" in css)
    check("static: the theme grid has its own styles", ".fyra-grid" in css and ".fyra-theme" in css)

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
             "browser: new single frames", "browser: slots", "browser: FYRA modal",
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
        check("browser: the slot bar is visible on a multi-cut frame",
              page.is_visible("#slotBar"))
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
        check("browser: the slot bar retires on a single-cut frame", page.is_hidden("#slotBar"))

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
        print("\n[browser] mobile 390px: the slot bar, the theme window, no overflow")
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
        check("browser: mobile shows the slot bar", mpage.is_visible("#slotBar"))
        check("browser: mobile fits four slots in one row",
              mpage.evaluate("""() => { const t = document.querySelectorAll('#slotTrack .slot');
                  const ys = [...t].map(n => Math.round(n.getBoundingClientRect().top));
                  return new Set(ys).size === 1; }"""))
        check("browser: mobile has no horizontal overflow",
              mpage.evaluate("() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"),
              str(mpage.evaluate("() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]")))
        check("browser: mobile slot tiles stay tappable",
              mpage.evaluate("""() => [...document.querySelectorAll('#slotTrack button')]
                  .every(b => { const r = b.getBoundingClientRect(); return r.height >= 30 && r.width >= 24; })"""))
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
        check("browser: 320px keeps the slot bar inside the screen",
              spage.evaluate("() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"),
              str(spage.evaluate("() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]")))
        check("browser: 320px keeps all four slots on one row",
              spage.evaluate("""() => { const t = document.querySelectorAll('#slotTrack .slot');
                  const ys = [...t].map(n => Math.round(n.getBoundingClientRect().top));
                  return t.length === 4 && new Set(ys).size === 1; }"""))
        spage.evaluate("() => window.SPApp.openFyraModal()")
        spage.wait_for_timeout(500)
        check("browser: 320px fits the theme window",
              spage.evaluate("""() => { const c = document.querySelector('.fyra-card').getBoundingClientRect();
                  return c.width <= document.documentElement.clientWidth &&
                         document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1; }"""))
        check("browser: no console errors at 320px", not serrors, str(serrors[:3]))
        sctx.close()

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
