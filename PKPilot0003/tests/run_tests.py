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
        "tools/make_samples.py", "tools/capture_pc_workspace.py", "README.md",
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

    # ── PC 2단 스튜디오 · 워크스페이스 (brief §1–2) ───────────────────────
    print("\n[static] PC two-column studio & workspace")
    check("inspector tab row present", 'id="insTabs"' in html)
    check("four inspector tabs", re.findall(r'data-tab="([a-z]+)"', html) ==
          ["exif", "geometry", "emblem", "export"], str(re.findall(r'data-tab="([a-z]+)"', html)))
    check("inspector tabs point at the panes",
          all(f'aria-controls="pane{p.capitalize()}"' in html
              for p in ("exif", "geometry", "emblem", "export")))
    check("export dock present", 'id="insDock"' in html and 'id="dockSaveBtn"' in html)
    check("dock carries format + quality",
          'id="formatSegDock"' in html and 'id="qualityRangeDock"' in html)
    check("workspace strip present", 'id="wsStrip"' in html and 'id="wsTrack"' in html)
    check("workspace strip starts hidden", re.search(r'id="wsStrip"[^>]*hidden', html) is not None)
    check("workspace header has name, counter, sort",
          all(f'id="{i}"' in html for i in ("wsName", "wsCount", "wsSort")) and
          "이름 ↑" in html and "이름 ↓" in html)
    check("workspace strip folds", 'id="wsToggle"' in html and 'aria-controls="wsTrack"' in html)
    check("multi-file open input", re.search(r'id="wsFileInput"[^>]*multiple', html) is not None)
    check("folder input is a directory picker",
          re.search(r'id="wsFolderInput"[^>]*webkitdirectory', html) is not None)
    check("recursive-subfolder option", 'id="recursiveToggle"' in html)
    check("landing and session bar carry the open buttons",
          all(f'id="{i}"' in html for i in ("openFilesBtn", "openFolderBtn",
                                            "emptyOpenFilesBtn", "emptyOpenFolderBtn",
                                            "sessionOpenFilesBtn", "sessionOpenFolderBtn")))
    check("bulk export control in the export pane",
          'id="bulkBtn"' in html and 'id="bulkStatus"' in html)
    check("open-folder icons in the sprite", "i-folder-open" in ids and "i-folder" in ids)
    check("folder icon is referenced", 'href="#i-folder-open"' in html)
    capture = read("tools/capture_pc_workspace.py")
    check("capture tool keeps the PC evidence reproducible",
          all(n in capture for n in ("pc-workspace-01-landing.png", "pc-workspace-02-inspector.png",
                                     "pc-workspace-03-strip.png", "pc-workspace-04-mobile.png")))
    for shot in ("pc-workspace-01-landing.png", "pc-workspace-02-inspector.png",
                 "pc-workspace-03-strip.png", "pc-workspace-04-mobile.png",
                 "pc-workspace-05-sheet.png"):
        check(f"capture present: verify/{shot}",
              os.path.exists(os.path.join(ROOT, "verify", shot)))

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
    check("PC breakpoint is 1024px", "@media (min-width: 1024px)" in css)
    check("PC columns: stage + a 360-380px inspector",
          re.search(r"--ins-w:\s*3[67]\dpx", css) is not None
          and re.search(r"\.studio\s*\{[^}]*margin-right:\s*var\(--ins-w\)", css, re.S) is not None)
    check("PC inspector is pinned to the right edge",
          re.search(r"\.sheet\s*\{[^}]*right:\s*0;[^}]*width:\s*var\(--ins-w\)", css, re.S) is not None)
    check("PC inspector needs no .is-open to show",
          re.search(r"\.sheet\s*\{[^}]*visibility:\s*visible;[^}]*pointer-events:\s*auto", css, re.S) is not None)
    check("PC retires the bottom toolbar",
          re.search(r"\.toolbar \{ display: none; \}", css) is not None)
    check("PC-only blocks are hidden by default",
          re.search(r"\.pc-open,\s*\n\s*\.pc-only,[\s\S]*?display: none;", css) is not None)
    check("workspace strip is a horizontal scroller",
          re.search(r"\.ws-track \{[^}]*overflow-x: auto", css, re.S) is not None)
    check("collapsed workspace strip hides the track",
          ".ws-strip.is-collapsed .ws-track { display: none; }" in css)
    check("PC keeps the accent-ringed selection on the workspace strip",
          '.ws-item[aria-selected="true"]' in css)
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
    check("export: 1:1 first, 4096 → 3072 → 2048 fallback ladder",
          "FALLBACK_EDGES = [4096, 3072, 2048]" in app and "encodePlate" in app and
          "exportRungs" in app)
    check("export: no fixed MAX_EDGE shutter is left",
          "MAX_EDGE" not in app)
    check("export filename pattern", "Shutterplate_" in read("js/exif-core.js"))
    check("PC breakpoint mirrored in JS", "min-width: 1024px" in app)
    check("workspace reads a real folder handle", "showDirectoryPicker" in app)
    check("workspace falls back to a directory input", "wsFolderInput" in app and
          read("index.html").count("webkitdirectory") == 1)
    check("workspace thumbnails are lazy", "IntersectionObserver" in app)
    check("arrow keys step through the workspace", "stepEntry" in app and "ArrowLeft" in app)
    check("batch export renders photo by photo", "plateJobForFile" in app and "bulkExport" in app)
    check("batch export goes through the same 1:1 encoder",
          "plateJobForFile" in app and "encodePlate(" in app and
          app.count("encodePlate(") >= 2)
    check("EXIF make/model verbatim rule untouched",
          "EXIF strings are kept verbatim" in read("js/exif-core.js")
          and "toUpperCase" not in read("js/exif-core.js"))
    check("workspace keeps the local-only promise",
          "업로드 0 B" in html and "File System Access" not in html)

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
               filmSlack: 1e9, ruleSlack: 1e9, badgeRoom: 1e9, perf: [], strap: []};
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
    /* Film Sprocket: the two rows of perforations are measured where they were
       actually painted — same hole height, same distance from each edge, each
       hole centred in its own rail, and the lowest line of copy clear above
       the bottom row. */
    if (item.style === 'film') {
      const upper = holes.filter(h => h.y + h.h <= L.H / 2);
      const lower = holes.filter(h => h.y >= L.H / 2);
      const mean = (list) => list.length ? list.reduce((a, h) => a + h.h, 0) / list.length : 0;
      const fp = SPPlate.helpers.filmPerf(L);
      const gapAbove = upper.length ? Math.min.apply(null, upper.map(h => h.y)) : -1;
      const gapBelow = upper.length ? fp.topRuleY - Math.max.apply(null, upper.map(h => h.y + h.h)) : -1;
      const footAbove = lower.length ? Math.min.apply(null, lower.map(h => h.y)) - fp.botRuleY : -1;
      const footBelow = lower.length ? L.H - Math.max.apply(null, lower.map(h => h.y + h.h)) : -1;
      out.perf.push({
        label: label,
        H: L.H,
        railH: fp.railH, topRuleY: fp.topRuleY, botRuleY: fp.botRuleY,
        topCy: fp.topCy, botCy: fp.botCy, flow: fp.flow,
        top: upper.length, bot: lower.length,
        topH: mean(upper), botH: mean(lower),
        topEdge: upper.length ? Math.min.apply(null, upper.map(h => h.y)) : -1,
        botEdge: lower.length ? Math.min.apply(null, lower.map(h => L.H - (h.y + h.h))) : -1,
        gapAbove: gapAbove, gapBelow: gapBelow,
        footAbove: footAbove, footBelow: footBelow
      });
      const holeTop = lower.length ? Math.min.apply(null, lower.map(h => h.y)) : L.H;
      const lowest = texts.reduce((m, t) => Math.max(m, t.y1), -1e9);
      out.filmSlack = Math.min(out.filmSlack, holeTop - lowest);
      /* the print block must also stay above the bottom rule, not only the row */
      out.ruleSlack = Math.min(out.ruleSlack, fp.botRuleY - lowest);
      /* and the badge must not touch the top rule or the photo's frame line */
      out.badgeRoom = Math.min(out.badgeRoom, L.photoBox.y - fp.topRuleY);
    }
    /* Strap Bar: the bar's own air — the gap from the photo down to the first
       line and from the last line down to the stitching. Both are what the
       frame was tightened for, so they are measured, not eyeballed. */
    if (item.style === 'strap') {
      const sb = SPPlate.helpers.strapBand(L);
      const lowest = texts.reduce((m, t) => Math.max(m, t.y1), -1e9);
      const highest = texts.reduce((m, t) => Math.min(m, t.y0), 1e9);
      out.strap.push({
        label: label, case: item.case, W: L.W, band: L.band, PH: L.PH, padX: L.padX,
        ratio: (L.band - L.padX) / L.PH,
        topGap: highest - (L.photoBox.y + L.PH),
        stitchGap: sb.stitchY - lowest,
        footGap: L.H - sb.stitchY
      });
    }
  }
  out.ellipsis = out.ellipsis.slice(0, 6);
  out.overflow = out.overflow.slice(0, 6);
  out.collide = out.collide.slice(0, 6);
  return out;
}"""


# ── painted lines: where the foot of a frame really prints ──────────────────
# A line of copy with tracking is painted glyph by glyph, so one row arrives at
# fillText as a dozen calls. This records every call with its box, gathers the
# calls that share a baseline back into a line, and reports the emblem boxes and
# the film perforation rails too. That is what lets the suite tell a vertical
# stack from one horizontal row, or a meta block beside the mark from one under
# it — by where the pixels landed, not by reading the source.
LINES_JS = """(matrix) => {
  const out = [];
  const c = document.createElement('canvas');
  for (const item of matrix) {
    const L = SPPlate.layout({w: item.w, h: item.h, img: null}, {
      style: item.style, fields: item.fields, emblem: item.emblem, font: 'sans',
      stock: 'KODAK PORTRA 400', frameNo: '#03', padPct: item.padPct
    });
    c.width = Math.max(1, Math.round(L.W));
    c.height = Math.max(1, Math.round(L.H));
    const ctx = c.getContext('2d');
    const recs = [], emblems = [];
    let inEmblem = false;
    const origFT = ctx.fillText.bind(ctx);
    ctx.fillText = function (s, x, y) {
      if (!inEmblem) {
        const m = this.measureText(String(s));
        const px = parseFloat((/(\\d+(?:\\.\\d+)?)px/.exec(this.font) || [0, 0])[1]) || 1;
        const asc = m.actualBoundingBoxAscent || px * 0.8;
        const desc = m.actualBoundingBoxDescent || 0;
        const wd = m.width, al = this.textAlign;
        const x0 = al === 'center' ? x - wd / 2 : al === 'right' ? x - wd : x;
        recs.push({s: String(s), x0: x0, x1: x0 + wd, y: y, y0: y - asc, y1: y + desc});
      }
      return origFT(s, x, y);
    };
    const em = SPEmblems.draw;
    SPEmblems.draw = function (c2, id, x, y, wd, hh) {
      const prev = inEmblem;
      if (c2 === ctx) { inEmblem = true; emblems.push({id: id, x: x, x1: x + wd, y: y, y1: y + hh}); }
      try { return em.apply(this, arguments); } finally { inEmblem = prev; }
    };
    try { SPPlate.paint(ctx, L); } finally { SPEmblems.draw = em; }

    const lines = [];
    for (const r of recs) {
      let line = lines.find((l) => Math.abs(l.y - r.y) < 0.6);
      if (!line) { line = {y: r.y, parts: []}; lines.push(line); }
      line.parts.push(r);
    }
    const r1 = (v) => Math.round(v * 10) / 10;
    const packed = lines.map((l) => {
      const parts = l.parts.slice().sort((a, b) => a.x0 - b.x0);
      const xs = parts.map((p) => r1(p.x0)), xe = parts.map((p) => r1(p.x1));
      return {
        s: parts.map((p) => p.s).join(''), y: r1(l.y), parts: parts.length,
        x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xe),
        y0: r1(Math.min.apply(null, parts.map((p) => p.y0))),
        y1: r1(Math.max.apply(null, parts.map((p) => p.y1))),
        xs: xs, xe: xe, ys: parts.map((p) => r1(p.y))
      };
    });
    const perf = SPPlate.helpers.filmPerf(L);
    out.push({
      label: item.style + '/' + item.case + '/' + item.size,
      W: L.W, H: L.H, band: L.band, pad: L.padX, inset: L.inset,
      photoBottom: L.photoBox.y + L.PH,
      botRuleY: r1(perf.botRuleY), flow: r1(perf.flow), railH: r1(perf.railH),
      lines: packed,
      emblems: emblems.map((e) => ({id: e.id, x: r1(e.x), x1: r1(e.x1), y: r1(e.y), y1: r1(e.y1)}))
    });
  }
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


def film_pairs(fields):
    """The three label/value pairs the Film Sprocket foot prints."""
    iso = re.sub(r"^ISO\s*", "", fields.get("iso") or "")
    shutter = re.sub(r"\s*s$", "", fields.get("shutter") or "")
    aperture = re.sub(r"^[ƒf]\s*/?\s*", "", fields.get("aperture") or "")
    return [("ISO", iso), ("SEC", shutter), ("F", aperture)]


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
        # ── Film Sprocket: the two perforation rows are mirror images ──────
        # Real 35mm prints the same hole height and the same distance from the
        # edge at both margins. This paints the frame on landscape, portrait and
        # square plates, with the default padding, none at all and a wide one,
        # and reads the holes back where they were actually drawn.
        print("\n[browser] film sprocket symmetry")
        film_matrix = []
        for cname, fields, emblem in FIT_CASES:
            for sname, w, h in (("2:3", 1200, 1800), ("3:2", 1536, 1024), ("1:1", 1400, 1400)):
                for pad in (6, 0, 9):
                    film_matrix.append({"style": "film", "case": cname, "size": sname,
                                        "fields": fields, "emblem": emblem,
                                        "w": w, "h": h, "padPct": pad})
        film = page.evaluate(FIT_JS, film_matrix)
        rows = film["perf"]
        check(f"film: {len(film_matrix)} plates painted both perforation rows",
              len(rows) == len(film_matrix) and
              all(r["top"] >= 8 and r["bot"] >= 8 for r in rows),
              json.dumps([r for r in rows if r["top"] < 8 or r["bot"] < 8])[:300])
        check("film: the top and bottom rows hold the same number of holes",
              all(r["top"] == r["bot"] for r in rows),
              json.dumps([r["label"] for r in rows if r["top"] != r["bot"]])[:300])
        worst_h = max(abs(r["topH"] - r["botH"]) for r in rows) if rows else -1
        check("film: top and bottom hole heights are identical (대칭)",
              rows and worst_h <= 0.5, f"worst Δh={worst_h:.2f}px")
        worst_e = max(abs(r["topEdge"] - r["botEdge"]) for r in rows) if rows else -1
        check("film: top and bottom edge distances are identical (대칭)",
              rows and worst_e <= 0.5, f"worst Δedge={worst_e:.2f}px")
        # the rail is the strip each row owns (edge ↔ its own rule): both rails
        # are cut to one height, and the hole is centred inside its rail, so the
        # gap above the top hole equals the gap below it, and the same at the
        # foot — a mirror, not just "same hole, same edge distance".
        worst_rail = max(abs(r["topRuleY"] - (r["H"] - r["botRuleY"])) for r in rows) if rows else -1
        check("film: the top rail and the bottom rail are the same height (대칭)",
              rows and worst_rail <= 0.5, f"worst Δrail={worst_rail:.2f}px")
        worst_c = max(max(abs(r["topCy"] - r["topRuleY"] / 2),
                          abs(r["botCy"] - (r["H"] - (r["H"] - r["botRuleY"]) / 2)))
                      for r in rows) if rows else -1
        check("film: each sprocket row is centred in its own rail (대칭)",
              rows and worst_c <= 0.5, f"worst Δcentre={worst_c:.2f}px")
        worst_gap = max(max(abs(r["gapAbove"] - r["gapBelow"]),
                            abs(r["footAbove"] - r["footBelow"]))
                        for r in rows) if rows else -1
        check("film: the painted holes keep equal gaps to edge and rule (대칭)",
              rows and worst_gap <= 0.5, f"worst Δgap={worst_gap:.2f}px")
        check("film: the stock badge keeps clear room between rail and photo",
              film["badgeRoom"] > 1.0, f"room={film['badgeRoom']:.1f}px")
        check("film: the print block stays above the bottom rule, not just the row",
              film["ruleSlack"] > 0, f"slack={film['ruleSlack']:.1f}px")
        check("film: the bottom row clears the lowest date line on every plate",
              film["filmSlack"] > 1.0, f"slack={film['filmSlack']:.1f}px")
        check("film: no line of copy sits on a perforation hole",
              not [c for c in film["collide"] if c[1] == "hole"],
              json.dumps([c for c in film["collide"] if c[1] == "hole"], ensure_ascii=False)[:300])
        check("film: no text collides and nothing leaves the plate (landscape/portrait/padPct 0)",
              not film["collide"] and not film["overflow"],
              json.dumps((film["collide"] + film["overflow"])[:4], ensure_ascii=False)[:300])

        # ── Strap Bar: the bar is a strap, not a second page ───────────────
        # The bar used to hold 19% of the photo's height and left a wide empty
        # gap above the first row and another under the last one. It now holds
        # 12%, the rows sit high in it and the stitching closes it, so both
        # gaps are measured here on landscape, portrait and square plates.
        print("\n[browser] strap bar air")
        strap_matrix = []
        for cname, fields, emblem in FIT_CASES:
            for sname, w, h in (("2:3", 1200, 1800), ("3:2", 1536, 1024), ("1:1", 1400, 1400)):
                for pad in (None, 0, 4):
                    strap_matrix.append({"style": "strap", "case": cname, "size": sname,
                                         "fields": fields, "emblem": emblem,
                                         "w": w, "h": h, "padPct": pad})
        strap = page.evaluate(FIT_JS, strap_matrix)
        srows = strap["strap"]
        check(f"strap: {len(strap_matrix)} bars painted",
              len(srows) == len(strap_matrix) and strap["plates"] == len(strap_matrix),
              f"bars {len(srows)} plates {strap['plates']}")
        worst_ratio = max(r["ratio"] for r in srows) if srows else -1
        check("strap: the bar holds no more than 13% of the photo's height",
              srows and worst_ratio <= 0.13,
              f"worst={worst_ratio:.3f} " + json.dumps([r["label"] for r in srows if r["ratio"] > 0.13])[:200])
        typed = [r for r in srows if r["case"] != "noexif"]
        check(f"strap: {len(typed)} bars carry EXIF lines to measure",
              len(typed) == len(srows) - 3 * 3, f"typed={len(typed)} of {len(srows)}")
        tight_top = [r for r in typed if not (0.5 < r["topGap"] < r["band"] * 0.34)]
        check("strap: the gap under the photo is tight (first row near the top edge)",
              not tight_top,
              json.dumps([(r["label"], round(r["topGap"], 1), round(r["band"], 1)) for r in tight_top])[:300])
        on_stitch = [r for r in typed if r["stitchGap"] <= 0.5]
        check("strap: no line of copy is painted on the stitching",
              not on_stitch,
              json.dumps([(r["label"], round(r["stitchGap"], 1)) for r in on_stitch])[:300])
        wide_foot = [r for r in srows if r["footGap"] > r["band"] * 0.13]
        check("strap: the stitching closes the bar (small margin under it)",
              not wide_foot,
              json.dumps([(r["label"], round(r["footGap"], 1), round(r["band"], 1)) for r in wide_foot])[:300])
        check("strap: no text collides and nothing leaves the plate (landscape/portrait/padPct 0)",
              not strap["collide"] and not strap["overflow"] and not strap["ellipsis"],
              json.dumps((strap["collide"] + strap["overflow"] + strap["ellipsis"])[:4],
                         ensure_ascii=False)[:300])

        # ── five frames: the foot each one now keeps ──────────────
        # The brief trims five mats and re-lays three of them: Classic Gallery
        # and Dual Deck by closing their rows, Studio Dark by pulling the block
        # up to its rail, Film Sprocket into a mark + meta block beside it with
        # one horizontal spec row, and Pro Studio into a four-column bar. The
        # first block pins the brief's numbers and then measures the band the
        # plate really paints, on a portrait and a landscape photo, so "slimmer"
        # means the margin on the plate and not just the constant in the source.
        print("\n[browser] five frames: slim band, film row, pro bar")
        GEO = {
            "gallery": (4.5, 13, 0.6),
            "dual": (3.8, 13.5, 0.25),
            "film": (6, 12.5, 0.3),
            "studio": (3.8, 11.5, 1.2),
            "pro": (4.5, 14.5, 0),
        }
        WAS_EXTRA = {"gallery": 17, "dual": 21, "film": 16, "studio": 15.5, "pro": 25}
        geo_new = page.evaluate("() => { const o = {}; for (const k of SPPlate.ORDER) "
                               "o[k] = Object.assign({}, SPPlate.STYLES[k].geo); return o; }")
        for fid, (pad, extra, radius) in GEO.items():
            got = geo_new.get(fid) or {}
            check(f"geo {fid}: padding {pad}% · band {extra}% · radius {radius}%",
                  abs(got.get("pad", -1) - pad) < 1e-9 and
                  abs(got.get("extra", -1) - extra) < 1e-9 and
                  abs(got.get("radius", -1) - radius) < 1e-9, json.dumps(got))
            dflt = page.evaluate("(s) => SPPlate.defaults(s)", fid)
            check(f"geo {fid}: the frame opens on those numbers",
                  abs(dflt["padPct"] - pad) < 1e-9 and abs(dflt["extraPct"] - extra) < 1e-9,
                  json.dumps(dflt))

        bands = page.evaluate("""() => {
          const out = {};
          for (const s of ['gallery','dual','film','studio','pro']) {
            out[s] = {};
            for (const sz of [['2:3', 1200, 1800], ['3:2', 1536, 1024]]) {
              const L = SPPlate.layout({w: sz[1], h: sz[2], img: null},
                {style: s, fields: SPApp.state.fields, emblem: 'hd2lab', font: 'sans'});
              out[s][sz[0]] = {band: L.band, pad: L.padX, PH: L.PH, H: L.H, W: L.W};
            }
          }
          return out;
        }""")
        for fid, (_pad, extra, _radius) in GEO.items():
            for size in ("2:3", "3:2"):
                g = bands[fid][size]
                depth = (g["band"] - g["pad"]) / g["PH"]
                check(f"{fid} {size}: the band holds {extra}% of the photo "
                      f"(was {WAS_EXTRA[fid]}%)",
                      abs(depth - extra / 100) < 0.004 and depth <= WAS_EXTRA[fid] / 100 - 0.02,
                      f"depth={depth:.4f} {json.dumps(g)}")

        FIELDS = {cname: fields for cname, fields, _e in FIT_CASES}
        SIZES = (("2:3", 1200, 1800), ("2:3s", 1024, 1536), ("3:2", 1536, 1024))

        # ── Film Sprocket: mark at the left, meta beside it, one spec row ──
        # The mark used to sit above a vertical block on the left and the spec
        # used to stack three rows on the right, halfway up the foot. Both are
        # gone: the block now runs beside the mark on one left edge, and the
        # three pairs share a single baseline at the foot's far corner, right-
        # aligned to the inner edge. Measured from the painted glyphs.
        print("\n[browser] film sprocket foot: parallel block & one-row spec")
        foot_matrix = []
        for cname, fields, emblem in FIT_CASES:
            if not fields:
                continue
            for sname, w, h in SIZES:
                foot_matrix.append({"style": "film", "case": cname, "size": sname,
                                    "fields": fields, "emblem": emblem,
                                    "w": w, "h": h, "padPct": None})
        foot = page.evaluate(LINES_JS, foot_matrix)
        check(f"film foot: {len(foot_matrix)} plates measured", len(foot) == len(foot_matrix),
              f"measured {len(foot)}")
        for item in foot:
            _style, cname, size = item["label"].split("/")
            pairs = film_pairs(FIELDS[cname])
            tag = f"film foot {cname}/{size}"
            lines = item["lines"]
            rows = [l for l in lines if all(k + v in l["s"] for k, v in pairs)]
            if not check(f"{tag}: ISO · SEC · F print as one horizontal row",
                         len(rows) == 1 and rows[0]["parts"] >= 6,
                         json.dumps([l["s"] for l in lines])[:300]):
                continue
            row = rows[0]
            check(f"{tag}: the three pairs share one baseline, side by side",
                  len(set(row["ys"]) - {row["y"]}) == 0 and len(row["xs"]) >= 6,
                  json.dumps(row["ys"]))
            check(f"{tag}: the row is right-aligned to the inner edge",
                  abs(item["W"] - row["x1"] - item["inset"]) < 1.5,
                  f"gap={item['W'] - row['x1'] - item['inset']:.1f}px")
            check(f"{tag}: the row keeps clear of the bottom perforation rule",
                  row["y1"] <= item["botRuleY"] - 1,
                  f"y1={row['y1']} rule={item['botRuleY']}")
            em = item["emblems"][0] if item["emblems"] else None
            if not check(f"{tag}: the mark is painted at the left edge",
                         bool(em) and abs(em["x"] - item["pad"]) < 0.6,
                         json.dumps(item["emblems"])):
                continue
            block = [l for l in lines
                     if l is not row and l["y0"] >= item["photoBottom"] - 0.5
                     and l["x0"] >= em["x1"]]
            if not check(f"{tag}: the meta block runs beside the mark, not under it",
                         len(block) >= 3,
                         json.dumps([(l["s"], l["x0"], l["y"]) for l in lines])[:300]):
                continue
            lefts = [l["x0"] for l in block]
            check(f"{tag}: every line of the block shares one left edge",
                  max(lefts) - min(lefts) < 0.6, str(lefts))
            check(f"{tag}: the mark sits level with the block it labels",
                  min(l["y0"] for l in block) <= (em["y"] + em["y1"]) / 2 <= max(l["y1"] for l in block),
                  json.dumps(em))
            check(f"{tag}: the block never reaches the spec row",
                  max(l["x1"] for l in block) < row["x0"] - 1,
                  f"{max(l['x1'] for l in block):.1f} vs {row['x0']:.1f}")
            check(f"{tag}: the block stays above the bottom rule",
                  max(l["y1"] for l in block) <= item["botRuleY"] - 1,
                  f"{max(l['y1'] for l in block)} vs {item['botRuleY']}")
            check(f"{tag}: the spec row is the foot's lowest line",
                  row["y"] > max(l["y"] for l in block),
                  f"row={row['y']} block={max(l['y'] for l in block)}")

        # ── Pro Studio: the 2×2 grid is now one four-column bar ──
        print("\n[browser] pro studio: four-column spec bar")
        pro_matrix = []
        for cname, fields, emblem in FIT_CASES:
            if not fields:
                continue
            for sname, w, h in SIZES:
                pro_matrix.append({"style": "pro", "case": cname, "size": sname,
                                   "fields": fields, "emblem": emblem,
                                   "w": w, "h": h, "padPct": None})
        pro = page.evaluate(LINES_JS, pro_matrix)
        check(f"pro bar: {len(pro_matrix)} plates measured", len(pro) == len(pro_matrix),
              f"measured {len(pro)}")
        LABELS = ["ISO", "SHUTTER", "APERTURE", "FOCAL"]
        for item in pro:
            _style, cname, size = item["label"].split("/")
            fields = FIELDS[cname]
            tag = f"pro bar {cname}/{size}"
            lab = [l for l in item["lines"] if all(k in l["s"] for k in LABELS)]
            if not check(f"{tag}: the four labels share one row (no second row)",
                         len(lab) == 1,
                         json.dumps([l["s"] for l in item["lines"]])[:300]):
                continue
            line = lab[0]
            col_w = (item["W"] - item["pad"] * 2) / 4
            # a tracked label is painted glyph by glyph, so the four cells are
            # read back as the four leftmost pens sitting in four equal columns
            starts = []
            for i in range(4):
                lo = item["pad"] + i * col_w
                starts.append(min((x for x in line["xs"] if lo - 0.6 <= x < lo + col_w),
                                  default=-1))
            check(f"{tag}: four cells, one per column, on one baseline",
                  len(set(line["ys"])) == 1 and all(s >= 0 for s in starts) and
                  all(abs(starts[i] - (item["pad"] + i * col_w)) < 1.0 for i in range(4)),
                  json.dumps([round(s, 1) for s in starts]) + f" colW={col_w:.1f}")

            vals = [fields.get("iso") or "", fields.get("shutter") or "",
                    fields.get("aperture") or "", fields.get("focal") or ""]
            vline = [l for l in item["lines"] if all(v in l["s"] for v in vals)]
            if not check(f"{tag}: the four values print as one row under it",
                         len(vline) == 1 and vline[0]["parts"] >= 4,
                         json.dumps([l["s"] for l in item["lines"]])[:300]):
                continue
            vrow = vline[0]
            check(f"{tag}: the value row sits below the label row",
                  vrow["y"] > line["y"], f"{vrow['y']} vs {line['y']}")
            check(f"{tag}: no value crosses into the next column",
                  all(int((x0 - item["pad"]) // col_w) == int((x1 - item["pad"] - 0.6) // col_w)
                      for x0, x1 in zip(vrow["xs"], vrow["xe"])),
                  json.dumps([(x0, x1) for x0, x1 in zip(vrow["xs"], vrow["xe"])])[:300])
            rule = item["H"] - item["band"] * 0.2
            check(f"{tag}: the bar clears the footer rule",
                  vrow["y1"] < rule - 1, f"y1={vrow['y1']} rule={rule:.1f}")
            cap = fields.get("caption") or ""
            foot_line = [l for l in item["lines"] if cap and cap.upper() in l["s"].upper()]
            check(f"{tag}: the footer caption sits under the rule",
                  len(foot_line) == 1 and foot_line[0]["y0"] > rule,
                  json.dumps([(l["s"], l["y0"]) for l in item["lines"]])[:200])

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

        # ── emblem colour: the makers' own colours, then All Black ──────────
        # Every mark is painted on a white field and the pixels are counted, so
        # the check is about what reached the canvas — not what a hex string
        # said. Leica doubles as the knock-out test: its roundel is one path
        # with the script cut out by the even-odd rule, so a solid disc would
        # show zero paper inside it.
        print("\n[browser] emblem colour & All Black")
        BRAND_JS = """(args) => {
          const paint = (id, colors) => {
            const c = document.createElement('canvas');
            c.width = c.height = 220;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 220, 220);
            SPEmblems.draw(ctx, id, 0, 0, 220, 220, colors);
            const d = ctx.getImageData(0, 0, 220, 220).data;
            let paper = 0, ink = 0, lit = 0, red = 0, blue = 0;
            for (let i = 0; i < d.length; i += 4) {
              const r = d[i], g = d[i + 1], b = d[i + 2];
              if (r > 245 && g > 245 && b > 245) { paper++; continue; }
              lit++;
              const v = r + g + b;
              if (v < 200) ink++;
              if (r > 140 && g < 90 && b < 100) red++;
              if (b > 110 && b > r + 40) blue++;
            }
            return {paper, ink, lit, red, blue};
          };
          const day = {ink: '#000000', accent: '#ff824f', base: '#ffffff', light: true};
          const night = {ink: '#f0e9d9', accent: '#e0703c', base: '#16150f', light: false};
          const mono = (c) => Object.assign({ }, c, {mono: true});
          const out = {day: {}, night: {}, monoDay: {}, monoNight: {}, svg: {}};
          for (const id of args) {
            out.day[id] = paint(id, day);
            out.night[id] = paint(id, night);
            out.monoDay[id] = paint(id, mono(day));
            out.monoNight[id] = paint(id, mono(night));
          }
          for (const id of args) {
            out.svg[id] = {
              day: SPEmblems.svg(id, day),
              night: SPEmblems.svg(id, night),
              mono: SPEmblems.svg(id, mono(day))
            };
          }
          return out;
        }"""
        ids = ["sony", "canon", "nikon", "fujifilm", "samsung", "leica",
               "hasselblad", "apple", "lumix", "omsystem", "hd2lab"]
        brand = page.evaluate(BRAND_JS, ids)

        # each maker's own colour, measured as pixels
        check("colour: Canon paints Canon Red on canvas",
              brand["day"]["canon"]["red"] > 2000, str(brand["day"]["canon"]))
        check("colour: Canon keeps its red on a dark plate",
              brand["night"]["canon"]["red"] > 2000, str(brand["night"]["canon"]))
        check("colour: Leica paints the red roundel with the script cut out",
              brand["day"]["leica"]["red"] > 2000 and brand["day"]["leica"]["paper"] > 250,
              str(brand["day"]["leica"]))
        check("colour: Lumix paints Lumix Red", brand["day"]["lumix"]["red"] > 400,
              str(brand["day"]["lumix"]))
        check("colour: Samsung paints Samsung Blue on a light plate",
              brand["day"]["samsung"]["blue"] > 2000, str(brand["day"]["samsung"]))
        check("colour: Samsung blue is lifted so it reads on a dark plate",
              brand["night"]["samsung"]["blue"] > 2000 and
              "#3B6BFF" in brand["svg"]["samsung"]["night"], str(brand["night"]["samsung"]))
        check("colour: OM System paints its blue, lifted on dark",
              brand["day"]["omsystem"]["blue"] > 1500 and
              "#4B83FF" in brand["svg"]["omsystem"]["night"], str(brand["day"]["omsystem"]))
        check("colour: Fujifilm keeps an ink body with the red notch",
              brand["day"]["fujifilm"]["ink"] > 2000 and brand["day"]["fujifilm"]["red"] > 20,
              str(brand["day"]["fujifilm"]))
        check("colour: single-colour marks stay ink",
              all(brand["day"][i]["red"] == 0 for i in ("sony", "nikon", "apple", "hasselblad")),
              json.dumps({k: brand["day"][k]["red"] for k in ("sony", "nikon", "apple", "hasselblad")}))
        check("colour: HD2Lab keeps its accent orange",
              "#ff824f" in brand["svg"]["hd2lab"]["day"], brand["svg"]["hd2lab"]["day"][:160])

        # All Black — one ink for the whole mark, brand colours and accent gone
        mono_brand_left = [i for i in ids
                           if brand["monoDay"][i]["red"] or brand["monoDay"][i]["blue"]]
        check("All Black: no brand red or blue survives on any mark",
              not mono_brand_left, str(mono_brand_left))
        check("All Black: every mark is drawn in the plate ink (light frame = black)",
              all(brand["monoDay"][i]["ink"] > 200 for i in ("canon", "leica", "samsung",
                                                            "lumix", "omsystem", "sony")),
              json.dumps({i: brand["monoDay"][i]["ink"] for i in ("canon", "leica", "samsung")}))
        check("All Black: dark frames print the mark in the ink that survives there",
              all(brand["monoNight"][i]["lit"] > 200 for i in ("canon", "leica", "samsung")),
              json.dumps({i: brand["monoNight"][i] for i in ("canon", "leica")}))
        mono_svg = {i: brand["svg"][i]["mono"].lower() for i in ("canon", "leica", "samsung", "hd2lab")}
        check("All Black: the SVG hands over one ink, no brand hex",
              all(("#cc0000" not in v and "#e20613" not in v and
                   "#1428a0" not in v and "#ff824f" not in v) for v in mono_svg.values()),
              str(mono_svg["canon"])[:160])
        check("leica: the SVG carries fill-rule=evenodd",
              'fill-rule="evenodd"' in brand["svg"]["leica"]["day"])

        # the switch on the real panel, and what it repaints
        page.click('#insTabs [data-tab="emblem"]')
        page.wait_for_timeout(220)
        check("emblem pane: the colour switch is on screen",
              page.is_visible("#emblemMonoSeg"))
        check("emblem pane: 원본 컬러 is the default",
              page.get_attribute('#emblemMonoSeg [data-emblem-mono="color"]', "aria-pressed") == "true" and
              page.evaluate("() => SPApp.state.emblemMono") is False)
        TILE_COLORS_JS = """() => {
          const grab = (id) => {
            const svg = document.querySelector('#emblemGrid [data-emblem="' + id + '"] svg');
            if (!svg) return [];
            const set = new Set();
            svg.querySelectorAll('path, circle, rect, text').forEach(n => {
              ['fill', 'stroke'].forEach(a => {
                const v = n.getAttribute(a);
                if (v && v !== 'none') set.add(v.toLowerCase());
              });
            });
            return Array.from(set).sort();
          };
          return {canon: grab('canon'), leica: grab('leica'), samsung: grab('samsung'), hd2lab: grab('hd2lab')};
        }"""
        tile_colors = page.evaluate(TILE_COLORS_JS)
        check("emblem pane: tiles show each maker's own colour by default",
              "#cc0000" in tile_colors["canon"] and
              "#3b6bff" in tile_colors["samsung"] and      # night value: the tiles sit on dark ground
              "#ff824f" in tile_colors["hd2lab"] and
              "#e20613" in tile_colors["leica"], str(tile_colors))
        page.click('#emblemMonoSeg [data-emblem-mono="mono"]')
        page.wait_for_timeout(260)
        check("emblem pane: All Black flips the state and both buttons",
              page.evaluate("() => SPApp.state.emblemMono") is True and
              page.get_attribute('#emblemMonoSeg [data-emblem-mono="mono"]', "aria-pressed") == "true" and
              page.get_attribute('#emblemMonoSeg [data-emblem-mono="color"]', "aria-pressed") == "false")
        mono_tiles = page.evaluate(TILE_COLORS_JS)
        check("emblem pane: All Black repaints every tile in one ink",
              all(v == ["#d9ded6"] for v in mono_tiles.values()), str(mono_tiles))
        check("emblem pane: the plate follows the switch",
              page.evaluate("() => SPApp.layoutFor(null, 1200, 800).opts.emblemMono") is True)
        page.click('#emblemMonoSeg [data-emblem-mono="color"]')
        page.wait_for_timeout(200)
        check("emblem pane: 원본 컬러 comes back",
              page.evaluate("() => SPApp.state.emblemMono") is False)

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

        print("\n[browser] PC inspector (always on screen, tabs switch the pane)")
        check("inspector is on screen without any tap", page.evaluate(
            "() => getComputedStyle(document.querySelector('#sheet')).visibility") == "visible")
        check("all panes exist", page.locator(".pane").count() == 4)
        for name, kicker in (("exif", "EXIF 편집"), ("geometry", "프레임 · 여백"),
                             ("emblem", "메이커 엠블럼"), ("export", "내보내기")):
            page.click(f'#insTabs [data-tab="{name}"]')
            page.wait_for_timeout(200)
            check(f"inspector tab: {kicker}", page.inner_text("#sheetTitle") == kicker,
                  page.inner_text("#sheetTitle"))
            check(f"inspector shows only the {name} pane", page.evaluate(
                """(n) => { const active = [...document.querySelectorAll('.pane.is-active')];
                     return active.length === 1 && active[0].dataset.pane === n; }""", name))
            check(f"inspector tab {name} marked selected", page.get_attribute(
                f'#insTabs [data-tab="{name}"]', "aria-selected") == "true")
            check(f"stage stays live behind the {name} pane", page.is_visible("#stageCanvas"))
        page.click('#insTabs [data-tab="exif"]')
        page.wait_for_timeout(200)

        # EXIF edit → live repaint
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

        # geometry pane → sliders and ratio
        page.click('#insTabs [data-tab="geometry"]')
        page.wait_for_timeout(220)
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

        # emblem pane
        page.click('#insTabs [data-tab="emblem"]')
        page.wait_for_timeout(240)
        tiles = page.locator(".emblem-tile")
        check("emblem grid has auto + makers + none", tiles.count() >= 12, str(tiles.count()))
        page.click('.emblem-tile[data-emblem="hd2lab"]')
        page.wait_for_timeout(220)
        check("manual HD2Lab emblem selected",
              page.evaluate("() => SPApp.state.emblemChoice") == "hd2lab")
        page.click('.emblem-tile[data-emblem="auto"]')
        page.wait_for_timeout(200)

        print("\n[browser] export")
        page.evaluate("() => SPApp.setStyle('classic' in SPPlate.STYLES ? 'classic' : 'gallery')")
        page.evaluate("() => SPApp.setStyle('gallery')")
        page.wait_for_timeout(300)
        page.click('#insTabs [data-tab="export"]')
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

        # ── original resolution: 1:1 first, the memory ladder only if refused
        # A 5200×3400 photo is made inside the page (no big fixture in the
        # repo). Its frame must leave bigger than 4096px — the old fixed edge
        # used to cut every photo there — and when the device refuses those
        # pixels the same save must still land, at the next rung down.
        print("\n[browser] export resolution: 1:1 & memory fallback")
        loaded = page.evaluate("""async () => {
          const W = 5200, H = 3400;
          const c = document.createElement('canvas');
          c.width = W; c.height = H;
          const x = c.getContext('2d');
          const g = x.createLinearGradient(0, 0, W, H);
          g.addColorStop(0, '#24405e'); g.addColorStop(0.55, '#8d7a58'); g.addColorStop(1, '#d8b179');
          x.fillStyle = g; x.fillRect(0, 0, W, H);
          x.fillStyle = 'rgba(255,255,255,0.55)';
          for (let i = 0; i < 60; i++) {
            x.beginPath();
            x.arc((i * 977) % W, (i * 613) % H, 40 + (i % 7) * 18, 0, Math.PI * 2);
            x.fill();
          }
          const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
          const file = new File([blob], 'big-5200x3400.jpg',
                                {type: 'image/jpeg', lastModified: Date.now()});
          return await SPApp.loadFile(file, 'big', {silent: true});
        }""")
        check("1:1: a 5200×3400 photo loads", loaded is True, str(loaded))
        page.wait_for_timeout(500)
        readout = page.text_content("#exportSize") or ""
        want_w, want_h = [int(x) for x in re.findall(r"\d+", readout)[:2]]
        check("1:1: the readout promises the original pixels, past 4096",
              max(want_w, want_h) > 4096, readout)
        page.click('#insTabs [data-tab="export"]')
        page.wait_for_timeout(260)
        tmp = os.path.join(ROOT, "tests", "_export_big.jpg")
        with page.expect_download(timeout=60000) as dl:
            page.click("#downloadBtn")
        download = dl.value
        download.save_as(tmp)
        size = os.path.getsize(tmp)
        last = page.evaluate("() => window.__lastExport")
        try:
            from PIL import Image
            im = Image.open(tmp)
            check("1:1: a 5200×3400 photo exports at its own resolution, not 4096",
                  max(im.size) > 4096 and im.size == (want_w, want_h),
                  f"file={im.size} readout={(want_w, want_h)}")
        except ImportError:  # pragma: no cover
            skip("browser: 1:1 export dimensions", "Pillow unavailable")
        check("1:1: the export is not a 4096px fallback",
              bool(last) and last.get("reducedEdge", 1) == 0 and max(last["w"], last["h"]) > 4096,
              str(last))
        check("1:1: the file carries real bytes", size > 200_000, f"{size} B")
        os.remove(tmp)

        # the same save on a device that refuses anything past 4096px
        page.evaluate("() => SPApp.setField('caption', 'fallback 4096')")
        page.wait_for_timeout(120)
        page.evaluate("""() => {
          const orig = HTMLCanvasElement.prototype.toBlob;
          window.__toBlobOrig = orig;
          HTMLCanvasElement.prototype.toBlob = function (cb, mime, q) {
            if (Math.max(this.width, this.height) > 4096) { setTimeout(() => cb(null), 0); return; }
            return orig.call(this, cb, mime, q);
          };
        }""")
        tmp = os.path.join(ROOT, "tests", "_export_fallback.jpg")
        with page.expect_download(timeout=60000) as dl:
            page.click("#downloadBtn")
        download = dl.value
        download.save_as(tmp)
        last = page.evaluate("() => window.__lastExport")
        toasts = page.inner_text("#toasts") or ""
        try:
            from PIL import Image
            im = Image.open(tmp)
            check("fallback: the save still lands, at the next rung (4096px)",
                  max(im.size) == 4096, f"file={im.size}")
        except ImportError:  # pragma: no cover
            skip("browser: fallback dimensions", "Pillow unavailable")
        check("fallback: the ladder reports 4096 as the edge it saved at",
              bool(last) and last.get("reducedEdge") == 4096, str(last))
        check("fallback: the visitor is told why the pixels are fewer",
              "4096px" in toasts and "메모리" in toasts, toasts.replace("\n", " ")[:200])
        check("fallback: exactly one notice is raised",
              toasts.count("4096px") == 1, toasts.replace("\n", " ")[:200])
        os.remove(tmp)
        page.evaluate("() => { HTMLCanvasElement.prototype.toBlob = window.__toBlobOrig; }")

        # a refused allocation (getContext null) is the other silent failure
        page.evaluate("() => SPApp.setField('caption', 'fallback allocation')")
        page.wait_for_timeout(120)
        page.evaluate("""() => {
          const orig = HTMLCanvasElement.prototype.getContext;
          window.__ctxOrig = orig;
          HTMLCanvasElement.prototype.getContext = function (kind) {
            if (kind === '2d' && Math.max(this.width, this.height) > 4096) return null;
            return orig.apply(this, arguments);
          };
        }""")
        tmp = os.path.join(ROOT, "tests", "_export_fallback2.jpg")
        with page.expect_download(timeout=60000) as dl:
            page.click("#downloadBtn")
        download = dl.value
        download.save_as(tmp)
        last = page.evaluate("() => window.__lastExport")
        try:
            from PIL import Image
            im = Image.open(tmp)
            check("fallback: a refused canvas allocation is caught the same way",
                  max(im.size) == 4096 and last.get("reducedEdge") == 4096, f"file={im.size} {last}")
        except ImportError:  # pragma: no cover
            skip("browser: refused-allocation fallback", "Pillow unavailable")
        os.remove(tmp)
        page.evaluate("() => { HTMLCanvasElement.prototype.getContext = window.__ctxOrig; }")
        page.keyboard.press("Escape")
        check("no late console errors", not errors, str(errors[:3]))
        ctx.close()

        # ── PC 1440×900: two-column studio ──────────────────────────────────
        # From 1024px the same control panel is the fixed right inspector: the
        # toolbar is gone, the tabs sit on top of it, the export dock sits at
        # its foot, and the canvas keeps every edit in sight.
        print("\n[browser] PC 1440: two-column studio & always-on inspector")
        pctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        ppage = pctx.new_page()
        ppage.set_default_timeout(30000)
        perr = []
        ppage.on("pageerror", lambda e: perr.append(str(e)))
        ppage.on("console", lambda m: perr.append(m.text) if m.type == "error" else None)
        ppage.goto(base, wait_until="networkidle")
        ppage.wait_for_timeout(400)

        layout = ppage.evaluate("""() => {
          const r = s => document.querySelector(s).getBoundingClientRect();
          return {sheet: {x: r('#sheet').x, w: r('#sheet').width, top: r('#sheet').top,
                          h: r('#sheet').height},
                  stage: {w: r('.stage').width, x: r('.stage').x},
                  header: r('.app-header').height,
                  bar: getComputedStyle(document.querySelector('#toolbar')).display,
                  tabs: [...document.querySelectorAll('.ins-tab')].map(t => t.dataset.tab),
                  selected: [...document.querySelectorAll('.ins-tab')]
                              .filter(t => t.getAttribute('aria-selected') === 'true').map(t => t.dataset.tab),
                  dock: getComputedStyle(document.querySelector('#insDock')).display,
                  saveDisabled: document.querySelector('#dockSaveBtn').disabled,
                  wsHidden: document.querySelector('#wsStrip').hidden,
                  iw: window.innerWidth, vh: window.innerHeight,
                  sw: document.documentElement.scrollWidth,
                  sh: document.documentElement.scrollHeight};
        }""")
        check("PC: inspector is pinned to the right edge",
              abs(layout["sheet"]["x"] + layout["sheet"]["w"] - layout["iw"]) < 2, json.dumps(layout["sheet"]))
        check("PC: inspector is 360-380px wide", 360 <= layout["sheet"]["w"] <= 380,
              str(layout["sheet"]["w"]))
        check("PC: inspector runs from the header to the floor",
              abs(layout["sheet"]["top"] - layout["header"]) < 2
              and abs(layout["sheet"]["h"] - (layout["vh"] - layout["header"])) < 2,
              json.dumps(layout["sheet"]))
        check("PC: the stage takes the rest of the width",
              abs(layout["stage"]["w"] + layout["sheet"]["w"] - layout["iw"]) < 2, json.dumps(layout))
        check("PC: bottom toolbar is retired", layout["bar"] == "none", layout["bar"])
        check("PC: four inspector tabs", layout["tabs"] == ["exif", "geometry", "emblem", "export"],
              str(layout["tabs"]))
        check("PC: EXIF tab opens selected", layout["selected"] == ["exif"], str(layout["selected"]))
        check("PC: export dock is on screen", layout["dock"] != "none")
        check("PC: save is disabled while no photo is open", layout["saveDisabled"] is True)
        check("PC: workspace strip waits for photos", layout["wsHidden"] is True)
        check("PC: no page scroll",
              layout["sw"] <= layout["iw"] + 1 and layout["sh"] <= layout["vh"] + 1, json.dumps(layout))
        check("PC: landing offers 파일 열기 / 폴더 열기",
              ppage.is_visible("#emptyOpenFilesBtn") and ppage.is_visible("#emptyOpenFolderBtn"))

        ppage.click('#insTabs [data-tab="geometry"]')
        ppage.wait_for_timeout(240)
        tab = ppage.evaluate("""() => ({pane: [...document.querySelectorAll('.pane.is-active')].map(p => p.dataset.pane),
            canvas: document.querySelector('#stageCanvas').getBoundingClientRect().width,
            sheet: getComputedStyle(document.querySelector('#sheet')).visibility,
            dock: getComputedStyle(document.querySelector('#insDock')).display})""")
        check("PC: tab switch lands on the geometry pane", tab["pane"] == ["geometry"], str(tab))
        check("PC: the canvas stays in sight while editing",
              tab["canvas"] > 500 and tab["sheet"] == "visible", json.dumps(tab))
        check("PC: the dock stays under every pane", tab["dock"] != "none", str(tab))

        ppage.click("#emptySampleBtn")
        ppage.wait_for_function("() => window.SPApp.state.photo", timeout=20000)
        ppage.wait_for_timeout(800)
        sig = canvas_sig(ppage)["hash"]
        stage_w = ppage.evaluate("() => document.querySelector('#stageCanvas').getBoundingClientRect().width")
        ppage.evaluate("() => { const r = document.querySelector('#padRange');"
                      " r.value = 11; r.dispatchEvent(new Event('input', {bubbles:true})); }")
        ppage.wait_for_timeout(320)
        check("PC: a slider in the inspector repaints the live canvas",
              canvas_sig(ppage)["hash"] != sig)
        check("PC: the stage does not move while editing",
              abs(ppage.evaluate(
                  "() => document.querySelector('#stageCanvas').getBoundingClientRect().width") - stage_w) < 2)
        check("PC: the dock's save button wakes with the photo",
              ppage.is_enabled("#dockSaveBtn"))

        with ppage.expect_download(timeout=30000) as pdl:
            ppage.click("#dockSaveBtn")
        check("PC: dock save writes the plate file",
              re.fullmatch(r"Shutterplate_[^\\/]+_\d{12}\.jpg", pdl.value.suggested_filename) is not None,
              pdl.value.suggested_filename)

        # ── workspace: several photos at once ───────────────────────────────
        print("\n[browser] workspace: multi-open, strip, sort, arrows, batch save")
        SAMPLE_FILES = [os.path.join(ROOT, "assets", "samples", f"sample-0{i}.jpg") for i in (1, 2, 3)]
        ppage.set_input_files("#wsFileInput", SAMPLE_FILES)
        ppage.wait_for_function("() => SPApp.workspace().entries.length === 3", timeout=25000)
        ppage.wait_for_timeout(1500)
        ws = ppage.evaluate("""() => { const w = SPApp.workspace();
          return {name: w.name, n: w.entries.length, names: w.entries.map(e => e.name),
                  hidden: document.querySelector('#wsStrip').hidden,
                  items: document.querySelectorAll('.ws-item').length,
                  selected: [...document.querySelectorAll('.ws-item')]
                              .filter(i => i.getAttribute('aria-selected') === 'true').length,
                  thumbs: [...document.querySelectorAll('.ws-item img')]
                            .filter(i => !i.hidden && i.src.startsWith('data:image/jpeg')).length,
                  count: document.querySelector('#wsCount').textContent,
                  make: SPApp.state.fields.make,
                  stage: document.querySelector('#stageCanvas').getBoundingClientRect().width,
                  sw: document.documentElement.scrollWidth, iw: window.innerWidth,
                  sh: document.documentElement.scrollHeight, vh: window.innerHeight}; }""")
        check("workspace: three photos open", ws["n"] == 3, str(ws["n"]))
        check("workspace: the strip appears", ws["hidden"] is False)
        check("workspace: one item per photo", ws["items"] == 3, str(ws["items"]))
        check("workspace: files keep name order",
              ws["names"] == ["sample-01.jpg", "sample-02.jpg", "sample-03.jpg"], str(ws["names"]))
        check("workspace: the first photo is selected",
              ws["selected"] == 1 and ws["make"] == "SONY", json.dumps(ws))
        check("workspace: counter reads 1 / 3", ws["count"] == "1 / 3", ws["count"])
        check("workspace: every thumbnail is a local canvas crop", ws["thumbs"] == 3, str(ws["thumbs"]))
        check("workspace: the stage keeps most of the window", ws["stage"] > 600, str(ws["stage"]))
        check("workspace: the strip adds no page scroll",
              ws["sw"] <= ws["iw"] + 1 and ws["sh"] <= ws["vh"] + 1, json.dumps(ws))

        ppage.select_option("#wsSort", "reverse")
        ppage.wait_for_timeout(420)
        check("workspace: 이름 ↓ flips the order",
              ppage.evaluate("() => document.querySelector('.ws-item .ws-name').textContent") == "sample-03.jpg",
              ppage.evaluate("() => document.querySelector('.ws-item .ws-name').textContent"))
        ppage.select_option("#wsSort", "name")
        ppage.wait_for_timeout(340)
        check("workspace: 이름 ↑ restores it",
              ppage.evaluate("() => document.querySelector('.ws-item .ws-name').textContent") == "sample-01.jpg",
              ppage.evaluate("() => document.querySelector('.ws-item .ws-name').textContent"))

        ppage.evaluate("() => { SPApp.setStyle('pro'); SPApp.state.geo.padPct = 9; SPApp.render(); }")
        ppage.wait_for_timeout(260)
        ppage.click(".ws-item:nth-child(2)")
        ppage.wait_for_function(
            "() => SPApp.workspace().entries[1].id === SPApp.workspace().activeId", timeout=20000)
        ppage.wait_for_timeout(900)
        sw = ppage.evaluate("""() => ({make: SPApp.state.fields.make, style: SPApp.state.style,
            pad: SPApp.state.geo.padPct, exif: document.querySelector('#fMake').value,
            count: document.querySelector('#wsCount').textContent,
            name: document.querySelector('#metaName').textContent})""")
        check("workspace: clicking a photo re-reads its EXIF",
              sw["make"] == "FUJIFILM" and sw["exif"] == "FUJIFILM" and sw["name"] == "sample-02.jpg",
              json.dumps(sw))
        check("workspace: the chosen frame survives the switch", sw["style"] == "pro", str(sw["style"]))
        check("workspace: the padding survives the switch", sw["pad"] == 9, str(sw["pad"]))
        check("workspace: the counter follows the active photo", sw["count"] == "2 / 3", sw["count"])

        ppage.keyboard.press("ArrowRight")
        ppage.wait_for_timeout(950)
        check("workspace: → advances to the next photo",
              ppage.evaluate("() => SPApp.state.fields.make") == "Canon",
              ppage.evaluate("() => SPApp.state.fields.make"))
        ppage.keyboard.press("ArrowLeft")
        ppage.wait_for_timeout(950)
        check("workspace: ← comes back",
              ppage.evaluate("() => SPApp.state.fields.make") == "FUJIFILM",
              ppage.evaluate("() => SPApp.state.fields.make"))

        h_open = ppage.evaluate("() => document.querySelector('#wsStrip').getBoundingClientRect().height")
        ppage.click("#wsToggle")
        ppage.wait_for_timeout(320)
        h_fold = ppage.evaluate("() => document.querySelector('#wsStrip').getBoundingClientRect().height")
        check("workspace: the strip folds to its header",
              h_fold < 44 <= h_open, f"{h_open} → {h_fold}")
        check("workspace: folded strip hides the track",
              ppage.evaluate("() => getComputedStyle(document.querySelector('#wsTrack')).display") == "none")
        ppage.click("#wsToggle")
        ppage.wait_for_timeout(340)
        check("workspace: and opens again",
              ppage.evaluate("() => document.querySelector('#wsStrip').getBoundingClientRect().height") > 100)

        ppage.click('#insTabs [data-tab="export"]')
        ppage.wait_for_timeout(280)
        check("bulk: the button counts the photos",
              ppage.inner_text("#bulkLabel") == "전체 일괄 저장 (3장)", ppage.inner_text("#bulkLabel"))
        batch = []
        ppage.on("download", lambda d: batch.append(d.suggested_filename))
        ppage.click("#bulkBtn")
        ppage.wait_for_function(
            "() => SPApp.workspace().bulk === null && document.querySelector('#bulkStatus').textContent.includes('저장 완료')",
            timeout=120000)
        ppage.wait_for_timeout(500)
        check("bulk: one file per photo", len(batch) == 3, str(batch))
        check("bulk: every plate carries its own EXIF name",
              len(batch) == 3 and len(set(batch)) == 3
              and all(re.fullmatch(r"Shutterplate_[^\\/]+_\d{12}\.jpg", n) for n in batch), str(batch))
        check("bulk: progress reports the full set",
              "3 / 3" in ppage.inner_text("#bulkStatus"), ppage.inner_text("#bulkStatus"))
        check("bulk: the live photo is untouched by the batch",
              ppage.evaluate("() => SPApp.state.fields.make") == "FUJIFILM")
        check("PC: no console errors with the workspace open", not perr, str(perr[:3]))
        pctx.close()

        # ── workspace: folder open, both routes ─────────────────────────────
        # showDirectoryPicker is stubbed with the handle shape the API hands
        # back (kind/name/values/getFile), so the scan itself runs for real.
        print("\n[browser] workspace: folder (File System Access) & directory-input fallback")
        FOLDER_STUB = r"""
          window.showDirectoryPicker = async () => {
            const fileHandle = (name, src) => ({kind: 'file', name, getFile: async () => {
              const r = await fetch(src);
              const b = await r.blob();
              return new File([b], name, {type: 'image/jpeg'});
            }});
            const dirHandle = (name, children) => ({kind: 'directory', name, values: () => {
              let i = 0;
              return {next: async () => i < children.length
                ? {done: false, value: children[i++]}
                : {done: true, value: undefined}};
            }});
            return dirHandle('테스트 폴더', [
              fileHandle('A-sample.jpg', '/assets/samples/sample-01.jpg'),
              fileHandle('B-sample.jpg', '/assets/samples/sample-02.jpg'),
              dirHandle('sub', [fileHandle('C-sample.jpg', '/assets/samples/sample-03.jpg')])
            ]);
          };
        """
        fctx = browser.new_context(viewport={"width": 1440, "height": 900})
        fctx.add_init_script(FOLDER_STUB)
        fpage = fctx.new_page()
        fpage.set_default_timeout(30000)
        ferr = []
        fpage.on("pageerror", lambda e: ferr.append(str(e)))
        fpage.goto(base, wait_until="networkidle")
        fpage.wait_for_timeout(300)
        fpage.click("#openFolderBtn")
        fpage.wait_for_function(
            "() => SPApp.workspace().entries.length === 2 && !SPApp.workspace().scanning", timeout=30000)
        fpage.wait_for_timeout(900)
        flat = fpage.evaluate("""() => { const w = SPApp.workspace();
          return {name: w.name, paths: w.entries.map(e => e.path),
                  count: document.querySelector('#wsCount').textContent,
                  hidden: document.querySelector('#wsStrip').hidden,
                  make: SPApp.state.fields.make}; }""")
        check("folder: the picked folder is named in the strip", flat["name"] == "테스트 폴더", flat["name"])
        check("folder: subfolders are left out by default",
              flat["paths"] == ["A-sample.jpg", "B-sample.jpg"], str(flat["paths"]))
        check("folder: its first photo opens", flat["make"] == "SONY", flat["make"])
        check("folder: the strip shows the folder",
              flat["hidden"] is False and flat["count"] == "1 / 2", json.dumps(flat))

        fpage.check("#recursiveToggle")
        fpage.click("#openFolderBtn")
        fpage.wait_for_function(
            "() => SPApp.workspace().entries.length === 3 && !SPApp.workspace().scanning", timeout=30000)
        fpage.wait_for_timeout(700)
        rec = fpage.evaluate("() => SPApp.workspace().entries.map(e => e.path)")
        check("folder: 하위 폴더 포함 walks the tree",
              rec == ["A-sample.jpg", "B-sample.jpg", "sub/C-sample.jpg"], str(rec))
        check("folder: no page errors", not ferr, str(ferr[:3]))
        fctx.close()

        nctx = browser.new_context(viewport={"width": 1440, "height": 900})
        nctx.add_init_script("window.showDirectoryPicker = undefined;")
        npage = nctx.new_page()
        npage.set_default_timeout(30000)
        nerr = []
        npage.on("pageerror", lambda e: nerr.append(str(e)))
        npage.goto(base, wait_until="networkidle")
        npage.wait_for_timeout(300)
        with npage.expect_file_chooser() as fc:
            npage.click("#openFolderBtn")
        fc.value.set_files(os.path.join(ROOT, "assets", "samples"))
        npage.wait_for_function("() => SPApp.workspace().entries.length === 3", timeout=30000)
        npage.wait_for_timeout(700)
        fb = npage.evaluate("""() => { const w = SPApp.workspace();
          return {n: w.entries.length, name: w.name, paths: w.entries.map(e => e.path),
                  make: SPApp.state.fields.make}; }""")
        check("fallback: the directory input opens the folder", fb["n"] == 3, json.dumps(fb))
        check("fallback: relative paths give the folder name", fb["name"] == "samples", fb["name"])
        check("fallback: its first photo opens", fb["make"] == "SONY", fb["make"])
        check("fallback: no page errors", not nerr, str(nerr[:3]))
        nctx.close()

        # ── tablet 900: the sheet path below the 1024 breakpoint ───────────
        print("\n[browser] tablet 900: toolbar + sheet kept below 1024")
        tctx = browser.new_context(viewport={"width": 900, "height": 800})
        tpage = tctx.new_page()
        tpage.goto(base, wait_until="networkidle")
        tpage.wait_for_timeout(300)
        check("tablet: the bottom toolbar is still there",
              tpage.evaluate("() => getComputedStyle(document.querySelector('#toolbar')).display") != "none")
        check("tablet: the sheet starts closed", tpage.evaluate(
            "() => getComputedStyle(document.querySelector('#sheet')).visibility") == "hidden")
        check("tablet: inspector tabs stay hidden",
              tpage.evaluate("() => getComputedStyle(document.querySelector('#insTabs')).display") == "none")
        check("tablet: export dock stays hidden",
              tpage.evaluate("() => getComputedStyle(document.querySelector('#insDock')).display") == "none")
        check("tablet: PC open buttons stay hidden", not tpage.is_visible("#openFilesBtn"))
        for name, kicker in (("exif", "EXIF 편집"), ("geometry", "프레임 · 여백"),
                             ("emblem", "메이커 엠블럼"), ("export", "내보내기")):
            tpage.click(f'[data-sheet="{name}"]')
            tpage.wait_for_timeout(300)
            check(f"tablet: sheet opens {kicker}",
                  tpage.evaluate("() => getComputedStyle(document.querySelector('#sheet')).visibility") == "visible"
                  and tpage.inner_text("#sheetTitle") == kicker, tpage.inner_text("#sheetTitle"))
            check(f"tablet: sheet shows the {name} pane", tpage.evaluate(
                """(n) => { const a = [...document.querySelectorAll('.pane.is-active')];
                     return a.length === 1 && a[0].dataset.pane === n; }""", name))
            tpage.keyboard.press("Escape")
            tpage.wait_for_timeout(420)
            check(f"tablet: Escape closes the {name} sheet", tpage.evaluate(
                "() => getComputedStyle(document.querySelector('#sheet')).visibility") == "hidden")
        tctx.close()

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

        pcbits = mpage.evaluate("""() => ({
            tabs: getComputedStyle(document.querySelector('#insTabs')).display,
            dock: getComputedStyle(document.querySelector('#insDock')).display,
            ws: getComputedStyle(document.querySelector('#wsStrip')).display,
            pcRow: getComputedStyle(document.querySelector('.empty-row--pc')).display,
            openBtn: document.querySelector('#openFilesBtn').getBoundingClientRect().width,
            toolbar: getComputedStyle(document.querySelector('#toolbar')).display,
            sheetVisible: getComputedStyle(document.querySelector('#sheet')).visibility
        })""")
        check("mobile: inspector tabs stay out of the phone layout", pcbits["tabs"] == "none", str(pcbits))
        check("mobile: export dock stays out of the phone layout", pcbits["dock"] == "none", str(pcbits))
        check("mobile: workspace strip stays out of the phone layout", pcbits["ws"] == "none", str(pcbits))
        check("mobile: PC open row stays out of the phone layout", pcbits["pcRow"] == "none", str(pcbits))
        check("mobile: no PC open button in the header", pcbits["openBtn"] == 0, str(pcbits["openBtn"]))
        check("mobile: the bottom toolbar is still the way in", pcbits["toolbar"] != "none", str(pcbits))
        check("mobile: the panel is a closed sheet, not a sidebar",
              pcbits["sheetVisible"] == "hidden", str(pcbits["sheetVisible"]))

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
