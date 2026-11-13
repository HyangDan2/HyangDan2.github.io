#!/usr/bin/env python3
"""
PKPilot0003 · Shutterplate — automated test suite
=================================================
Two layers:

  [static]   HTML semantics, SVG sprite integrity, asset references, CSS tokens,
             mobile viewport rules, offline-vendored dependencies — pure Python.
  [browser]  Real Chromium run: EXIF parsing of the bundled samples, formatter
             units, plate geometry, canvas rendering, style switching, export
             dimensions, mobile ergonomics (16px inputs / 44px targets / no
             horizontal overflow).

Usage:
    python3 tests/run_tests.py [-v]

Exits 0 only when every executed check passes. Browser checks SKIP (and the run
still passes) when Playwright/Chromium is unavailable in the environment.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
import threading
import http.server
import socketserver
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERBOSE = "-v" in sys.argv

PASS, FAIL, SKIP = [], [], []


def check(name: str, ok, detail: str = ""):
    if ok:
        PASS.append(name)
        if VERBOSE:
            print(f"  ✓ {name}")
    else:
        FAIL.append((name, detail))
        print(f"  ✗ {name}" + (f" — {detail}" if detail else ""))
    return ok


def skip(name: str, why: str):
    SKIP.append((name, why))
    print(f"  – SKIP {name} ({why})")


# ── static: HTML ─────────────────────────────────────────────────────────────
class Collector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags = []          # (tag, attrs dict)
        self.ids = []
        self.text = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        self.tags.append((tag, d))
        if "id" in d:
            self.ids.append(d["id"])

    handle_startendtag = handle_starttag

    def handle_data(self, data):
        self.text.append(data)


def read(path: str) -> str:
    with open(os.path.join(ROOT, path), encoding="utf-8") as fh:
        return fh.read()


def static_tests():
    print("\n[static] files & HTML")

    required = [
        "index.html", "style.css", "app.js", "manifest.json", "favicon.svg",
        "favicon.ico", "favicon-32x32.png", "apple-touch-icon.png",
        "icon-192.png", "icon-512.png", "og-image.png", "social-preview.png",
        "js/plate.js", "js/emblems.js", "js/exif-core.js",
        "js/vendor/exifr.full.umd.js",
        "assets/samples/sample-01.jpg", "assets/samples/sample-02.jpg",
        "assets/samples/sample-03.jpg",
        "tests/run_tests.py", "tools/generate_brand_assets.py",
        "tools/make_samples.py", "README.md",
    ]
    for f in required:
        check(f"file exists: {f}", os.path.exists(os.path.join(ROOT, f)))

    html = read("index.html")
    c = Collector()
    c.feed(html)

    tag_names = [t for t, _ in c.tags]
    check("doctype html5", html.lstrip().lower().startswith("<!doctype html>"))
    check('html lang="ko"', any(t == "html" and d.get("lang") == "ko" for t, d in c.tags))
    check("meta charset utf-8",
          any(t == "meta" and d.get("charset", "").lower() == "utf-8" for t, d in c.tags))
    viewport = next((d.get("content", "") for t, d in c.tags
                     if t == "meta" and d.get("name") == "viewport"), "")
    check("viewport width=device-width", "width=device-width" in viewport, viewport)
    check("viewport covers notch", "viewport-fit=cover" in viewport, viewport)
    check("exactly one h1", tag_names.count("h1") == 1, f"h1 count={tag_names.count('h1')}")
    check("title names the product",
          "Shutterplate" in re.search(r"<title>(.*?)</title>", html, re.S).group(1))
    check("meta description present",
          any(t == "meta" and d.get("name") == "description" and len(d.get("content", "")) > 60
              for t, d in c.tags))
    check("theme-color #101110",
          any(t == "meta" and d.get("name") == "theme-color" and d.get("content", "").lower() == "#101110"
              for t, d in c.tags))
    check("manifest linked", any(t == "link" and d.get("rel") == "manifest" for t, d in c.tags))
    check("apple-touch-icon linked",
          any(t == "link" and d.get("rel") == "apple-touch-icon" for t, d in c.tags))
    check("svg favicon linked",
          any(t == "link" and d.get("rel") == "icon" and d.get("type") == "image/svg+xml"
              for t, d in c.tags))

    og = {d.get("property"): d.get("content") for t, d in c.tags if d.get("property")}
    check("og:image 1200x630",
          og.get("og:image:width") == "1200" and og.get("og:image:height") == "630")
    check("og:image points at og-image.png", "og-image.png" in (og.get("og:image") or ""))
    check("og:title & description", bool(og.get("og:title")) and bool(og.get("og:description")))
    check("twitter summary_large_image",
          any(t == "meta" and d.get("name") == "twitter:card"
              and d.get("content") == "summary_large_image" for t, d in c.tags))

    # unique ids
    dupes = {i for i in c.ids if c.ids.count(i) > 1}
    check("html ids unique", not dupes, f"duplicates: {sorted(dupes)}")

    # local references resolve
    refs = []
    for t, d in c.tags:
        if t == "script" and d.get("src"):
            refs.append(d["src"])
        if t == "link" and d.get("href") and not d["href"].startswith(("http", "data:")):
            refs.append(d["href"].split("?")[0])
    missing = [r for r in refs if not os.path.exists(os.path.join(ROOT, r))]
    check("every local script/link target exists", not missing, str(missing))
    check("no CDN scripts (offline-first)", not re.search(r"<script[^>]+src=\"https?://", html))
    check("no external stylesheet", not re.search(r"<link[^>]+rel=\"stylesheet\"[^>]+href=\"https?://", html))

    # ── SVG sprite ───────────────────────────────────────────────────────────
    print("\n[static] SVG sprite")
    symbols = re.findall(r'<symbol id="([^"]+)" viewBox="([^"]+)">(.*?)</symbol>', html, re.S)
    ids = [s[0] for s in symbols]
    check("sprite has symbols", len(symbols) >= 30, f"count={len(symbols)}")
    check("symbol ids unique", len(ids) == len(set(ids)))
    check("every symbol has a viewBox",
          all(re.fullmatch(r"0 0 [\d.]+ [\d.]+", s[1]) for s in symbols))
    check("every symbol has geometry",
          all(("<path" in s[2] or "<circle" in s[2] or "<rect" in s[2]) for s in symbols))

    required_icons = [
        "i-camera", "i-optics", "i-focal", "i-aperture", "i-shutter", "i-iso",
        "i-date", "i-caption", "i-upload", "i-download", "i-image", "i-dots",
        "i-portal-home", "i-portal-apps", "i-portal-game", "i-portal-tech",
    ]
    check("all deck/UI icons present", all(i in ids for i in required_icons),
          str([i for i in required_icons if i not in ids]))
    uses = set(re.findall(r'use href="#([^"]+)"', html))
    dangling = {u for u in uses if u not in ids}
    check("<use> references resolve", not dangling, str(sorted(dangling)))

    # ── structure the brief asks for ─────────────────────────────────────────
    print("\n[static] required UI blocks")
    data_ids = [d.get("data-acc") for t, d in c.tags if t == "section" and d.get("data-acc")]
    check("six panel sections", len(data_ids) == 6, str(data_ids))
    check("upload/style/deck/emblem/geometry/export present",
          set(data_ids) == {"upload", "style", "deck", "emblem", "geometry", "export"})
    styles = set(re.findall(r'data-style="([^"]+)"', html))
    check("four plate styles", styles == {"classic", "studio", "clean", "film"}, str(styles))
    fields = set(re.findall(r'id="f([A-Z]\w+)"', html))
    check("eight deck fields",
          {"Make", "Model", "Lens", "Focal", "Aperture", "Shutter", "Iso", "Date", "Caption"} <= fields,
          str(fields))
    check("portrait dropdown has 4 hubs",
          html.count('class="portal-item"') == 4, str(html.count('class="portal-item"')))
    check("sample button wired", 'id="sampleBtn"' in html and 'id="emptySampleBtn"' in html)
    check("export button present", 'id="downloadBtn"' in html)
    check("privacy claim shown", "0 B" in html)

    # ── CSS ──────────────────────────────────────────────────────────────────
    print("\n[static] CSS tokens & mobile rules")
    css = read("style.css")
    check("dark token #101110", "#101110" in css)
    check("accent token #ff824f", "#ff824f" in css)
    check("inputs are 16px (iOS zoom guard)",
          re.search(r"\.inp,[^{]*\{[^}]*font-size:\s*16px", css, re.S) is not None,
          "expected .inp { font-size: 16px }")
    check("no sub-16px input override",
          not re.search(r"input[^{]*\{[^}]*font-size:\s*(1[0-5]|[0-9])px", css))
    def target_ok(sel: str) -> bool:
        m = re.search(re.escape(sel) + r"[^{]*\{([^}]*)\}", css, re.S)
        if not m:
            return False
        body = m.group(1)
        heights = [int(v) for v in re.findall(r"(?:min-)?height:\s*(\d+)px", body)]
        return bool(heights) and max(heights) >= 44

    for sel in (".btn", ".icon-btn", ".portal-menu-btn", ".dropzone", ".emblem-tile", ".style-card"):
        check(f"44px touch target: {sel}", target_ok(sel))
    check("range inputs are 44px tall",
          re.search(r'input\[type="range"\][^{]*\{[^}]*height:\s*44px', css, re.S) is not None)
    check("mobile breakpoint 920px", "@media (max-width: 920px)" in css)
    check("sticky preview on mobile",
          re.search(r"@media \(max-width: 920px\)[\s\S]*?\.stage\s*\{[^}]*position:\s*sticky", css) is not None)
    check("prefers-reduced-motion honoured", "prefers-reduced-motion" in css)
    check("touch-action none on canvas", re.search(r"\.stage-canvas\s*\{[^}]*touch-action:\s*none", css) is not None)

    # ── manifest / vendor ────────────────────────────────────────────────────
    print("\n[static] manifest & vendored EXIF")
    man = json.loads(read("manifest.json"))
    check("manifest name", "Shutterplate" in man.get("name", ""))
    check("manifest start_url", man.get("start_url") == "./")
    check("manifest icons >= 4", len(man.get("icons", [])) >= 4)
    for icon in man.get("icons", []):
        check(f"manifest icon exists: {icon['src']}",
              os.path.exists(os.path.join(ROOT, icon["src"])))
    vendor = read("js/vendor/exifr.full.umd.js")
    check("exifr bundle vendored", len(vendor) > 50_000 and "exifr" in vendor[:400])
    app = read("app.js")
    check("exifr loaded from local vendor",
          "js/vendor/exifr.full.umd.js" in html)
    check("4096px export guard", "4096" in app)
    check("export filename pattern",
          "Shutterplate_" in read("js/exif-core.js"))


# ── browser tests ────────────────────────────────────────────────────────────
SAMPLE_EXPECT = {
    "make": "SONY", "model": "ILCE-7M4", "lens": "FE 35mm F1.4 GM",
    "focal": "35mm", "aperture": "ƒ/1.8", "shutter": "1/250s",
    "iso": "ISO 100", "datetime": "2026.10.24 17:32", "caption": "HD2Lab",
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


def serve():
    httpd = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, port


def browser_tests(port):
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:  # pragma: no cover
        for name in ("browser: boot", "browser: EXIF parse", "browser: formatters",
                     "browser: geometry", "browser: canvas", "browser: export",
                     "browser: mobile ergonomics"):
            skip(name, f"playwright unavailable ({e})")
        return

    playwright = sync_playwright().start()
    try:
        browser = playwright.chromium.launch()
    except Exception as e:  # pragma: no cover
        for name in ("browser: boot", "browser: EXIF parse", "browser: formatters",
                     "browser: geometry", "browser: canvas", "browser: export",
                     "browser: mobile ergonomics"):
            skip(name, f"chromium unavailable ({str(e).splitlines()[0]})")
        playwright.stop()
        return

    base = f"http://127.0.0.1:{port}/"
    errors = []

    try:
        print("\n[browser] boot & EXIF")
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, accept_downloads=True)
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(base, wait_until="networkidle")

        check("browser: no console/page errors", not errors, str(errors[:3]))
        check("browser: modules exposed", page.evaluate(
            "() => !!(window.SPPlate && window.SPExif && window.SPEmblems && window.exifr)"))
        check("browser: empty state visible", page.is_visible("#emptyState"))
        check("browser: download disabled before photo", page.is_disabled("#downloadBtn"))

        page.click("#emptySampleBtn")
        page.wait_for_function("() => window.SPApp.state.photo && window.SPApp.state.photo.w > 0",
                               timeout=15000)
        page.wait_for_timeout(500)

        fields = page.evaluate("() => window.SPApp.state.fields")
        for k, v in SAMPLE_EXPECT.items():
            check(f"browser: EXIF field {k} = {v}", fields.get(k) == v, f"got {fields.get(k)!r}")
        check("browser: auto emblem from Make = sony",
              page.evaluate("() => window.SPApp.state.autoEmblem") == "sony")
        check("browser: empty state hidden after load", not page.is_visible("#emptyState"))
        check("browser: download enabled", page.is_enabled("#downloadBtn"))
        check("browser: exif chip counts tags", "tags" in page.inner_text("#metaExif"))

        print("\n[browser] formatter units")
        units = page.evaluate("""() => {
          const E = window.SPExif;
          return {
            shutter1: E.fmtShutter(0.008), shutter2: E.fmtShutter(2), shutter3: E.fmtShutter('1/60'),
            shutter4: E.fmtShutter([1,250]),
            ap1: E.fmtAperture(1.8), ap2: E.fmtAperture([18,10]), ap3: E.fmtAperture(2),
            focal1: E.fmtFocal(35, 52), focal2: E.fmtFocal([56,1], 84), focal3: E.fmtFocal(24, 24),
            iso1: E.fmtISO(400), iso2: E.fmtISO([1600,1]),
            date1: E.fmtDateTime('2026:11:07 21:48:05'),
            file1: E.fileName({make:'SONY', model:'ILCE-7M4', datetime:'2026.10.24 17:32'}, 'jpg'),
            tpl: E.templateFor(new Date(2026, 0, 2, 3, 4)).datetime
          };
        }""")
        check("fmtShutter 0.008 → 1/125s", units["shutter1"] == "1/125s", units["shutter1"])
        check("fmtShutter 2 → 2s", units["shutter2"] == "2s", units["shutter2"])
        check("fmtShutter '1/60' → 1/60s", units["shutter3"] == "1/60s", units["shutter3"])
        check("fmtShutter [1,250] → 1/250s", units["shutter4"] == "1/250s", units["shutter4"])
        check("fmtAperture 1.8 → ƒ/1.8", units["ap1"] == "ƒ/1.8", units["ap1"])
        check("fmtAperture [18,10] → ƒ/1.8", units["ap2"] == "ƒ/1.8", units["ap2"])
        check("fmtAperture 2 → ƒ/2", units["ap3"] == "ƒ/2", units["ap3"])
        check("fmtFocal adds 35mm equivalent", units["focal1"] == "35mm (52mm)", units["focal1"])
        check("fmtFocal uses equivalent when cropped", units["focal2"] == "56mm (84mm)", units["focal2"])
        check("fmtFocal hides duplicate equivalent", units["focal3"] == "24mm", units["focal3"])
        check("fmtISO number", units["iso1"] == "ISO 400", units["iso1"])
        check("fmtISO rational", units["iso2"] == "ISO 1600", units["iso2"])
        check("fmtDateTime colon string", units["date1"] == "2026.11.07 21:48", units["date1"])
        check("fileName pattern", units["file1"] == "Shutterplate_SONY-ILCE-7M4_202610241732.jpg", units["file1"])
        check("templateFor builds a date", units["tpl"] == "2026.01.02 03:04", units["tpl"])

        print("\n[browser] plate geometry")
        geo = page.evaluate("""() => {
          const out = {};
          for (const s of ['classic','studio','clean','film']) {
            const L = window.SPPlate.layout({w: 1536, h: 1024, img: null},
              {style: s, fields: {}, emblem: 'hd2lab', font: 'sans'});
            out[s] = {W: L.W, H: L.H, pad: L.padX, padTop: L.padTop, band: L.padBottom};
          }
          return out;
        }""")
        for s, g in geo.items():
            check(f"geometry {s}: plate wider than photo", g["W"] > 1536, json.dumps(g))
            check(f"geometry {s}: plate taller than photo", g["H"] > 1024, json.dumps(g))
            check(f"geometry {s}: bottom band > 0", g["band"] > 0, json.dumps(g))
        check("film plate reserves a taller top margin",
              geo["film"]["padTop"] > geo["classic"]["padTop"])

        print("\n[browser] canvas rendering")
        def canvas_sig():
            return page.evaluate("""() => {
              const c = document.querySelector('#plateCanvas');
              const ctx = c.getContext('2d');
              const d = ctx.getImageData(0, 0, c.width, c.height).data;
              let sum = 0, hash = 0, n = 0, min = 255, max = 0;
              for (let i = 0; i < d.length; i += 4 * 97) {
                const v = d[i] + d[i+1] + d[i+2];
                sum += v; hash = (hash * 31 + v) % 1000000007;
                min = Math.min(min, v); max = Math.max(max, v); n++;
              }
              return {hash, n, min, max, avg: sum / (n * 3)};
            }""")
        sig = canvas_sig()
        check("preview canvas painted", sig["n"] > 1000 and sig["max"] - sig["min"] > 120, json.dumps(sig))
        check("preview canvas not blank", sig["avg"] > 10, json.dumps(sig))
        pixel_check = page.evaluate("""() => {
          const c = document.querySelector('#plateCanvas');
          const box = document.querySelector('#stageCanvas');
          return {w: c.width, stage: box.clientWidth, dpr: window.devicePixelRatio};
        }""")
        check("preview canvas matches stage in device pixels",
              pixel_check["w"] >= pixel_check["stage"] * 0.9, json.dumps(pixel_check))

        sig_before = sig["hash"]
        page.evaluate("() => SPApp.setStyle('studio')")
        page.wait_for_timeout(350)
        check("style switch repaints canvas", canvas_sig()["hash"] != sig_before)
        check("style chip follows selection",
              "STUDIO DARK" in page.inner_text("#styleChip"))

        page.evaluate("() => SPApp.setField('caption', 'Jaehyuk Shim')")
        page.wait_for_timeout(250)
        sig_caption = canvas_sig()["hash"]
        check("caption edit repaints canvas", sig_caption not in (sig_before,))
        check("caption input reflects edit",
              page.input_value("#fCaption") == "Jaehyuk Shim")

        page.evaluate("() => SPApp.setField('iso', 'ISO 3200')")
        page.wait_for_timeout(250)
        check("ISO edit repaints canvas", canvas_sig()["hash"] != sig_caption)

        print("\n[browser] export")
        page.evaluate("() => SPApp.setStyle('classic')")
        page.wait_for_timeout(300)
        page.click('.acc[data-acc="export"] .acc-head')
        page.wait_for_timeout(250)
        readout = page.text_content("#exportSize") or ""
        want_w, want_h = [int(x) for x in re.findall(r"\d+", readout)[:2]]
        with page.expect_download(timeout=25000) as dl:
            page.click("#downloadBtn")
        download = dl.value
        tmp = os.path.join(ROOT, "tests", "_export_check.jpg")
        download.save_as(tmp)
        check("export suggested filename matches pattern",
              re.fullmatch(r"Shutterplate_[^\\/]+_\d{12}\.jpg", download.suggested_filename) is not None,
              download.suggested_filename)
        size = os.path.getsize(tmp)
        check("export file non-trivial", size > 30_000, f"{size} B")
        try:
            from PIL import Image
            im = Image.open(tmp)
            check("export dimensions match readout", im.size == (want_w, want_h),
                  f"file={im.size} readout={(want_w, want_h)}")
            check("export is JPEG", im.format == "JPEG", str(im.format))
        except ImportError:  # pragma: no cover
            skip("browser: export dimensions", "Pillow unavailable")
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)

        check("PNG format control exists",
              page.locator('button[data-format="png"]').count() == 1)

        check("no late console errors", not errors, str(errors[:3]))
        ctx.close()

        print("\n[browser] mobile ergonomics")
        dev = playwright.devices.get("iPhone 13", {"viewport": {"width": 390, "height": 844},
                                                  "device_scale_factor": 3, "is_mobile": True,
                                                  "has_touch": True})
        mctx = browser.new_context(**dev)
        mpage = mctx.new_page()
        merr = []
        mpage.on("pageerror", lambda e: merr.append(str(e)))
        mpage.goto(base, wait_until="networkidle")
        mpage.tap("#emptySampleBtn")
        mpage.wait_for_function("() => window.SPApp.state.photo", timeout=15000)
        mpage.wait_for_timeout(600)

        overflow = mpage.evaluate(
            "() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth})")
        check("mobile: no horizontal overflow", overflow["sw"] <= overflow["iw"] + 1, json.dumps(overflow))
        check("mobile: no page errors", not merr, str(merr[:3]))

        small = mpage.evaluate("""() => {
          const bad = [];
          for (const i of document.querySelectorAll('input:not([type=range]):not([type=file]), select')) {
            const fs = parseFloat(getComputedStyle(i).fontSize);
            if (fs < 16) bad.push(i.id || i.className);
          }
          return bad;
        }""")
        check("mobile: every input/select ≥16px", not small, str(small))

        tiny = mpage.evaluate("""() => {
          const bad = [];
          for (const b of document.querySelectorAll('button, a.portal-item, .dropzone')) {
            const r = b.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.height < 44 || r.width < 44) bad.push((b.id || b.className || b.textContent.trim().slice(0,12)));
          }
          return bad;
        }""")
        check("mobile: touch targets ≥44px", not tiny, str(tiny[:6]))

        sticky = mpage.evaluate("""() => {
          const s = getComputedStyle(document.querySelector('.stage'));
          return {pos: s.position, h: document.querySelector('.stage').getBoundingClientRect().height};
        }""")
        check("mobile: preview pinned (sticky)", sticky["pos"] == "sticky", json.dumps(sticky))
        vh = mpage.viewport_size["height"]
        check("mobile: preview uses ≥40% of viewport height",
              sticky["h"] >= vh * 0.4, f"h={sticky['h']} vh={vh}")

        mpage.evaluate("() => window.scrollTo(0, 600)")
        mpage.wait_for_timeout(300)
        pinned = mpage.evaluate("""() => {
          const r = document.querySelector('.stage').getBoundingClientRect();
          return {top: r.top, vh: window.innerHeight};
        }""")
        check("mobile: preview stays on screen while scrolling", pinned["top"] < 120, json.dumps(pinned))

        mctx.close()
    finally:
        browser.close()
        playwright.stop()


def main() -> int:
    print("PKPilot0003 · Shutterplate test suite")
    print(f"root: {ROOT}")
    static_tests()

    httpd, port = serve()
    try:
        browser_tests(port)
    finally:
        httpd.shutdown()

    total = len(PASS) + len(FAIL)
    print("\n" + "─" * 62)
    print(f"PASS {len(PASS)} · FAIL {len(FAIL)} · SKIP {len(SKIP)} · total {total}")
    if FAIL:
        print("\nFailures:")
        for name, detail in FAIL:
            print(f"  ✗ {name}" + (f" — {detail}" if detail else ""))
    print("─" * 62)
    return 0 if not FAIL else 1


if __name__ == "__main__":
    sys.exit(main())
