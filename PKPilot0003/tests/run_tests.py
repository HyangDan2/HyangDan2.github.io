#!/usr/bin/env python3
"""
PKPilot0003 · Shutterplate — automated test suite
=================================================
Two layers:

  [static]   HTML semantics, SVG sprite integrity, asset references, brand
             assets, CSS tokens, compact-viewport rules, 8 frame signatures —
             pure Python.
  [browser]  Real Chromium run: EXIF parsing of the bundled samples, formatter
             units, 8-frame geometry & distinct rendering, frame strip,
             sheet open/close, upload-state transition, export dimensions,
             mobile ergonomics (320/390: no overflow, 16px inputs, 44px targets,
             single-line header, one-row session card).

Usage:
    python3 tests/run_tests.py [-v]

Exits 0 only when every executed check passes. Browser checks SKIP (and the run
still passes) when Playwright/Chromium is unavailable in the environment.
"""
from __future__ import annotations

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

# The eight signatures the brief fixes by name and order.
FRAMES = [
    ("horizon", "Clean Horizon"),
    ("gallery", "Classic Gallery"),
    ("dual", "Dual Deck"),
    ("strap", "Strap Bar"),
    ("film", "Film Sprocket"),
    ("studio", "Studio Dark"),
    ("edge", "Minimal Edge"),
    ("pro", "Pro Studio"),
]
MARK_PATH = "M15 20L35 10V43L15 53ZM29 24L49 14V47L29 57Z"


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

    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()
    check("title is the agreed product line",
          title == "Shutterplate — HD2Lab Photo Frame Studio", title)
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
    check("og:title names both brands",
          "Shutterplate" in (og.get("og:title") or "") and "HD2Lab" in (og.get("og:title") or ""))
    check("twitter summary_large_image",
          any(t == "meta" and d.get("name") == "twitter:card"
              and d.get("content") == "summary_large_image" for t, d in c.tags))

    dupes = {i for i in c.ids if c.ids.count(i) > 1}
    check("html ids unique", not dupes, f"duplicates: {sorted(dupes)}")

    refs = []
    for t, d in c.tags:
        if t == "script" and d.get("src"):
            refs.append(d["src"].split("?")[0])
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
    check("sprite has symbols", len(symbols) >= 28, f"count={len(symbols)}")
    check("symbol ids unique", len(ids) == len(set(ids)))
    check("every symbol has a viewBox",
          all(re.fullmatch(r"0 0 [\d.]+ [\d.]+", s[1]) for s in symbols))
    check("every symbol has geometry",
          all(("<path" in s[2] or "<circle" in s[2] or "<rect" in s[2]) for s in symbols))

    required_icons = [
        "i-camera", "i-optics", "i-focal", "i-aperture", "i-shutter", "i-iso",
        "i-date", "i-caption", "i-upload", "i-download", "i-image", "i-dots",
        "i-sliders", "i-frame", "i-stamp", "i-ratio", "i-swap", "i-close",
        "i-portal-home", "i-portal-apps",
    ]
    check("all deck/UI icons present", all(i in ids for i in required_icons),
          str([i for i in required_icons if i not in ids]))
    uses = set(re.findall(r'use href="#([^"]+)"', html))
    dangling = {u for u in uses if u not in ids}
    check("<use> references resolve", not dangling, str(sorted(dangling)))

    # ── header / brand ───────────────────────────────────────────────────────
    print("\n[static] header, portal menu, brief structure")
    check("header carries the official dual-skew path", MARK_PATH in html)
    check("brand name is Shutterplate", 'class="brand-name">Shutterplate<' in html)
    check("brand badge is HD2Lab", 'class="brand-badge">HD2Lab<' in html)
    check("no PKPilot0003 stamp in the header",
          "PKPilot0003" not in re.search(r"<header.*?</header>", html, re.S).group(0))
    check("no 'CRAFT · SHUTTERPLATE' header meta", "CRAFT · SHUTTERPLATE" not in html)

    portal = re.search(r'<div class="portal-menu-dropdown".*?</div>\s*</div>', html, re.S).group(0)
    links = re.findall(r'<a class="portal-item"[^>]*href="([^"]+)"', portal)
    check("portal menu has exactly two links", len(links) == 2, str(links))
    check("portal keeps Web-HQ + ApplicationHub",
          any("hyangdan2.github.io/" == l.rstrip("/").split("//")[-1] + "/" or l == "https://hyangdan2.github.io/"
              for l in links) and any("ApplicationHub" in l for l in links), str(links))
    check("GameHub removed from portal", "GameHub" not in html)
    check("TechnicalHub removed from portal", "TechnicalHub" not in html)

    # upload zone & session card
    check("dropzone present in the empty state", 'id="dropzone"' in html)
    check("sample button present in the empty state", 'id="emptySampleBtn"' in html)
    for i in ("sessionCard", "sessionThumb", "metaName", "metaSize", "metaExif",
              "changeBtn", "clearBtn"):
        check(f"session card element {i}", f'id="{i}"' in html)
    check("session card starts hidden", re.search(r'id="sessionCard"[^>]*hidden', html) is not None)

    # tool bar / sheets
    sheet_buttons = re.findall(r'data-sheet="([a-z]+)"', html)
    check("four control-sheet buttons", sheet_buttons == ["exif", "geometry", "emblem", "export"],
          str(sheet_buttons))
    panes = re.findall(r'data-pane="([a-z]+)"', html)
    check("four control panes", panes == ["exif", "geometry", "emblem", "export"], str(panes))
    check("sheet starts closed (aria-hidden)",
          re.search(r'id="sheet"[^>]*aria-hidden="true"', html) is not None)
    check("duplicate accordion layout removed", 'class="acc"' not in html)

    fields = set(re.findall(r'id="f([A-Z]\w+)"', html))
    check("nine deck fields",
          {"Make", "Model", "Lens", "Focal", "Aperture", "Shutter", "Iso", "Date", "Caption"} <= fields,
          str(fields))
    check("ratio control present", 'id="ratioSelect"' in html)
    check("privacy claim shown", "0 B" in html)

    # in-app browser notice (KakaoTalk & friends block blob: saves)
    check("in-app notice in the landing and the result card",
          html.count("data-inapp-banner") == 2, str(html.count("data-inapp-banner")))
    check("in-app notice starts hidden",
          len(re.findall(r'class="inapp-banner"[^>]*hidden', html)) == 2)
    check("address-copy button in the notice", html.count("data-copy-url") == 2,
          str(html.count("data-copy-url")))
    check("copy icon in the sprite", "i-copy" in ids)

    # ── frame engine source ──────────────────────────────────────────────────
    print("\n[static] eight frame signatures")
    plate = read("js/plate.js")
    order = re.search(r"var ORDER = \[([^\]]+)\]", plate)
    got = [s.strip().strip("'\"") for s in order.group(1).split(",")] if order else []
    check("eight frames in ORDER", len(got) == 8, str(got))
    check("frame ids match the brief", got == [f[0] for f in FRAMES], str(got))
    painters = re.search(r"var PAINTERS = \{([^}]*)\}", plate)
    registered = re.findall(r"(\w+):\s*draw\w+", painters.group(1)) if painters else []
    for fid, label in FRAMES:
        check(f"frame {fid} labelled '{label}'", f"label: '{label}'" in plate)
        check(f"frame {fid} has a painter", fid in registered, str(registered))
    check("no legacy four-style ids left",
          not re.search(r"style:\s*'(classic|clean)'", read("app.js")))
    for kw in ("sprocket", "corner bracket", "strap", "grid"):
        check(f"plate engine covers {kw}", kw.lower() in plate.lower())

    emblems = read("js/emblems.js")
    check("official mark path in emblem engine", MARK_PATH in emblems)
    check("emblem engine exposes MARK_PATH", "MARK_PATH: MARK_PATH" in emblems)
    maker_count = len(re.findall(r"id: '(\w+)', name: '", emblems))
    check("eleven maker emblems kept", maker_count == 11, str(maker_count))
    for maker in ("sony", "canon", "nikon", "fujifilm", "samsung", "leica", "hasselblad",
                  "apple", "lumix", "omsystem", "hd2lab"):
        check(f"maker emblem {maker}", f"id: '{maker}'" in emblems)

    # ── brands are the makers' own artwork, not type set in a system face ────
    print("\n[static] official brand artwork")
    specs = {}
    for m in re.finditer(r"id: '(\w+)', name: '([^']+)', vb: \[([\d.]+), ([\d.]+)\]", emblems):
        specs[m.group(1)] = (float(m.group(3)), float(m.group(4)))
    check("every emblem has a viewBox", len(specs) == 11, str(sorted(specs)))
    sources_doc = read("EMBLEM-SOURCES.md") if os.path.exists(os.path.join(ROOT, "EMBLEM-SOURCES.md")) else ""
    check("emblem source ledger present", bool(sources_doc))
    for maker, (w, h) in specs.items():
        if maker == "hd2lab":
            continue
        block = re.search(r"id: '%s'.*?(?=\n    \{|\n  \];)" % maker, emblems, re.S)
        body = block.group(0) if block else ""
        check(f"emblem {maker} is drawn from vector paths",
              bool(re.search(r"p\('M[-\d.]", body)) and not re.search(r"t\('", body))
        check(f"emblem {maker} keeps a 100-unit height", abs(h - 100) < 0.01, str(h))
        check(f"emblem {maker} keeps its source aspect", w > 60, str(w))
        check(f"emblem {maker} cites its source file",
              ("commons.wikimedia.org" in sources_doc or "nikon.com" in sources_doc or
               "omsystem.com" in sources_doc) and maker in sources_doc.lower())
    check("hd2lab keeps the project wordmark", "t('HD2LAB'" in emblems)
    # p(d, fill, stroke, sw, rule) — a rule written into the stroke slot silently
    # fills the Leica roundel solid, so the argument positions are checked here
    check("no emblem passes a fill rule as the stroke colour",
          not re.search(r"p\('M[^']*', '[a-z]+', 'evenodd'\)", emblems))
    leica_block = re.search(r"id: 'leica'.*?\n    \}", emblems, re.S)
    check("leica keeps its knockout fill rule",
          bool(leica_block) and ", null, 0, 'evenodd')" in leica_block.group(0),
          (leica_block.group(0)[-80:] if leica_block else "no leica spec"))
    for name, want in (("sony", 568.2), ("canon", 481.4), ("nikon", 361.6),
                       ("fujifilm", 600.9), ("samsung", 652.9), ("hasselblad", 1276.6),
                       ("apple", 81.4), ("lumix", 513.9), ("omsystem", 868.8)):
        got = specs.get(name, (0, 100))[0]
        check(f"emblem {name} aspect matches the official file", abs(got - want) < 1.5,
              f"{got} vs {want}")
    check("leica keeps the roundel square", abs(specs.get("leica", (0, 0))[0] - 100) < 0.5,
          str(specs.get("leica")))

    # ── CSS ──────────────────────────────────────────────────────────────────
    print("\n[static] CSS tokens & compact viewport rules")
    css = read("style.css")
    check("dark token #101110", "#101110" in css)
    check("accent token #ff824f", "#ff824f" in css)
    check("body locks the viewport (no page scroll)",
          re.search(r"body\s*\{[^}]*height:\s*100dvh", css, re.S) is not None
          and re.search(r"body\s*\{[^}]*overflow:\s*hidden", css, re.S) is not None)
    check("studio fills 100dvh",
          re.search(r"\.studio\s*\{[^}]*flex:\s*1 1 auto", css, re.S) is not None)
    check("inputs are 16px (iOS zoom guard)",
          re.search(r"\.inp,[^{]*\{[^}]*font-size:\s*16px", css, re.S) is not None,
          "expected .inp { font-size: 16px }")
    check("no sub-16px input override",
          not re.search(r"input[^{]*\{[^}]*font-size:\s*(1[0-5]|[0-9])px", css))

    def target_ok(sel: str) -> bool:
        m = re.search(re.escape(sel) + r"(?![\w-])[^{]*\{([^}]*)\}", css, re.S)
        if not m:
            return False
        body = m.group(1)
        heights = [int(v) for v in re.findall(r"(?:min-)?height:\s*(\d+)px", body)]
        return bool(heights) and max(heights) >= 44

    for sel in (".btn", ".icon-btn", ".portal-menu-btn", ".dropzone", ".emblem-tile",
                ".frame-card", ".tool", ".hbtn"):
        check(f"44px touch target: {sel}", target_ok(sel))
    check("range inputs are 44px tall",
          re.search(r'input\[type="range"\][^{]*\{[^}]*height:\s*44px', css, re.S) is not None)
    check("frame strip scrolls horizontally",
          re.search(r"\.strip-track\s*\{[^}]*overflow-x:\s*auto", css, re.S) is not None)
    check("selected frame ring uses the accent",
          re.search(r'\.frame-card\[aria-checked="true"\][^}]*border-color:\s*var\(--accent\)', css, re.S)
          is not None)
    check("sheet is parked off-screen by default",
          re.search(r"\.sheet\s*\{[^}]*visibility:\s*hidden", css, re.S) is not None
          and "translateY(101%)" in css)
    check("desktop sheet floats as a side panel",
          re.search(r"@media \(min-width: 900px\)[\s\S]*?\.sheet\s*\{[^}]*width:\s*420px", css) is not None)
    check("bottom sheet on mobile",
          re.search(r"\.sheet\s*\{[^}]*left:\s*0;\s*right:\s*0;\s*bottom:\s*0", css, re.S) is not None)
    check("prefers-reduced-motion honoured", "prefers-reduced-motion" in css)
    check("touch-action none on canvas",
          re.search(r"\.stage-canvas\s*\{[^}]*touch-action:\s*none", css) is not None)
    check("320px header rules exist", "@media (max-width: 359px)" in css)
    check("safe-area insets respected", css.count("env(safe-area-inset") >= 3)

    # ── manifest / vendor / brand assets ─────────────────────────────────────
    print("\n[static] manifest, vendored EXIF & brand assets")
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
    check("exifr loaded from local vendor", "js/vendor/exifr.full.umd.js" in html)
    check("4096px export guard", "4096" in app)
    check("export filename pattern", "Shutterplate_" in read("js/exif-core.js"))

    favicon = read("favicon.svg")
    check("favicon.svg uses the dual-skew mark", MARK_PATH in favicon and "#101110" in favicon)
    check("favicon.svg round-square radius 12", 'rx="12"' in favicon)
    gen = read("tools/generate_brand_assets.py")
    check("generator draws the dual-skew mark", MARK_PATH in gen)
    check("generator emits the full icon suite",
          all(n in gen for n in ("favicon.ico", "favicon-32x32.png", "apple-touch-icon.png",
                                 "icon-192.png", "icon-512.png", "og-image.png",
                                 "social-preview.png")))
    try:
        from PIL import Image
        for name, size in (("og-image.png", (1200, 630)), ("social-preview.png", (1200, 630)),
                           ("favicon-32x32.png", (32, 32)), ("apple-touch-icon.png", (180, 180)),
                           ("icon-192.png", (192, 192)), ("icon-512.png", (512, 512))):
            im = Image.open(os.path.join(ROOT, name))
            check(f"{name} is {size[0]}×{size[1]}", im.size == size, str(im.size))
        ico = Image.open(os.path.join(ROOT, "favicon.ico"))
        check("favicon.ico has multiple sizes", len(getattr(ico, "info", {}).get("sizes", set())) >= 2
              or ico.size[0] >= 32, str(ico.size))
    except ImportError:
        skip("brand asset dimensions", "Pillow unavailable")


# ── browser tests ────────────────────────────────────────────────────────────
SAMPLE_EXPECT = {
    "make": "SONY", "model": "ILCE-7M4", "lens": "FE 35mm F1.4 GM",
    "focal": "35mm", "aperture": "ƒ/1.8", "shutter": "1/250s",
    "iso": "ISO 100", "datetime": "2026.10.24 17:32", "caption": "HD2Lab",
}

# A real KakaoTalk Android WebView UA — the host whose WebView refused the
# blob: download that produced "지원하지 않는 파일 형식".
KAKAO_UA = ("Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 "
            "Mobile Safari/537.36 KAKAOTALK 10.3.0 (inapp)")
CHROME_UA = ("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) "
             "Chrome/124.0.0.0 Mobile Safari/537.36")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, port


SIG_JS = """() => {
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
}"""


def canvas_sig(page):
    return page.evaluate(SIG_JS)


# ── fit matrix: what each frame actually paints ──────────────────────────────
# Real Chromium metrics, recorded while the plate is painted: every glyph run's
# box, every emblem's box and every sprocket hole. That lets the suite prove
# the things a screenshot only hints at — no line falls back to «…», nothing is
# painted off the plate, and no two things are drawn on top of each other.
FIT_CASES = [
    ("iphone", {
        "make": "Apple", "model": "iPhone 15 Pro",
        "lens": "iPhone 15 Pro back triple camera 6.765mm f/1.78",
        "focal": "24mm (24mm)", "aperture": "ƒ/1.78", "shutter": "1/1200s",
        "iso": "ISO 400", "datetime": "2026.11.14 09:12", "caption": "가을 아침 창원의 빛",
    }, "hasselblad"),
    ("wide", {
        "make": "Hasselblad", "model": "X2D 100C",
        "lens": "XCD 4/21mm · 24mm (24mm) equivalent ultra wide",
        "focal": "45mm (35mm)", "aperture": "ƒ/4", "shutter": "1/1250s",
        "iso": "ISO 1600", "datetime": "2026.11.09 18:41",
        "caption": "Golden hour by the reservoir",
    }, "hd2lab"),
    ("noexif", {}, "none"),
    # a narrow maker mark leaves the most room for copy — the case where the
    # right column is measured against the widest spec and can still overflow
    ("samsung", {
        "make": "SAMSUNG", "model": "NX500",
        "lens": "NX 16-50mm F3.5-5.6 PZ OIS", "focal": "24mm (24mm)",
        "aperture": "ƒ/3.5", "shutter": "1/250s", "iso": "ISO 800",
        "datetime": "2026.11.14 09:12", "caption": "창원 바다의 아침",
    }, "samsung"),
    ("apple", {
        "make": "Apple", "model": "iPhone 15 Pro",
        "lens": "iPhone 15 Pro back triple camera 6.765mm f/1.78",
        "focal": "24mm (24mm)", "aperture": "ƒ/1.78", "shutter": "1/1200s",
        "iso": "ISO 400", "datetime": "2026.11.14 09:12", "caption": "가을 아침 창원의 빛",
    }, "apple"),
]
# 1024×1536 is the bundled portrait sample, i.e. the frame a visitor loads first
FIT_SIZES = [("2:3", 1200, 1800), ("2:3s", 1024, 1536), ("3:4", 1500, 2000), ("3:2", 1536, 1024)]

FIT_JS = """(matrix) => {
  const out = {plates: 0, ellipsis: [], overflow: [], collide: [], byStyle: {}, holes: {},
               filmSlack: 1e9};
  const c = document.createElement('canvas');
  const seen = {};
  for (const item of matrix) {
    const L = SPPlate.layout({w: item.w, h: item.h, img: null}, {
      style: item.style, fields: item.fields, emblem: item.emblem, font: 'sans',
      stock: 'KODAK PORTRA 400', frameNo: '#03', padPct: item.padPct
    });
    c.width = Math.max(1, Math.round(L.W));
    c.height = Math.max(1, Math.round(L.H));
    const ctx = c.getContext('2d');
    const texts = [], rects = [], emblems = [];
    let inEmblem = false;
    const origFT = ctx.fillText.bind(ctx), origRR = ctx.roundRect.bind(ctx);
    ctx.fillText = function (s, x, y) {
      if (!inEmblem) {
        const m = this.measureText(String(s));
        const px = parseFloat((/(\\d+(?:\\.\\d+)?)px/.exec(this.font) || [0, 0])[1]) || 1;
        const asc = m.actualBoundingBoxAscent || px * 0.8;
        const desc = m.actualBoundingBoxDescent || 0;
        const wd = m.width, al = this.textAlign;
        const x0 = al === 'center' ? x - wd / 2 : al === 'right' ? x - wd : x;
        texts.push({s: String(s), x0: x0, x1: x0 + wd, y0: y - asc, y1: y + desc});
      }
      return origFT(s, x, y);
    };
    ctx.roundRect = function (x, y, wd, hh, r) {
      rects.push({x: x, y: y, w: wd, h: hh});
      return origRR(x, y, wd, hh, r);
    };
    const em = SPEmblems.draw;
    SPEmblems.draw = function (c2, id, x, y, wd, hh) {
      const prev = inEmblem;
      if (c2 === ctx) { inEmblem = true; emblems.push({id: id, x: x, y: y, w: wd, h: hh}); }
      try { return em.apply(this, arguments); } finally { inEmblem = prev; }
    };
    try { SPPlate.paint(ctx, L); } finally { SPEmblems.draw = em; }

    out.plates++;
    const label = item.style + '/' + item.case + '/' + item.size + '/pad' + item.padPct;
    const style = out.byStyle[item.style] || (out.byStyle[item.style] = {plates: 0, ellipsis: 0});
    style.plates++;

    for (const t of texts) {
      if (t.s.indexOf('…') >= 0) {
        style.ellipsis++;
        out.ellipsis.push([label, t.s]);
      }
      if (t.x0 < -0.5 || t.x1 > L.W + 0.5 || t.y0 < -0.5 || t.y1 > L.H + 0.5) {
        out.overflow.push([label, t.s, Math.round(t.x0), Math.round(t.x1)]);
      }
    }
    const hit = (a, b) => {
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      return ox > 0.5 && oy > 0.5;
    };
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        if (hit(texts[i], texts[j])) out.collide.push([label, 'text', texts[i].s, texts[j].s]);
      }
    }
    for (const e of emblems) {
      const eb = {x0: e.x, x1: e.x + e.w, y0: e.y, y1: e.y + e.h};
      for (const t of texts) if (hit(eb, t)) out.collide.push([label, 'emblem', e.id, t.s]);
    }
    const holes = rects.filter(r => r.h < L.H * 0.06 && r.w < L.W * 0.06);
    out.holes[item.style] = Math.max(out.holes[item.style] || 0, holes.length);
    for (const h of holes) {
      const hb = {x0: h.x, x1: h.x + h.w, y0: h.y, y1: h.y + h.h};
      for (const t of texts) if (hit(hb, t)) out.collide.push([label, 'hole', 'sprocket', t.s]);
    }
    /* Film Sprocket: the lowest line of copy must sit clear above the bottom
       row of perforations, which is the defect this frame was fixed for */
    if (item.style === 'film') {
      const band = L.band;
      const holeTop = L.H - band * 0.095;
      const lowest = texts.reduce((m, t) => Math.max(m, t.y1), -1e9);
      out.filmSlack = Math.min(out.filmSlack, holeTop - lowest);
    }
  }
  out.ellipsis = out.ellipsis.slice(0, 6);
  out.overflow = out.overflow.slice(0, 6);
  out.collide = out.collide.slice(0, 6);
  return out;
}"""


TEXT_JS = """() => {
  const c = document.createElement('canvas');
  c.width = 900; c.height = 140;
  const ctx = c.getContext('2d');
  const H = SPPlate.helpers;
  const s = '1/1250s · ISO 1600';
  const opt = {size: 40, family: 'mono', color: '#000', ls: 2};
  const nominal = H.measure(ctx, s, opt);
  const paint = (fn) => {
    let acc = '';
    const orig = ctx.fillText.bind(ctx);
    ctx.fillText = function (t, x, y) { acc += String(t); return orig(t, x, y); };
    let w;
    try { w = fn(); } finally { ctx.fillText = orig; }
    return {text: acc, w: w};
  };
  return {
    nominal: nominal,
    half: paint(() => H.text(ctx, s, 20, 90, Object.assign({}, opt, {maxW: nominal * 0.5}))),
    tight: paint(() => H.text(ctx, s, 20, 90, Object.assign({}, opt, {maxW: nominal * 0.4}))),
    compound: paint(() => H.compound(ctx, [
      {s: 'Hasselblad', size: 34, weight: 700, family: 'sans', color: '#000', ls: 1},
      {s: '  X2D 100C', size: 34, weight: 300, family: 'sans', color: '#000', ls: 1}
    ], 20, 90, 'left', H.measure(ctx, 'Hasselblad  X2D 100C', {size: 34, family: 'sans'}) * 0.5)),
    compoundTight: paint(() => H.compound(ctx, [
      {s: 'Hasselblad', size: 34, weight: 700, family: 'sans', color: '#000', ls: 1},
      {s: '  X2D 100C', size: 34, weight: 300, family: 'sans', color: '#000', ls: 1}
    ], 20, 90, 'left', H.measure(ctx, 'Hasselblad  X2D 100C', {size: 34, family: 'sans'}) * 0.3)),
  };
}"""


def browser_tests(port):
    names = [f"browser: {x}" for x in ("desktop", "frames", "sheets", "export", "mobile", "small",
                                       "share", "inapp")]
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:  # pragma: no cover
        for n in names:
            skip(n, f"playwright unavailable ({e})")
        return

    playwright = sync_playwright().start()
    try:
        browser = playwright.chromium.launch()
    except Exception as e:  # pragma: no cover
        for n in names:
            skip(n, f"chromium unavailable ({str(e).splitlines()[0]})")
        playwright.stop()
        return

    base = f"http://127.0.0.1:{port}/"
    errors = []

    try:
        # ── desktop: empty state → upload → frames ──────────────────────────
        print("\n[browser] boot, upload state transition & eight frames")
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, accept_downloads=True)
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(base, wait_until="networkidle")
        page.wait_for_timeout(300)

        check("browser: no console/page errors", not errors, str(errors[:3]))
        check("browser: modules exposed", page.evaluate(
            "() => !!(window.SPPlate && window.SPExif && window.SPEmblems && window.exifr)"))

        # empty state ⇄ session card
        check("empty: dropzone visible", page.is_visible("#dropzone"))
        check("empty: sample button visible", page.is_visible("#emptySampleBtn"))
        check("empty: session card hidden", not page.is_visible("#sessionCard"))
        check("empty: export disabled", page.is_disabled("#downloadBtn")
              and page.is_disabled("#headerDownloadBtn"))
        check("empty: no page scroll", page.evaluate(
            "() => document.documentElement.scrollHeight <= window.innerHeight + 1"))

        # the strip previews all eight frames before a photo exists
        cards = page.locator(".frame-card")
        check("strip: eight frame cards", cards.count() == 8, str(cards.count()))
        empties = page.evaluate("""() => {
          const out = [];
          document.querySelectorAll('.frame-card').forEach(card => {
            const cv = card.querySelector('canvas');
            const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
            let min = 255, max = 0;
            for (let i = 0; i < d.length; i += 4 * 37) { const v = d[i]+d[i+1]+d[i+2]; min = Math.min(min,v); max = Math.max(max,v); }
            out.push(max - min);
          });
          return out;
        }""")
        check("strip: every preview painted", all(v > 40 for v in empties), str(empties))
        check("strip: cards carry name + feature badge", page.evaluate(
            """() => [...document.querySelectorAll('.frame-card')].every(c =>
                 c.querySelector('.frame-name').textContent.trim().length > 2 &&
                 c.querySelector('.frame-badge').textContent.trim().length > 1)"""))

        # upload → compact session card
        page.click("#emptySampleBtn")
        page.wait_for_function("() => window.SPApp.state.photo && window.SPApp.state.photo.w > 0",
                               timeout=15000)
        page.wait_for_timeout(600)

        check("upload: empty state hidden", not page.is_visible("#emptyState"))
        check("upload: session card shown", page.is_visible("#sessionCard"))
        check("upload: session card is one row", page.evaluate(
            "() => document.querySelector('#sessionCard').getBoundingClientRect().height") <= 72,
            str(page.evaluate("() => document.querySelector('#sessionCard').getBoundingClientRect().height")))
        check("upload: session thumbnails the photo",
              page.evaluate("() => { const c = document.querySelector('#sessionThumb');"
                            " const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data;"
                            " let s = 0; for (let i=0;i<d.length;i+=4*53) s += d[i]+d[i+1]+d[i+2];"
                            " return s > 0; }"))
        check("upload: filename shown", page.inner_text("#metaName").endswith(".jpg"))
        check("upload: resolution shown", re.match(r"\d+ × \d+", page.inner_text("#metaSize")) is not None,
              page.inner_text("#metaSize"))
        check("upload: EXIF chip shown", "tags" in page.inner_text("#metaExif"))
        check("upload: change/clear buttons present",
              page.is_visible("#changeBtn") and page.is_visible("#clearBtn"))
        check("upload: download enabled", page.is_enabled("#downloadBtn"))

        fields = page.evaluate("() => window.SPApp.state.fields")
        for k, v in SAMPLE_EXPECT.items():
            check(f"EXIF field {k} = {v}", fields.get(k) == v, f"got {fields.get(k)!r}")
        check("auto emblem from Make = sony",
              page.evaluate("() => window.SPApp.state.autoEmblem") == "sony")

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

        print("\n[browser] maker passed through verbatim (no forced rewriting)")
        makers = page.evaluate("""() => {
          const E = window.SPExif;
          return {
            lower: E.fromTags({Make: 'samsung', Model: 'Galaxy S24 Ultra'}),
            upper: E.fromTags({Make: 'SAMSUNG', Model: 'Galaxy S24 Ultra'}),
            mixed: E.fromTags({Make: 'Samsung', Model: 'Galaxy S24 Ultra'}),
            dedupe: E.fromTags({Make: 'samsung', Model: 'samsung Galaxy S24'}),
            space: E.fromTags({Make: '  samsung  ', Model: 'SM-S928N'}),
            sony: E.fromTags({Make: 'SONY', Model: 'ILCE-7M4'}),
            nikon: E.fromTags({Make: 'NIKON CORPORATION', Model: 'NIKON Z 8'}),
            none: E.fromTags({})
          };
        }""")
        check("make 'samsung' is kept verbatim (not recased)", makers["lower"]["make"] == "samsung",
              repr(makers["lower"]["make"]))
        check("make 'SAMSUNG' is kept verbatim", makers["upper"]["make"] == "SAMSUNG",
              repr(makers["upper"]["make"]))
        check("make 'Samsung' is kept verbatim", makers["mixed"]["make"] == "Samsung",
              repr(makers["mixed"]["make"]))
        check("only surrounding whitespace is trimmed, case is untouched",
              makers["space"]["make"] == "samsung", repr(makers["space"]["make"]))
        check("samsung: model survives untouched",
              makers["lower"]["model"] == "Galaxy S24 Ultra", repr(makers["lower"]["model"]))
        check("samsung: maker repeated in model is stripped once",
              makers["dedupe"]["model"] == "Galaxy S24", repr(makers["dedupe"]["model"]))
        check("other makers untouched (SONY, NIKON CORPORATION)",
              makers["sony"]["make"] == "SONY" and makers["nikon"]["make"] == "NIKON CORPORATION",
              repr((makers["sony"]["make"], makers["nikon"]["make"])))
        check("no make stays empty", makers["none"]["make"] == "", repr(makers["none"]["make"]))

        print("\n[browser] eight frames: geometry, painting, selection")
        sig0 = canvas_sig(page)
        check("preview canvas painted", sig0["n"] > 1000 and sig0["max"] - sig0["min"] > 120,
              json.dumps(sig0))

        geo = page.evaluate("""() => {
          const out = {};
          for (const s of window.SPPlate.ORDER) {
            const L = window.SPPlate.layout({w: 1536, h: 1024, img: null},
              {style: s, fields: window.SPApp.state.fields, emblem: 'hd2lab', font: 'sans'});
            out[s] = {W: L.W, H: L.H, pad: L.padX, padTop: L.padTop, band: L.band};
          }
          return out;
        }""")
        flush = {"strap"}
        for fid, label in FRAMES:
            g = geo.get(fid, {})
            check(f"geometry {label}: plate at least as wide as the photo",
                  g.get("W", 0) >= 1536 and (g["W"] > 1536 or fid in flush), json.dumps(g))
            check(f"geometry {label}: plate taller than photo", g.get("H", 0) > 1024, json.dumps(g))
            check(f"geometry {label}: band reserved", g.get("band", 0) > 0, json.dumps(g))
        check("Film Sprocket reserves a taller top margin",
              geo["film"]["padTop"] > geo["gallery"]["padTop"])
        check("Strap Bar keeps the photo flush (no side padding)", geo["strap"]["pad"] == 0,
              json.dumps(geo["strap"]))
        check("Minimal Edge keeps a slim border", 0 < geo["edge"]["pad"] < geo["gallery"]["pad"],
              json.dumps(geo["edge"]))
        check("Pro Studio reserves the deepest band", geo["pro"]["band"] >= geo["gallery"]["band"])

        page.evaluate("() => SPApp.setStyle('pro')")
        page.wait_for_timeout(260)
        prev_hash = canvas_sig(page)["hash"]
        hashes = {}
        for fid, label in FRAMES:
            page.click(f'.frame-card[data-style="{fid}"]')
            page.wait_for_timeout(240)
            sig = canvas_sig(page)
            hashes[fid] = sig["hash"]
            prev_hash, was = sig["hash"], prev_hash
            checked = page.evaluate(
                """() => [...document.querySelectorAll('.frame-card')]
                     .filter(c => c.getAttribute('aria-checked') === 'true')
                     .map(c => c.dataset.style)""")
            check(f"frame {label}: taps select it", checked == [fid], str(checked))
            check(f"frame {label}: canvas repaints", sig["hash"] != was, f"{fid} unchanged")
            check(f"frame {label}: chip follows", label.upper() in page.inner_text("#styleChip"),
                  page.inner_text("#styleChip"))
            check(f"frame {label}: strip preview stays painted", page.evaluate(
                """(id) => { const cv = document.querySelector(`.frame-card[data-style="${id}"] canvas`);
                     const d = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
                     let min = 255, max = 0;
                     for (let i = 0; i < d.length; i += 4*37) { const v = d[i]+d[i+1]+d[i+2];
                       min = Math.min(min,v); max = Math.max(max,v); }
                     return max - min > 40; }""", fid))
        dup = len(set(hashes.values())) != len(hashes)
        check("all eight frames render differently", not dup, json.dumps(hashes))

        # ── fit matrix: portrait plates, long iPhone EXIF, wide emblems ────
        print("\n[browser] frame text fitting (portrait plates, long EXIF, wide emblems)")
        matrix = []
        for cname, fields, emblem in FIT_CASES:
            for sname, w, h in FIT_SIZES:
                for fid, _label in FRAMES:
                    matrix.append({"style": fid, "case": cname, "size": sname,
                                   "fields": fields, "emblem": emblem,
                                   "w": w, "h": h, "padPct": None})
        fit = page.evaluate(FIT_JS, matrix)
        check(f"fit: {len(matrix)} stressed plates painted", fit["plates"] == len(matrix),
              f"painted {fit['plates']}")
        check("fit: not one line falls back to the ellipsis", not fit["ellipsis"],
              json.dumps(fit["ellipsis"], ensure_ascii=False))
        check("fit: nothing painted off the plate", not fit["overflow"],
              json.dumps(fit["overflow"], ensure_ascii=False))
        check("fit: no text over text, emblem or sprocket hole", not fit["collide"],
              json.dumps(fit["collide"], ensure_ascii=False))
        check("fit: Film Sprocket keeps its lowest line above the perforations",
              fit["filmSlack"] > 0, f"slack={fit['filmSlack']:.1f}px")
        for fid, label in FRAMES:
            got = (fit["byStyle"].get(fid) or {})
            check(f"fit: {label} never ellipsises on a portrait plate",
                  got.get("ellipsis") == 0, f"{got.get('ellipsis')} line(s)")
        studio_cut = [e for e in fit["ellipsis"] if e[0].startswith("studio/")]
        check("fit: Studio Dark keeps the full exposure row (ISO 400 / 1600)",
              not studio_cut, json.dumps(studio_cut, ensure_ascii=False))
        check("fit: Strap Bar keeps its exposure row whole",
              not [e for e in fit["ellipsis"] if e[0].startswith("strap/")],
              json.dumps([e for e in fit["ellipsis"] if e[0].startswith("strap/")],
                         ensure_ascii=False))

        # ── every one of the eleven marks on every frame ──────────────────
        # The brand marks are the makers' own artwork now, so their widths run
        # from Apple's near-square glyph to the 12.8:1 Hasselblad wordmark.
        # This paints each mark on each frame on a portrait plate and a wide
        # one, and asks the same questions: nothing off the plate, nothing on
        # top of anything else, no line collapsed to «…».
        print("\n[browser] eleven emblems across eight frames")
        em_matrix = []
        for eid in ("sony", "canon", "nikon", "fujifilm", "samsung", "leica",
                    "hasselblad", "apple", "lumix", "omsystem", "hd2lab"):
            for sname, w, h in (("2:3", 1200, 1800), ("3:2", 1536, 1024)):
                for fid, _label in FRAMES:
                    em_matrix.append({"style": fid, "case": eid, "size": sname,
                                      "fields": FIT_CASES[0][1], "emblem": eid,
                                      "w": w, "h": h, "padPct": None})
        emf = page.evaluate(FIT_JS, em_matrix)
        check(f"emblems: {len(em_matrix)} plates painted", emf["plates"] == len(em_matrix),
              f"painted {emf['plates']}")
        check("emblems: nothing painted off the plate", not emf["overflow"],
              json.dumps(emf["overflow"], ensure_ascii=False)[:400])
        check("emblems: no text over text, emblem or sprocket hole", not emf["collide"],
              json.dumps(emf["collide"], ensure_ascii=False)[:400])
        check("emblems: no line falls back to the ellipsis", not emf["ellipsis"],
              json.dumps(emf["ellipsis"], ensure_ascii=False)[:400])

        # ── Leica is a knock-out roundel, not a filled disc ───────────────
        # The mark is one path with the script cut out by the even-odd rule.
        # If that rule never reaches the canvas or the tile SVG, the roundel
        # renders solid and the brand name disappears — so both are measured.
        print("\n[browser] leica knock-out")
        cut = page.evaluate("""() => {
          const c = document.createElement('canvas');
          c.width = c.height = 200;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 200, 200);
          SPEmblems.draw(ctx, 'leica', 0, 0, 200, 200,
                         {ink: '#000000', accent: '#000000', base: '#ffffff'});
          const d = ctx.getImageData(0, 0, 200, 200).data;
          let paper = 0, ink = 0;
          for (let y = 0; y < 200; y++) {
            for (let x = 0; x < 200; x++) {
              const dx = x - 100, dy = y - 100;
              if (dx * dx + dy * dy > 70 * 70) continue;
              const i = (y * 200 + x) * 4;
              const v = d[i] + d[i + 1] + d[i + 2];
              if (v > 720) paper++; else if (v < 200) ink++;
            }
          }
          return {paper, ink};
        }""")
        check("leica: the script is cut out of the roundel on canvas",
              cut["paper"] > 250 and cut["ink"] > 2000, str(cut))
        svg_probe = page.evaluate("""() => {
          const s = SPEmblems.svg('leica', {ink: '#000', accent: '#000', base: '#fff'});
          const tile = document.querySelector('#emblemGrid [data-emblem="leica"] svg path');
          return {emblem: s, tile: tile ? tile.getAttribute('fill-rule') : null};
        }""")
        check("leica: the SVG tile carries fill-rule=evenodd",
              'fill-rule="evenodd"' in svg_probe["emblem"] and
              (svg_probe["tile"] or "") == "evenodd", str(svg_probe["tile"]))

        # the same matrix with every padding removed: the film sprocket loop
        # used to divide by a zero pitch and freeze the tab, so this runs on a
        # page of its own that can be thrown away if a regression hangs it.
        zero_matrix = []
        for cname, fields, emblem in FIT_CASES:
            for sname, w, h in FIT_SIZES:
                for fid, _label in FRAMES:
                    zero_matrix.append({"style": fid, "case": cname, "size": sname,
                                        "fields": fields, "emblem": emblem,
                                        "w": w, "h": h, "padPct": 0})
        zctx = browser.new_context(viewport={"width": 1280, "height": 800})
        zpage = zctx.new_page()
        zpage.set_default_timeout(20000)
        zpage.goto(base, wait_until="networkidle")
        zpage.wait_for_timeout(200)
        try:
            zero = zpage.evaluate(FIT_JS, zero_matrix)
        except Exception as e:  # a frozen renderer lands here
            zero = None
            check("padPct 0: Film Sprocket paints instead of hanging", False,
                  f"painter did not return ({str(e).splitlines()[0]})")
        if zero:
            check("padPct 0: Film Sprocket paints instead of hanging",
                  zero["plates"] == len(zero_matrix) and zero["holes"].get("film", 0) > 0,
                  f"plates={zero['plates']} holes={zero['holes']}")
            check("padPct 0: the sprocket row survives a padding-less plate",
                  zero["holes"].get("film", 0) >= 20, str(zero["holes"]))
            check("padPct 0: no ellipsis on any frame", not zero["ellipsis"],
                  json.dumps(zero["ellipsis"], ensure_ascii=False))
            check("padPct 0: no collision on any frame", not zero["collide"],
                  json.dumps(zero["collide"], ensure_ascii=False))
            check("padPct 0: nothing painted off the plate", not zero["overflow"],
                  json.dumps(zero["overflow"], ensure_ascii=False))
        zctx.close()

        # ── text fitting units: shrink floor and last-resort ellipsis ───────
        print("\n[browser] text fitting units")
        tu = page.evaluate(TEXT_JS)
        check("text: 50% squeeze keeps every character",
              tu["half"]["text"] == "1/1250s · ISO 1600" and "…" not in tu["half"]["text"],
              json.dumps(tu["half"], ensure_ascii=False))
        check("text: 50% squeeze actually shrinks the line",
              tu["half"]["w"] < tu["nominal"] * 0.75,
              f"{tu['half']['w']:.1f} vs {tu['nominal']:.1f}")
        check("text: a squeeze below the floor ellipsises", "…" in tu["tight"]["text"],
              json.dumps(tu["tight"], ensure_ascii=False))
        check("text: ellipsis still respects the limit",
              tu["tight"]["w"] <= tu["nominal"] * 0.4 + 1,
              f"{tu['tight']['w']:.1f} > {tu['nominal'] * 0.4:.1f}")
        check("compound: a 50% squeeze fits without cutting",
              tu["compound"]["text"] == "Hasselblad  X2D 100C",
              json.dumps(tu["compound"], ensure_ascii=False))
        check("compound: never shrinks past the same 45% floor",
              tu["compoundTight"]["w"] >= tu["compound"]["w"] * 0.82,
              f"tight={tu['compoundTight']['w']:.1f} half={tu['compound']['w']:.1f}")

        print("\n[browser] frame strip: wheel & keyboard")
        page.evaluate("() => document.querySelector('#frameStrip').scrollLeft = 0")
        page.hover("#frameStrip")
        page.mouse.wheel(0, 300)
        page.wait_for_timeout(250)
        wheel = page.evaluate("""() => { const s = document.querySelector('#frameStrip');
            return {left: s.scrollLeft, max: s.scrollWidth - s.clientWidth}; }""")
        check("wheel scrolls the strip horizontally",
              wheel["max"] > 0 and wheel["left"] >= wheel["max"] - 1, json.dumps(wheel))
        page.evaluate("() => document.querySelector('#frameStrip').scrollLeft = 0")
        page.evaluate("() => SPApp.setStyle('horizon')")
        page.wait_for_timeout(120)
        box = page.locator("#frameStrip").bounding_box()
        page.mouse.move(box["x"] + box["width"] * 0.72, box["y"] + box["height"] * 0.5)
        page.mouse.down()
        page.mouse.move(box["x"] + box["width"] * 0.22, box["y"] + box["height"] * 0.5, steps=10)
        page.mouse.up()
        page.wait_for_timeout(220)
        dragged = page.evaluate("""() => { const s = document.querySelector('#frameStrip');
            return {left: s.scrollLeft, max: s.scrollWidth - s.clientWidth}; }""")
        check("drag scrolls the strip horizontally",
              dragged["max"] > 0 and dragged["left"] >= dragged["max"] - 1, json.dumps(dragged))
        check("drag across cards does not change the frame",
              page.evaluate("() => SPApp.state.style") == "horizon",
              page.evaluate("() => SPApp.state.style"))

        page.evaluate("() => document.querySelector('#frameStrip').scrollLeft = 0")
        page.focus('.frame-card[data-style="horizon"]')
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(200)
        check("arrow key moves to the next frame",
              page.evaluate("() => SPApp.state.style") == "gallery",
              page.evaluate("() => SPApp.state.style"))
        page.evaluate("() => SPApp.setStyle('horizon')")
        page.wait_for_timeout(150)

        print("\n[browser] control sheets (hidden by default, toggle on demand)")
        check("sheet hidden by default", page.evaluate(
            "() => getComputedStyle(document.querySelector('#sheet')).visibility") == "hidden")
        check("all panes exist", page.locator(".pane").count() == 4)
        for name, kicker in (("exif", "EXIF 편집"), ("geometry", "프레임 · 여백"),
                             ("emblem", "메이커 엠블럼"), ("export", "내보내기")):
            page.click(f'[data-sheet="{name}"]')
            page.wait_for_timeout(280)
            check(f"sheet opens: {kicker}",
                  page.evaluate("() => getComputedStyle(document.querySelector('#sheet')).visibility") == "visible"
                  and page.inner_text("#sheetTitle") == kicker,
                  page.inner_text("#sheetTitle"))
            check(f"sheet shows only the {name} pane", page.evaluate(
                """(n) => { const active = [...document.querySelectorAll('.pane.is-active')];
                     return active.length === 1 && active[0].dataset.pane === n; }""", name))
            check(f"toolbar {name} button marked expanded", page.get_attribute(
                f'[data-sheet="{name}"]', "aria-expanded") == "true")
            page.keyboard.press("Escape")
            page.wait_for_timeout(460)
            check(f"Escape closes the {name} sheet", page.evaluate(
                "() => getComputedStyle(document.querySelector('#sheet')).visibility") == "hidden")
            check(f"toolbar {name} button reset", page.get_attribute(
                f'[data-sheet="{name}"]', "aria-expanded") == "false")

        # EXIF edit → live repaint
        page.click('[data-sheet="exif"]')
        page.wait_for_timeout(260)
        before = canvas_sig(page)["hash"]
        page.fill("#fCaption", "Jaehyuk Shim")
        page.wait_for_timeout(260)
        check("caption edit repaints the canvas", canvas_sig(page)["hash"] != before)
        check("caption input reflects the edit", page.input_value("#fCaption") == "Jaehyuk Shim")
        page.fill("#fIso", "ISO 3200")
        page.wait_for_timeout(240)
        check("ISO edit repaints the canvas", canvas_sig(page)["hash"] != before)
        page.click("#resetMetaBtn")
        page.wait_for_timeout(600)
        check("reset restores EXIF values",
              page.evaluate("() => SPApp.state.fields.iso") == "ISO 100")
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        # geometry sheet → sliders and ratio
        page.click('[data-sheet="geometry"]')
        page.wait_for_timeout(260)
        page.evaluate("() => { const r = document.querySelector('#padRange');"
                      " r.value = 12; r.dispatchEvent(new Event('input', {bubbles:true})); }")
        page.wait_for_timeout(260)
        check("padding slider reflows the plate",
              page.evaluate("() => Math.round(SPApp.currentLayout().padX)") > 100,
              str(page.evaluate("() => SPApp.currentLayout().padX")))
        page.evaluate("() => { const s = document.querySelector('#ratioSelect');"
                      " s.value = '1'; s.dispatchEvent(new Event('change', {bubbles:true})); }")
        page.wait_for_timeout(260)
        ratio = page.evaluate("() => { const L = SPApp.currentLayout(); return L.W / L.H; }")
        check("ratio control makes a square plate", abs(ratio - 1) < 0.02, f"W/H={ratio:.3f}")
        page.click("#resetGeoBtn")
        page.wait_for_timeout(300)
        check("reset returns to the frame defaults",
              page.evaluate("() => SPApp.state.ratio") == 0)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        # emblem sheet
        page.click('[data-sheet="emblem"]')
        page.wait_for_timeout(260)
        tiles = page.locator(".emblem-tile")
        check("emblem grid has auto + makers + none", tiles.count() >= 12, str(tiles.count()))
        page.click('.emblem-tile[data-emblem="hd2lab"]')
        page.wait_for_timeout(220)
        check("manual HD2Lab emblem selected",
              page.evaluate("() => SPApp.state.emblemChoice") == "hd2lab")
        page.click('.emblem-tile[data-emblem="auto"]')
        page.wait_for_timeout(200)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        print("\n[browser] export")
        page.evaluate("() => SPApp.setStyle('classic' in SPPlate.STYLES ? 'classic' : 'gallery')")
        page.evaluate("() => SPApp.setStyle('gallery')")
        page.wait_for_timeout(300)
        page.click('[data-sheet="export"]')
        page.wait_for_timeout(260)
        readout = page.text_content("#exportSize") or ""
        want_w, want_h = [int(x) for x in re.findall(r"\d+", readout)[:2]]
        with page.expect_download(timeout=25000) as dl:
            page.click("#downloadBtn")
        download = dl.value
        tmp = os.path.join(ROOT, "tests", "_export_check.jpg")
        download.save_as(tmp)
        check("export filename matches pattern",
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
        check("export readout names the frame",
              "Classic Gallery" in page.text_content("#exportStyle"))
        page.keyboard.press("Escape")
        check("no late console errors", not errors, str(errors[:3]))
        ctx.close()

        # ── share sheet: the path an iPhone takes ───────────────────────────
        # Chromium here has no real share sheet, so navigator.canShare/share are
        # stubbed before the page boots. That proves the wiring — a File of the
        # right name and type goes to the sheet, a dismissed sheet stays quiet,
        # a broken sheet falls back to the download — and leaves the one thing
        # only a real iPhone can answer (what iOS does with the File) unclaimed.
        print("\n[browser] share sheet branch")
        shctx = browser.new_context(viewport={"width": 390, "height": 844},
                                    accept_downloads=True)
        shpage = shctx.new_page()
        shpage.set_default_timeout(20000)
        shpage.add_init_script("""
          window.__shareLog = [];
          window.__shareMode = 'ok';
          Object.defineProperty(navigator, 'canShare', {
            configurable: true,
            value: (d) => !!(d && d.files && d.files.length && /^image\//.test(d.files[0].type))
          });
          Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: (d) => {
              const f = d && d.files && d.files[0];
              window.__shareLog.push({name: f ? f.name : null, type: f ? f.type : null,
                                      size: f ? f.size : 0, files: d && d.files ? d.files.length : 0});
              if (window.__shareMode === 'abort') {
                return Promise.reject(new DOMException('Share canceled', 'AbortError'));
              }
              if (window.__shareMode === 'fail') return Promise.reject(new Error('no sheet'));
              return Promise.resolve();
            }
          });
        """)
        share_errors = []
        shpage.on("pageerror", lambda e: share_errors.append(str(e)))
        shpage.goto(base, wait_until="networkidle")
        shpage.wait_for_timeout(300)
        check("share: canShare probe reads true when the platform has a sheet",
              shpage.evaluate("() => SPApp.canShareFiles()") is True)
        shpage.click("#headerSampleBtn")
        shpage.wait_for_timeout(900)
        shpage.click('[data-sheet="export"]')
        shpage.wait_for_timeout(400)
        check("share: photo-album door is offered", not shpage.is_hidden("#shareBtn"))
        shpage.evaluate("async () => { await SPApp.prepareExport(); }")
        last = shpage.evaluate("() => window.__lastExport")
        check("prepare: __lastExport keeps its contract",
              bool(last) and {"name", "bytes", "w", "h", "format", "style"} <= set(last),
              str(last))
        shpage.click("#shareBtn")
        shpage.wait_for_timeout(500)
        log = shpage.evaluate("() => window.__shareLog")
        check("share: the sheet receives exactly one file", len(log) == 1, str(log))
        check("share: file is the JPEG the card promised",
              bool(log) and re.fullmatch(r"Shutterplate_[^\\/]+_\d{12}\.jpg", log[0]["name"] or "")
              and log[0]["type"] == "image/jpeg" and log[0]["size"] > 30000,
              str(log[:1]))
        check("share: no download is triggered on a clean share",
              shpage.evaluate("() => document.querySelectorAll('.toast.is-error').length") == 0)

        shpage.evaluate("() => { window.__shareMode = 'abort'; }")
        before_toasts = shpage.evaluate("() => document.querySelectorAll('.toast').length")
        shpage.click("#shareBtn")
        shpage.wait_for_timeout(400)
        after_toasts = shpage.evaluate("() => document.querySelectorAll('.toast').length")
        check("share: a dismissed sheet says nothing and downloads nothing",
              shpage.evaluate("() => window.__shareLog.length") == 2 and
              after_toasts <= before_toasts, f"toasts {before_toasts}→{after_toasts}")

        shpage.evaluate("() => { window.__shareMode = 'fail'; }")
        with shpage.expect_download(timeout=25000) as dl2:
            shpage.click("#shareBtn")
        check("share: a broken sheet falls back to the file",
              dl2.value.suggested_filename.startswith("Shutterplate_"),
              dl2.value.suggested_filename)

        # the result card and the full-screen preview
        shpage.evaluate("() => { window.__shareMode = 'ok'; }")
        shpage.click("[data-sheet='export']") if False else None
        shpage.click("#previewBtn")
        shpage.wait_for_timeout(600)
        check("preview: result card opens with the rendered image",
              shpage.evaluate("() => document.querySelector('#exportModal').classList.contains('is-open')") and
              shpage.evaluate("() => (document.querySelector('#exportImg').src || '').startsWith('blob:')"))
        shpage.click("#exportShot")
        shpage.wait_for_timeout(300)
        check("preview: full screen view shows the same bitmap",
              shpage.evaluate("() => document.querySelector('#previewOverlay').classList.contains('is-open')") and
              shpage.evaluate("() => (document.querySelector('#previewImg').src || '').startsWith('blob:')"))
        check("preview: does not add a page scrollbar",
              shpage.evaluate("() => document.documentElement.scrollHeight <= window.innerHeight + 1"))
        shpage.keyboard.press("Escape")
        shpage.wait_for_timeout(250)
        check("preview: Escape returns to the card",
              shpage.evaluate("() => document.querySelector('#exportModal').classList.contains('is-open')"))
        shpage.keyboard.press("Escape")
        shpage.wait_for_timeout(200)
        check("share: no console errors on any branch", not share_errors, str(share_errors[:3]))
        shctx.close()

        # ── in-app browsers: KakaoTalk's WebView ────────────────────────────
        # The visitor's report: inside KakaoTalk the save step answered
        # "지원하지 않는 파일 형식". That WebView will not take a blob: download
        # and can refuse a blob: image, so the page has to name the host, hand
        # it inline bytes, and offer the escape hatch (copy the address).
        print("\n[browser] in-app browser (KakaoTalk WebView)")
        kctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3,
                                   is_mobile=True, has_touch=True,
                                   user_agent=KAKAO_UA, accept_downloads=True)
        kpage = kctx.new_page()
        kpage.set_default_timeout(25000)
        kerrors = []
        kpage.on("pageerror", lambda e: kerrors.append(str(e)))
        kpage.on("console", lambda m: kerrors.append(m.text) if m.type == "error" else None)
        kpage.goto(base, wait_until="networkidle")
        kpage.wait_for_timeout(400)

        # ① detection
        kakao = kpage.evaluate("() => SPApp.isInAppBrowser()")
        check("in-app: KakaoTalk UA is detected (truthy)", bool(kakao) is True, str(kakao))
        check("in-app: and names the host", kakao == "카카오톡", str(kakao))
        hosts = kpage.evaluate("""(uas) => ({
          instagram: SPApp.isInAppBrowser(uas.instagram),
          facebook: SPApp.isInAppBrowser(uas.facebook),
          naver: SPApp.isInAppBrowser(uas.naver),
          chrome: SPApp.isInAppBrowser(uas.chrome),
          safari: SPApp.isInAppBrowser(uas.safari)
        })""", {
            "instagram": ("Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 "
                          "Chrome/119.0 Mobile Safari/537.36 Instagram 312.0.0.0"),
            "facebook": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 [FBAN/FB4A;FBAV/430.0]",
            "naver": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 NAVER(inapp; search; 630)",
            "chrome": CHROME_UA,
            "safari": ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
                       "AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1"),
        })
        check("in-app: Instagram UA is named", hosts["instagram"] == "인스타그램", str(hosts))
        check("in-app: Facebook UA is named", hosts["facebook"] == "페이스북", str(hosts))
        check("in-app: Naver in-app UA is named", hosts["naver"] == "네이버", str(hosts))
        check("in-app: Chrome UA is not", hosts["chrome"] is False, str(hosts["chrome"]))
        check("in-app: iPhone Safari UA is not", hosts["safari"] is False, str(hosts["safari"]))

        # ② the notice: shown in-app, absent in a normal browser
        check("in-app: landing notice is visible", kpage.is_visible("#inappBanner"))
        check("in-app: landing notice names the host",
              "카카오톡" in kpage.inner_text("#inappBanner"), kpage.inner_text("#inappBanner"))
        check("in-app: landing notice offers the address copy",
              kpage.is_visible("#inappBanner [data-copy-url]"))
        check("in-app: notice keeps the page free of scroll",
              kpage.evaluate("() => document.documentElement.scrollHeight <= window.innerHeight + 1"))
        kpage.click("#inappBanner [data-copy-url]")
        kpage.wait_for_timeout(350)
        check("in-app: copying the address answers in the user's words",
              "주소를 복사했어요" in kpage.inner_text("#toasts"), kpage.inner_text("#toasts"))

        cctx = browser.new_context(viewport={"width": 390, "height": 844}, user_agent=CHROME_UA)
        cpage = cctx.new_page()
        cpage.goto(base, wait_until="networkidle")
        cpage.wait_for_timeout(300)
        check("normal: Chrome UA is not detected as in-app",
              cpage.evaluate("() => SPApp.isInAppBrowser()") is False)
        check("normal: the notice stays hidden", not cpage.is_visible("#inappBanner"))
        check("normal: the notice takes no room",
              cpage.evaluate("() => document.querySelector('#inappBanner').getBoundingClientRect().height") == 0)
        check("normal: SVG-arg detection matches the same UA table",
              cpage.evaluate("() => [SPApp.isInAppBrowser('KAKAOTALK 10.3.0'), "
                            "SPApp.isInAppBrowser('Chrome/124.0 Mobile Safari/537.36')]") == ["카카오톡", False],
              str(cpage.evaluate("() => [SPApp.isInAppBrowser('KAKAOTALK 10.3.0'), "
                                 "SPApp.isInAppBrowser('Chrome/124.0 Mobile Safari/537.36')]")))
        cctx.close()

        # ③ the export carries a data URL beside the blob
        kpage.tap("#emptySampleBtn")
        kpage.wait_for_function("() => window.SPApp.state.photo", timeout=20000)
        kpage.wait_for_timeout(700)
        prep = kpage.evaluate("""async () => {
          const p = await SPApp.prepareExport();
          return p ? {mime: (p.dataUrl || '').slice(0, 23), len: (p.dataUrl || '').length,
                      url: (p.url || '').slice(0, 5), name: p.name, bytes: p.bytes} : null;
        }""")
        check("in-app: prepareExport resolves a plate", bool(prep), str(prep))
        check("in-app: the export holds a JPEG data URL",
              bool(prep) and prep["mime"] == "data:image/jpeg;base64,", (prep or {}).get("mime"))
        check("in-app: that data URL carries the whole plate",
              bool(prep) and prep["len"] > 10000, str((prep or {}).get("len")))
        check("in-app: the blob URL is still prepared too",
              bool(prep) and prep["url"] == "blob:", str((prep or {}).get("url")))
        check("in-app: the file name contract is unchanged",
              bool(prep) and re.fullmatch(r"Shutterplate_[^\\/]+_\d{12}\.jpg", prep["name"]) is not None,
              str((prep or {}).get("name")))
        png = kpage.evaluate("""async () => {
          SPApp.state.format = 'png';
          const p = await SPApp.prepareExport();
          SPApp.state.format = 'jpeg';
          return p ? (p.dataUrl || '').slice(0, 22) : null;
        }""")
        check("in-app: a PNG export yields a PNG data URL", png == "data:image/png;base64,", str(png))

        # ④ saveFile hands the WebView the inline bytes, never the blob URL
        saved = kpage.evaluate("""async () => {
          const p = await SPApp.prepareExport();
          const log = [];
          const orig = document.createElement.bind(document);
          document.createElement = function (tag) {
            const n = orig(tag);
            if (String(tag).toLowerCase() === 'a') {
              n.click = function () {
                log.push({href: String(n.href || ''), download: n.download});
              };
            }
            return n;
          };
          try { SPApp.saveFile(p); } finally { document.createElement = orig; }
          return {log: log, name: p.name, dataLen: (p.dataUrl || '').length};
        }""")
        href = (saved["log"][0]["href"] if saved["log"] else "")
        check("in-app: saveFile clicks one anchor", len(saved["log"]) == 1, str(saved["log"][:1]))
        check("in-app: saveFile passes the data URL",
              href.startswith("data:image/jpeg;base64,") and len(href) == saved["dataLen"],
              href[:40])
        check("in-app: saveFile never passes a blob URL", "blob:" not in href, href[:40])
        check("in-app: saveFile keeps the agreed file name",
              bool(saved["log"]) and saved["log"][0]["download"] == saved["name"], str(saved["log"][:1]))

        # the same probe outside the chat app must stay on the blob path
        cctx = browser.new_context(viewport={"width": 1280, "height": 800}, user_agent=CHROME_UA)
        cpage = cctx.new_page()
        cpage.set_default_timeout(25000)
        cpage.goto(base, wait_until="networkidle")
        cpage.click("#emptySampleBtn")
        cpage.wait_for_function("() => window.SPApp.state.photo", timeout=20000)
        cpage.wait_for_timeout(500)
        normal = cpage.evaluate("""async () => {
          const p = await SPApp.prepareExport();
          const log = [];
          const orig = document.createElement.bind(document);
          document.createElement = function (tag) {
            const n = orig(tag);
            if (String(tag).toLowerCase() === 'a') n.click = function () { log.push(String(n.href || '')); };
            return n;
          };
          try { SPApp.saveFile(p); } finally { document.createElement = orig; }
          return {log: log, dataLen: (p.dataUrl || '').length};
        }""")
        check("normal: saveFile still clicks the blob URL",
              bool(normal["log"]) and normal["log"][0].startswith("blob:"), str(normal["log"])[:60])
        check("normal: the blob path still prepares a data URL for the card",
              normal["dataLen"] > 10000, str(normal["dataLen"]))
        cpage.evaluate("() => SPApp.openSheet('export')")
        cpage.wait_for_timeout(350)
        cpage.click("#previewBtn")
        cpage.wait_for_timeout(600)
        check("normal: the result card keeps its blob preview",
              cpage.evaluate("() => (document.querySelector('#exportImg').src || '').startsWith('blob:')"))
        cctx.close()

        # ⑤ the result card in-app: inline preview, long-press instructions
        kpage.evaluate("() => SPApp.openExportCard()")
        kpage.wait_for_timeout(400)
        card = kpage.evaluate("""() => ({
          open: document.querySelector('#exportModal').classList.contains('is-open'),
          src: (document.querySelector('#exportImg').src || '').slice(0, 23),
          hint: document.querySelector('#exportHintText').textContent,
          notice: !document.querySelector('#exportInappBanner').hidden,
          noticeVisible: document.querySelector('#exportInappBanner')
                         .getBoundingClientRect().height > 20,
          share: document.querySelector('#exportShare').hidden
        })""")
        check("in-app: the result card opens", card["open"])
        check("in-app: the card previews the data URL (long-press can save it)",
              card["src"] == "data:image/jpeg;base64,", card["src"])
        check("in-app: the card carries the notice", card["notice"] and card["noticeVisible"], json.dumps(card))
        check("in-app: the card tells the user to long-press", "길게" in card["hint"], card["hint"])
        check("in-app: the share-sheet door is hidden", card["share"] is True)
        check("in-app: the card fits the viewport without page scroll",
              kpage.evaluate("() => document.documentElement.scrollHeight <= window.innerHeight + 1"))
        kpage.evaluate("() => document.querySelector('#exportClose').click()")
        kpage.wait_for_timeout(300)
        check("in-app: no console errors along the way", not kerrors, str(kerrors[:3]))

        # ⑥ a WebView that refuses blob: images gets the FileReader retry
        rctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True,
                                   has_touch=True, user_agent=KAKAO_UA)
        rctx.add_init_script("""
          const make = URL.createObjectURL.bind(URL);
          URL.createObjectURL = function (b) {
            if (b && /^image\//.test(b.type || '')) return 'blob:http://127.0.0.1:1/blocked';
            return make(b);
          };
        """)
        rpage = rctx.new_page()
        rpage.set_default_timeout(25000)
        rerr = []
        rpage.on("pageerror", lambda e: rerr.append(str(e)))
        rpage.goto(base, wait_until="networkidle")
        rpage.wait_for_timeout(300)
        rpage.tap("#emptySampleBtn")
        rpage.wait_for_function("() => window.SPApp.state.photo", timeout=20000)
        rpage.wait_for_timeout(500)
        retry = rpage.evaluate("""() => ({
          loaded: !!SPApp.state.photo,
          inline: !!(SPApp.state.photo && SPApp.state.photo.inline),
          src: (SPApp.state.photo && SPApp.state.photo.objectUrl || '').slice(0, 16),
          errors: document.querySelectorAll('.toast.is-error').length,
          name: document.querySelector('#metaName').textContent,
          thumb: (() => { const c = document.querySelector('#sessionThumb');
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let s = 0; for (let i = 0; i < d.length; i += 4 * 53) s += d[i] + d[i+1] + d[i+2];
            return s; })()
        })""")
        check("blocked blob: the photo still loads through the data URL",
              retry["loaded"] and retry["inline"] is True and retry["name"].endswith(".jpg"),
              json.dumps(retry))
        check("blocked blob: no error toast is raised", retry["errors"] == 0, str(retry["errors"]))
        check("blocked blob: the session card paints the photo", retry["thumb"] > 0, str(retry["thumb"]))
        check("blocked blob: no page errors", not rerr, str(rerr[:3]))
        rctx.close()
        kctx.close()

        # ── mobile 390 ──────────────────────────────────────────────────────
        print("\n[browser] mobile 390 ergonomics")
        dev = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 3,
               "is_mobile": True, "has_touch": True}
        mctx = browser.new_context(**dev)
        mpage = mctx.new_page()
        merr = []
        mpage.on("pageerror", lambda e: merr.append(str(e)))
        mpage.goto(base, wait_until="networkidle")
        mpage.tap("#emptySampleBtn")
        mpage.wait_for_function("() => window.SPApp.state.photo", timeout=15000)
        mpage.wait_for_timeout(700)

        overflow = mpage.evaluate(
            "() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth,"
            " sh: document.documentElement.scrollHeight, ih: window.innerHeight})")
        check("mobile: no horizontal overflow", overflow["sw"] <= overflow["iw"] + 1, json.dumps(overflow))
        check("mobile: no vertical page scroll", overflow["sh"] <= overflow["ih"] + 1, json.dumps(overflow))
        check("mobile: no page errors", not merr, str(merr[:3]))

        small = mpage.evaluate("""() => {
          const bad = [];
          for (const i of document.querySelectorAll('input:not([type=range]):not([type=file]), select')) {
            if (!i.offsetParent) continue;
            const fs = parseFloat(getComputedStyle(i).fontSize);
            if (fs < 16) bad.push(i.id || i.className);
          }
          return bad;
        }""")
        check("mobile: every input/select ≥16px", not small, str(small))

        tiny = mpage.evaluate("""() => {
          const bad = [];
          for (const b of document.querySelectorAll('button, a.portal-item, .dropzone, .frame-card')) {
            const r = b.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.height < 44 || r.width < 44) bad.push((b.id || b.className || b.textContent.trim().slice(0,12)));
          }
          return bad;
        }""")
        check("mobile: touch targets ≥44px", not tiny, str(tiny[:6]))

        layout = mpage.evaluate("""() => {
          const r = s => document.querySelector(s).getBoundingClientRect();
          return {header: r('.app-header').height, stage: r('.stage').height,
                  session: r('#sessionCard').height, strip: r('.strip').height,
                  bar: r('.toolbar').height, vh: window.innerHeight,
                  canvas: r('#stageCanvas').height,
                  headerWrap: r('.app-header').height > 70};
        }""")
        check("mobile: header stays one row", not layout["headerWrap"], json.dumps(layout))
        check("mobile: canvas keeps the largest share of the viewport",
              layout["canvas"] > layout["strip"], json.dumps(layout))
        total = layout["header"] + layout["stage"] + layout["session"] + layout["strip"] + layout["bar"]
        check("mobile: whole studio fits in one viewport", total <= layout["vh"] + 2,
              f"{total} vs {layout['vh']}")

        mpage.evaluate("() => SPApp.openSheet('exif')")
        mpage.wait_for_timeout(320)
        sheet_box = mpage.evaluate("""() => {
          const b = document.querySelector('#sheet').getBoundingClientRect();
          return {top: b.top, bottom: b.bottom, left: b.left, w: b.width, vh: window.innerHeight};
        }""")
        check("mobile: control panel rises as a bottom sheet",
              sheet_box["left"] == 0 and sheet_box["bottom"] <= sheet_box["vh"] + 1
              and sheet_box["top"] > sheet_box["vh"] * 0.15, json.dumps(sheet_box))
        mpage.evaluate("() => SPApp.closeSheet()")
        mpage.wait_for_timeout(260)

        strip_scroll = mpage.evaluate("""() => {
          const s = document.querySelector('#frameStrip');
          return {sw: s.scrollWidth, cw: s.clientWidth};
        }""")
        check("mobile: frame strip is horizontally scrollable",
              strip_scroll["sw"] > strip_scroll["cw"] + 20, json.dumps(strip_scroll))

        # the sheet must not be able to push the page taller than the viewport
        mpage.evaluate("() => SPApp.openSheet('geometry')")
        mpage.wait_for_timeout(300)
        check("mobile: open sheet keeps the page unlocked from scrolling",
              mpage.evaluate("() => document.documentElement.scrollHeight <= window.innerHeight + 1"))
        mpage.evaluate("() => SPApp.closeSheet()")
        mctx.close()

        # ── narrow 320 ──────────────────────────────────────────────────────
        print("\n[browser] narrow 320 floor")
        sctx = browser.new_context(viewport={"width": 320, "height": 568}, device_scale_factor=2,
                                   is_mobile=True, has_touch=True)
        spage = sctx.new_page()
        serr = []
        spage.on("pageerror", lambda e: serr.append(str(e)))
        spage.goto(base, wait_until="networkidle")
        spage.wait_for_timeout(300)

        narrow = spage.evaluate("""() => {
          const name = document.querySelector('.brand-name');
          const dots = document.querySelector('.portal-menu-btn').getBoundingClientRect();
          const bar = document.querySelector('.stage-bar');
          const barKids = [...bar.children].map(c => c.getBoundingClientRect().right);
          return {
            sw: document.documentElement.scrollWidth, iw: window.innerWidth,
            nameClipped: name.scrollWidth > name.clientWidth + 1,
            nameText: name.textContent,
            dotsRight: dots.right,
            barRight: Math.max(...barKids),
            barWidth: bar.getBoundingClientRect().width,
            headerH: document.querySelector('.app-header').getBoundingClientRect().height,
          };
        }""")
        check("320: no horizontal overflow", narrow["sw"] <= narrow["iw"] + 1, json.dumps(narrow))
        check("320: brand name not ellipsised", not narrow["nameClipped"],
              f"{narrow['nameText']} clipped={narrow['nameClipped']}")
        check("320: portal menu button fully inside", narrow["dotsRight"] <= narrow["iw"],
              json.dumps(narrow))
        check("320: stage bar content inside", narrow["barRight"] <= narrow["barWidth"] + 0.5,
              json.dumps(narrow))
        check("320: header one row", narrow["headerH"] <= 64, json.dumps(narrow))

        spage.tap("#emptySampleBtn")
        spage.wait_for_function("() => window.SPApp.state.photo", timeout=15000)
        spage.wait_for_timeout(600)
        n2 = spage.evaluate("""() => {
          const r = s => document.querySelector(s).getBoundingClientRect();
          return {sw: document.documentElement.scrollWidth, iw: window.innerWidth,
                  session: r('#sessionCard').height,
                  total: r('.app-header').height + r('.stage').height + r('#sessionCard').height
                         + r('.strip').height + r('.toolbar').height,
                  vh: window.innerHeight,
                  stripSw: document.querySelector('#frameStrip').scrollWidth,
                  stripCw: document.querySelector('#frameStrip').clientWidth};
        }""")
        check("320: still no horizontal overflow after upload",
              n2["sw"] <= n2["iw"] + 1, json.dumps(n2))
        check("320: session card stays one row", n2["session"] <= 62, json.dumps(n2))
        check("320: studio fits the viewport", n2["total"] <= n2["vh"] + 2, json.dumps(n2))
        check("320: frame strip scrolls", n2["stripSw"] > n2["stripCw"] + 20, json.dumps(n2))
        check("320: no page errors", not serr, str(serr[:3]))
        sctx.close()
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
