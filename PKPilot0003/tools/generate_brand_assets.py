#!/usr/bin/env python3
"""
PKPilot0003 · Shutterplate — HD2Lab brand asset generator
=========================================================
Produces the official HD2Lab asset set for Shutterplate:

    favicon.svg, favicon.ico(16/32/48), favicon-32x32.png,
    apple-touch-icon.png(180), icon-192.png, icon-512.png,
    og-image.png / social-preview.png (1200×630)

The glyph is a "plate": orange frame, dark image window, signature rule.

    python3 tools/generate_brand_assets.py [--font PATH] [--out DIR]
"""
from __future__ import annotations

import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

INK = "#101110"
ACCENT = "#ff824f"
BG = "#0c0d0c"
GRID = "#151715"
CARD = "#141614"
CARD_BORDER = "#242824"
TEXT_HI = "#eef1ec"
TEXT = "#ccd2ca"
MUTED = "#8b948a"
DIM = "#6b746a"
LINE = "#1f241f"

FONT_CANDIDATES = [
    os.environ.get("PICKLE_BRAND_FONT", ""),
    "/workspace/tmp-fonts/NotoSansKR-VF.ttf",
    os.path.join(ROOT, "..", "..", "tmp-fonts", "NotoSansKR-VF.ttf"),
    "/usr/share/fonts/opentype/unifont/unifont_jp.otf",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
]
MONO_CANDIDATES = [
    "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
    "/usr/share/fonts/pickle-hwp/NotoSansMonoCJKkr-Regular.otf",
]

FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="13" fill="#101110"/>
  <rect x="12" y="13" width="40" height="30" rx="3" fill="#ff824f"/>
  <rect x="16" y="17" width="32" height="20" rx="1.6" fill="#101110"/>
  <path d="M24 49h16" stroke="#ff824f" stroke-width="4.4" stroke-linecap="round"/>
</svg>
"""

MARK_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="6" y="6" width="52" height="52" rx="12" fill="none" stroke="#ff824f" stroke-width="3"/>
  <rect x="14" y="14" width="36" height="24" rx="3" fill="#ff824f"/>
  <rect x="18" y="18" width="28" height="16" rx="1.6" fill="#101110"/>
  <path d="M24 47h16" stroke="#ff824f" stroke-width="4" stroke-linecap="round"/>
</svg>
"""

_font_cache: dict = {}
FONT_PATH = next((p for p in FONT_CANDIDATES if p and os.path.exists(p)), None)
MONO_PATH = next((p for p in MONO_CANDIDATES if p and os.path.exists(p)), None)


def font(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    key = ("sans", size, weight)
    if key in _font_cache:
        return _font_cache[key]
    if not FONT_PATH:
        raise SystemExit("한글 폰트 경로를 --font 로 지정해 주세요.")
    f = ImageFont.truetype(FONT_PATH, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    _font_cache[key] = f
    return f


def mono(size: int) -> ImageFont.FreeTypeFont:
    key = ("mono", size, "Regular")
    if key in _font_cache:
        return _font_cache[key]
    f = ImageFont.truetype(MONO_PATH or FONT_PATH, size)
    _font_cache[key] = f
    return f


def spaced(d: ImageDraw.ImageDraw, xy, text: str, f, fill, spacing: float = 0.0, anchor: str = "l"):
    total = sum(d.textlength(ch, font=f) for ch in text) + spacing * max(0, len(text) - 1)
    x = xy[0] - (total / 2 if anchor == "m" else total if anchor == "r" else 0)
    for ch in text:
        d.text((x, xy[1]), ch, font=f, fill=fill, anchor="ls")
        x += d.textlength(ch, font=f) + spacing
    return total


# ── icons ────────────────────────────────────────────────────────────────────
def render_glyph(px: int) -> Image.Image:
    """Draw the plate glyph at px×px (4× supersampled, then downscaled)."""
    S = 4
    size = px * S
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = size / 64.0

    def r(*v):
        return tuple(round(x * k) for x in v)

    d.rounded_rectangle(r(0, 0, 64, 64), radius=r(13)[0], fill=INK)
    d.rounded_rectangle(r(12, 13, 52, 43), radius=r(3)[0], fill=ACCENT)
    d.rounded_rectangle(r(16, 17, 48, 37), radius=r(1.6)[0], fill=INK)
    w = max(1, round(4.4 * k))
    d.line([(24 * k, 49 * k), (40 * k, 49 * k)], fill=ACCENT, width=w)
    for cx, cy in ((24 * k, 49 * k), (40 * k, 49 * k)):
        d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=ACCENT)
    return img.resize((px, px), Image.LANCZOS)


def render_mark(px: int) -> Image.Image:
    S = 4
    size = px * S
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = size / 64.0
    d.rounded_rectangle([6 * k, 6 * k, 58 * k, 58 * k], radius=12 * k,
                        outline=ACCENT, width=max(1, round(3 * k)))
    d.rounded_rectangle([14 * k, 14 * k, 50 * k, 38 * k], radius=3 * k, fill=ACCENT)
    d.rounded_rectangle([18 * k, 18 * k, 46 * k, 34 * k], radius=1.6 * k, fill=INK)
    w = max(1, round(4 * k))
    d.line([(24 * k, 47 * k), (40 * k, 47 * k)], fill=ACCENT, width=w)
    return img.resize((px, px), Image.LANCZOS)


def build_icons(out_dir: str):
    with open(os.path.join(out_dir, "favicon.svg"), "w", encoding="utf-8") as fh:
        fh.write(FAVICON_SVG)

    master = render_glyph(1024)
    made = [("favicon.svg", (64, 64))]
    for name, size in [("favicon-32x32.png", 32), ("apple-touch-icon.png", 180),
                       ("icon-192.png", 192), ("icon-512.png", 512)]:
        master.resize((size, size), Image.LANCZOS).save(
            os.path.join(out_dir, name), "PNG", optimize=True)
        made.append((name, (size, size)))

    ico = master.resize((256, 256), Image.LANCZOS).convert("RGBA")
    ico.save(os.path.join(out_dir, "favicon.ico"), format="ICO",
             sizes=[(16, 16), (32, 32), (48, 48)])
    made.append(("favicon.ico", (48, 48)))
    return made


# ── OG ───────────────────────────────────────────────────────────────────────
S = 2


def sc(*v):
    return tuple(int(round(x * S)) for x in v)


def _rgb(hexcode):
    h = hexcode.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _mix(a, b, t):
    return tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))


def photo_slab(d, box, palette):
    """A stand-in photograph: sky gradient, sun, two ridges, foreground."""
    sky_top, sky_bot, sun, far, near, ground = [_rgb(c) for c in palette]
    x0, y0, x1, y1 = sc(*box)
    w, h = x1 - x0, y1 - y0

    for i in range(h):
        d.line([(x0, y0 + i), (x1, y0 + i)], fill=_mix(sky_top, sky_bot, i / max(1, h - 1)))

    # sun + soft halo
    sx, sy, sr = x0 + w * 0.68, y0 + h * 0.5, h * 0.13
    for k in range(5, 0, -1):
        rr = sr * (1 + k * 0.55)
        d.ellipse([sx - rr, sy - rr, sx + rr, sy + rr],
                  fill=_mix(sky_bot, sun, 0.12 * (6 - k) / 5))
    d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=sun)

    # ridges
    d.polygon([(x0, y0 + h * 0.74), (x0 + w * 0.22, y0 + h * 0.44), (x0 + w * 0.42, y0 + h * 0.78)], fill=far)
    d.polygon([(x0 + w * 0.3, y0 + h * 0.8), (x0 + w * 0.58, y0 + h * 0.5), (x0 + w * 1.02, y0 + h * 0.86)], fill=far)
    d.polygon([(x0 - w * 0.02, y0 + h * 1.0), (x0 + w * 0.35, y0 + h * 0.72), (x0 + w * 0.75, y0 + h * 1.0)], fill=near)
    d.rectangle([x0, y0 + h * 0.9, x1, y1], fill=ground)


def plate_thumb(d, box, kind):
    x0, y0, x1, y1 = box
    if kind == "classic":
        d.rounded_rectangle(sc(x0, y0, x1, y1), radius=6 * S, fill="#f8f6f2")
        photo_slab(d, (x0 + 14, y0 + 14, x1 - 14, y1 - 46),
                   ("#f0c489", "#e79a63", "#ffe6bd", "#8d7f74", "#4d5344", "#3c4433"))
        d.text(((x0 + x1) / 2 * S, (y1 - 30) * S), "SONY α7 IV · 35MM · ƒ/1.8",
               font=mono(7 * S), fill="#6f6a62", anchor="ms")
        d.line([((x0 + x1) / 2 - 18) * S, (y1 - 18) * S,
                ((x0 + x1) / 2 + 18) * S, (y1 - 18) * S], fill="#cfc9bf", width=1 * S)
    elif kind == "studio":
        d.rounded_rectangle(sc(x0, y0, x1, y1), radius=6 * S, fill="#101110",
                            outline="#242824", width=1 * S)
        photo_slab(d, (x0 + 12, y0 + 12, x1 - 12, y1 - 40),
                   ("#243244", "#4f6376", "#dfeaf2", "#2b3a49", "#141c24", "#0f151b"))
        d.line([(x0 + 12) * S, (y1 - 34) * S, (x0 + 52) * S, (y1 - 34) * S],
               fill=ACCENT, width=2 * S)
        d.text(((x0 + 12) * S, (y1 - 16) * S), "SHUTTERPLATE · 03", font=mono(7 * S), fill="#8b8b85")
    else:
        d.rounded_rectangle(sc(x0, y0, x1, y1), radius=4 * S, fill="#16150f")
        for i in range(7):
            bx = x0 + 10 + i * 26
            for by in (y0 + 6, y1 - 12):
                d.rounded_rectangle(sc(bx, by, bx + 12, by + 6), radius=1.2 * S, fill="#efe7d8")
        photo_slab(d, (x0 + 12, y0 + 18, x1 - 12, y1 - 40),
                   ("#b98a5c", "#e8b884", "#fff0cc", "#6d4a32", "#3a2718", "#2a1c11"))
        d.text(((x0 + 12) * S, (y1 - 28) * S), "PORTRA 400", font=mono(7 * S), fill="#e0703c")
        d.text(((x1 - 12) * S, (y1 - 28) * S), "#12", font=mono(7 * S), fill="#a89c86", anchor="rs")


def build_og(out_dir: str) -> str:
    W, H = 1200 * S, 630 * S
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    for x in range(0, W + 1, 40 * S):
        d.line([(x, 0), (x, H)], fill=GRID)
    for y in range(0, H + 1, 40 * S):
        d.line([(0, y), (W, y)], fill=GRID)

    d.rounded_rectangle(sc(56, 36, 1144, 594), radius=26 * S, fill=CARD,
                        outline=CARD_BORDER, width=int(1.4 * S))

    r = 5 * S
    d.ellipse((104 * S - r, 90 * S - r, 104 * S + r, 90 * S + r), fill=ACCENT)
    spaced(d, (124 * S, 96 * S), "03 / CRAFT · SHUTTERPLATE", font(13 * S, "Medium"),
           MUTED, spacing=2.4 * S)
    d.text((1096 * S, 96 * S), "LOCAL ONLY · 0 B UPLOAD", font=mono(11 * S), fill=DIM, anchor="rs")

    mark = render_mark(78 * S)
    img.paste(mark, (92 * S, 126 * S), mark)

    base_y = 186
    f_title = font(54 * S, "SemiBold")
    d.text((186 * S, base_y * S), "HD2Lab", font=f_title, fill=TEXT_HI, anchor="ls")
    px = 186 * S + d.textlength("HD2Lab", font=f_title) + 16 * S
    d.line([(px, (base_y - 36) * S), (px, base_y * S)], fill="#3a403a", width=int(2.5 * S))
    d.text((px + 18 * S, base_y * S), "Shutterplate", font=f_title, fill=ACCENT, anchor="ls")

    f_head = font(44 * S, "Bold")
    d.text((96 * S, 268 * S), "사진 한 장을,", font=f_head, fill=TEXT_HI, anchor="ls")
    d.text((96 * S, 322 * S), "한 장의 ", font=f_head, fill=TEXT_HI, anchor="ls")
    w = d.textlength("한 장의 ", font=f_head)
    d.text((96 * S + w, 322 * S), "플레이트", font=f_head, fill=ACCENT, anchor="ls")
    d.text((96 * S + w + d.textlength("플레이트", font=f_head), 322 * S), "로.",
           font=f_head, fill=TEXT_HI, anchor="ls")

    d.text((97 * S, 372 * S), "EXIF를 읽어 보더·노출 스펙·서명을 얹고, 원본 1:1 해상도로 내려받습니다.",
           font=font(16.5 * S), fill=MUTED)
    d.text((97 * S, 400 * S), "시그니처 플레이트 4종 · 메이커 엠블럼 10종 · 100% 브라우저 로컬 처리",
           font=font(16.5 * S), fill=MUTED)

    # plate strip
    xs = [96, 96 + 262 + 16, 96 + 2 * (262 + 16)]
    for x, kind in zip(xs, ("classic", "studio", "film")):
        plate_thumb(d, (x, 428, x + 262, 428 + 128), kind)

    d.line([(104 * S, 578 * S), (1096 * S, 578 * S)], fill=LINE, width=int(1 * S))
    spaced(d, (104 * S, 604 * S), "EXIF PLATE STUDIO · BUILT IN THE BROWSER",
           font(11.5 * S, "Medium"), MUTED, spacing=1.5 * S)
    d.text((1096 * S, 604 * S), "hyangdan2.github.io/PKPilot0003", font=mono(11.5 * S),
           fill="#9aa39a", anchor="rs")

    out = img.resize((1200, 630), Image.LANCZOS)
    path = os.path.join(out_dir, "og-image.png")
    out.save(path, "PNG", optimize=True)
    out.save(os.path.join(out_dir, "social-preview.png"), "PNG", optimize=True)
    return path


def main() -> int:
    ap = argparse.ArgumentParser(description="PKPilot0003 (Shutterplate) 브랜드 에셋 생성")
    ap.add_argument("--font")
    ap.add_argument("--out", default=ROOT)
    args = ap.parse_args()

    global FONT_PATH
    if args.font:
        FONT_PATH = args.font

    os.makedirs(args.out, exist_ok=True)
    icons = build_icons(args.out)
    og = build_og(args.out)

    print("아이콘")
    for name, size in icons:
        p = os.path.join(args.out, name)
        print(f"  {name:22s} {size[0]}x{size[1]:<4d} {os.path.getsize(p):>8,d} B")
    print(f"OG\n  {os.path.basename(og):22s} 1200x630 {os.path.getsize(og):>8,d} B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
