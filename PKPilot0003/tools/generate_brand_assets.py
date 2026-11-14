#!/usr/bin/env python3
"""
PKPilot0003 · Shutterplate — HD2Lab brand asset generator
=========================================================
Produces the official HD2Lab asset set for Shutterplate:

    favicon.svg, favicon.ico(16/32/48), favicon-32x32.png,
    apple-touch-icon.png(180), icon-192.png, icon-512.png,
    og-image.png / social-preview.png (1200×630)

The favicon set keeps the dual-skew glyph — two stroked parallelograms in
#ff824f on the #101110 round square — because that is what a favicon is for.
Every other logo slot (the OG/social card header, the site header, the plate
emblem) carries the brand's official logo: the round emblem of LOGO.png,
lifted into assets/logo-mark.png.

    python3 tools/generate_brand_assets.py [--font PATH] [--out DIR]
"""

from __future__ import annotations

import io
import os
import sys

from PIL import Image, ImageDraw, ImageFont

try:
    import cairosvg
except ImportError:  # pragma: no cover
    cairosvg = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── brand tokens (HD2Lab standard) ──────────────────────────────────────────
INK = "#101110"
ACCENT = "#ff824f"
ACCENT_SOFT = "#2a1a12"
BG = "#0c0d0c"
GRID = "#161816"
CARD = "#141614"
CARD_BORDER = "#242824"
TILE = "#0f110f"
TILE_BORDER = "#242824"
TEXT_HI = "#e8ece7"
TEXT = "#cfd6cd"
MUTED = "#8d968c"
DIM = "#6f7a6f"
LINE = "#1f241f"

MARK_PATH = "M15 20L35 10V43L15 53ZM29 24L49 14V47L29 57Z"

FAVICON_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    '<rect width="64" height="64" rx="12" fill="#101110"/>'
    f'<path d="{MARK_PATH}" fill="none" stroke="#ff824f" stroke-width="4"/></svg>\n'
)

# 정식 HD2Lab 로고 — 파비콘 세트(듀얼 스큐)는 그대로 두고, 그 밖의 모든 로고
# 자리(사이트 헤더·OG/소셜 카드)에는 LOGO.png의 원형 엠블럼을 쓴다.
LOGO_PATH = os.path.join(ROOT, "..", "assets", "logo-mark.png")


def logo_badge(px: int) -> Image.Image:
    badge = Image.open(LOGO_PATH).convert("RGBA")
    return badge.resize((px, px), Image.LANCZOS)

FONT_CANDIDATES = [
    os.environ.get("PICKLE_BRAND_FONT", ""),
    "/workspace/tmp-fonts/NotoSansKR-VF.ttf",
    os.path.join(ROOT, "..", "..", "tmp-fonts", "NotoSansKR-VF.ttf"),
    "/usr/share/fonts/truetype/noto/NotoSansKR-VF.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansKR-Regular.otf",
    "/usr/share/fonts/pickle-hwp/NotoSansCJKkr-Regular.otf",
]
MONO_CANDIDATES = [
    "/usr/share/fonts/pickle-hwp/NotoSansMonoCJKkr-Regular.otf",
    "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
]

_font_cache: dict = {}
FONT_PATH = next((p for p in FONT_CANDIDATES if p and os.path.exists(p)), None)
MONO_PATH = next((p for p in MONO_CANDIDATES if p and os.path.exists(p)), None)


def font(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    key = ("sans", size, weight)
    if key in _font_cache:
        return _font_cache[key]
    if not FONT_PATH:
        raise SystemExit("한글 폰트를 찾지 못했습니다. --font 로 지정해 주세요.")
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


def spaced(d, xy, text, f, fill, spacing=0.0, anchor="l"):
    total = sum(d.textlength(ch, font=f) for ch in text) + spacing * max(0, len(text) - 1)
    x = xy[0] - (total / 2 if anchor == "m" else total if anchor == "r" else 0)
    for ch in text:
        d.text((x, xy[1]), ch, font=f, fill=fill, anchor="ls")
        x += d.textlength(ch, font=f) + spacing
    return total


# ── vector rasterisation ────────────────────────────────────────────────────
def render_svg(svg: str, px: int) -> Image.Image:
    if cairosvg is None:
        raise SystemExit("cairosvg 가 필요합니다: pip install cairosvg")
    buf = io.BytesIO()
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=buf,
                     output_width=px, output_height=px)
    buf.seek(0)
    return Image.open(buf).convert("RGBA")



# ── icon set ────────────────────────────────────────────────────────────────
def build_icons(out_dir: str):
    with open(os.path.join(out_dir, "favicon.svg"), "w", encoding="utf-8") as fh:
        fh.write(FAVICON_SVG)

    master = render_svg(FAVICON_SVG, 1024)
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


# ── OG card ─────────────────────────────────────────────────────────────────
S = 2  # supersampling: draw at 2400×1260, ship 1200×630


def sc(*v):
    return tuple(int(round(x * S)) for x in v)


def rrect(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline,
                        width=max(1, int(round(width))))


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

    sx, sy, sr = x0 + w * 0.7, y0 + h * 0.44, h * 0.1
    for k in range(5, 0, -1):
        rr = sr * (1 + k * 0.6)
        d.ellipse([sx - rr, sy - rr, sx + rr, sy + rr],
                  fill=_mix(sky_bot, sun, 0.1 * (6 - k) / 5))
    d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=sun)

    d.polygon([(x0, y0 + h * 0.76), (x0 + w * 0.22, y0 + h * 0.46), (x0 + w * 0.44, y0 + h * 0.8)], fill=far)
    d.polygon([(x0 + w * 0.3, y0 + h * 0.82), (x0 + w * 0.58, y0 + h * 0.52), (x1 + w * 0.02, y0 + h * 0.88)], fill=far)
    d.polygon([(x0 - w * 0.02, y0 + h * 1.02), (x0 + w * 0.35, y0 + h * 0.74), (x0 + w * 0.78, y0 + h * 1.02)], fill=near)
    d.rectangle([x0, y0 + h * 0.92, x1, y1], fill=ground)


def plate_card(img, box, kind):
    d = ImageDraw.Draw(img)
    """Compact but faithful mock of the shipped frames."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0

    if kind == "horizon":
        pad = round(w * 0.034)
        rrect(d, sc(x0, y0, x1, y1), 4 * S, fill="#faf9f6")
        photo_slab(d, (x0 + pad, y0 + pad, x1 - pad, y0 + h - pad - h * 0.22),
                   ("#f2c78d", "#e9a273", "#fff4d8", "#8d7f74", "#4d5344", "#3c4433"))
        cx = (x0 + x1) / 2
        d.text((cx * S, (y1 - h * 0.17) * S), "SONY  ILCE-7M4",
               font=font(9.5 * S, "SemiBold"), fill="#17181b", anchor="ms")
        d.text((cx * S, (y1 - h * 0.085) * S), "35mm · ƒ/1.8 · 1/250s · ISO 100",
               font=mono(6 * S), fill="#7b756c", anchor="ms")

    elif kind == "studio":
        pad = round(w * 0.055)
        rrect(d, sc(x0, y0, x1, y1), 7 * S, fill="#101110")
        photo_slab(d, (x0 + pad, y0 + pad, x1 - pad, y0 + h - pad - h * 0.24),
                   ("#243244", "#4f6376", "#dfeaf2", "#2b3a49", "#141c24", "#0f151b"))
        by = y0 + h - pad - h * 0.24
        d.line([(x0 + pad) * S, by * S, (x1 - pad) * S, by * S], fill="#33362f", width=1 * S)
        d.line([(x0 + pad) * S, by * S, (x0 + pad + w * 0.12) * S, by * S], fill=ACCENT, width=int(1.6 * S))
        # corner brackets
        for (bx, byy, dx, dy) in ((x0 + 6, y0 + 6, 1, 1), (x1 - 6, y0 + 6, -1, 1),
                                  (x0 + 6, y1 - 6, 1, -1), (x1 - 6, y1 - 6, -1, -1)):
            d.line([(bx * S, byy * S), ((bx + dx * 10) * S, byy * S)], fill=ACCENT, width=int(1.2 * S))
            d.line([(bx * S, byy * S), (bx * S, (byy + dy * 10) * S)], fill=ACCENT, width=int(1.2 * S))
        d.text(((x0 + pad) * S, (by + h * 0.10) * S), "SONY ILCE-7M4",
               font=font(8 * S, "SemiBold"), fill="#f4f2ed")
        d.text(((x0 + pad) * S, (by + h * 0.17) * S), "FE 35mm F1.4 GM",
               font=mono(5.2 * S), fill="#8d8b85")
        d.text(((x1 - pad) * S, (by + h * 0.10) * S), "35mm · ƒ/1.8",
               font=mono(5.6 * S), fill="#f4f2ed", anchor="rs")
        d.text(((x1 - pad) * S, (by + h * 0.155) * S), "2026.10.24 17:32",
               font=mono(4.8 * S), fill="#8d8b85", anchor="rs")

    else:  # film
        pad = round(w * 0.06)
        rrect(d, sc(x0, y0, x1, y1), 3 * S, fill="#16150f")
        hole_y = [y0 + 3, y1 - 9]
        for hy in hole_y:
            bx = x0 + 5
            while bx < x1 - 10:
                rrect(d, sc(bx, hy, bx + 6, hy + 4), 1.2 * S, fill="#eee5d2")
                bx += 10
        photo_slab(d, (x0 + pad, y0 + h * 0.11, x1 - pad, y0 + h * 0.62),
                   ("#b98a5c", "#e8b884", "#fff0cc", "#6d4a32", "#3a2718", "#2a1c11"))
        mk = logo_badge(10 * S)
        img.paste(mk, (int((x0 + pad) * S), int((y0 + h * 0.72 - 5.2) * S)), mk)
        d.text(((x0 + pad + 11) * S, (y0 + h * 0.72) * S), "HD2Lab",
               font=font(7 * S, "SemiBold"), fill="#e0703c")
        d.text(((x0 + pad) * S, (y0 + h * 0.83) * S), "SONY ILCE-7M4 · 35mm",
               font=mono(5 * S), fill="#f0e9d9")
        d.text(((x1 - pad) * S, (y0 + h * 0.78) * S), "100", font=mono(9 * S), fill="#f0e9d9", anchor="rs")
        d.text(((x1 - pad) * S, (y0 + h * 0.88) * S), "ISO", font=mono(4 * S), fill="#e0703c", anchor="rs")


def build_og(out_dir: str) -> str:
    W, H = 1200 * S, 630 * S
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # 1) grid + container card
    for x in range(0, W + 1, 40 * S):
        d.line([(x, 0), (x, H)], fill=GRID)
    for y in range(0, H + 1, 40 * S):
        d.line([(0, y), (W, y)], fill=GRID)
    rrect(d, sc(56, 30, 1144, 600), 26 * S, fill=CARD, outline=CARD_BORDER, width=1.4 * S)

    # 2) eyebrow + privacy mark
    r = 5 * S
    d.ellipse((104 * S - r, 90 * S - r, 104 * S + r, 90 * S + r), fill=ACCENT)
    spaced(d, (124 * S, 96 * S), "03 / CRAFT · SHUTTERPLATE",
           font(14 * S, "Medium"), MUTED, spacing=2.2 * S)
    d.text((1096 * S, 96 * S), "LOCAL ONLY · 0 B UPLOAD", font=mono(13 * S), fill=DIM, anchor="rs")

    # 3) dual-skew mark + HD2Lab | Shutterplate (PKPilot0001/0002 규격: 100px 각진 마크)
    badge = logo_badge(104 * S)
    img.paste(badge, (82 * S, 118 * S), badge)

    base_y = 194
    f_title = font(62 * S, "SemiBold")
    d.text((224 * S, base_y * S), "HD2Lab", font=f_title, fill=TEXT_HI, anchor="ls")
    pipe_x = 224 * S + d.textlength("HD2Lab", font=f_title) + 18 * S
    d.line([(pipe_x, (base_y - 40) * S), (pipe_x, (base_y + 2) * S)],
           fill="#3a403a", width=int(2.5 * S))
    fx = pipe_x + 20 * S
    d.text((fx, base_y * S), "Shutterplate", font=f_title, fill=ACCENT, anchor="ls")

    # 4) headline + sub copy
    f_head = font(48 * S, "Bold")
    d.text((104 * S, 262 * S), "사진 한 장을,", font=f_head, fill=TEXT_HI, anchor="ls")
    d.text((104 * S, 320 * S), "한 장의 ", font=f_head, fill=TEXT_HI, anchor="ls")
    w = d.textlength("한 장의 ", font=f_head)
    d.text((104 * S + w, 320 * S), "플레이트", font=f_head, fill=ACCENT, anchor="ls")
    d.text((104 * S + w + d.textlength("플레이트", font=f_head), 320 * S), "로.",
           font=f_head, fill=TEXT_HI, anchor="ls")

    d.text((105 * S, 358 * S),
           "EXIF를 읽어 노출 스펙·서명을 얹고, 원본 1:1 해상도 그대로 사진 앨범에 저장합니다.",
           font=font(17.5 * S), fill=MUTED)
    d.text((105 * S, 386 * S),
           "8종 시그니처 프레임 · 메이커 엠블럼 11종 · 아이폰은 공유 시트로 바로 사진 저장 · 100% 로컬 처리",
           font=font(17.5 * S), fill=MUTED)

    # 5) frame render strip — three shipped signatures
    tile_w, gap, th = 264, 16, 126
    xs = [96, 96 + tile_w + gap, 96 + 2 * (tile_w + gap)]
    for x, kind in zip(xs, ("horizon", "studio", "film")):
        plate_card(img, (x, 414, x + tile_w, 414 + th), kind)
        label = {"horizon": "CLEAN HORIZON", "studio": "STUDIO DARK", "film": "FILM SPROCKET"}[kind]
        d.text((x * S, (414 + th + 14) * S), label, font=mono(8 * S), fill=DIM)

    # 6) footer
    d.line([(104 * S, 566 * S), (1096 * S, 566 * S)], fill=LINE, width=int(1 * S))
    spaced(d, (104 * S, 588 * S), "EXIF FRAME STUDIO · BUILT IN THE BROWSER",
           font(11.5 * S, "Medium"), MUTED, spacing=1.5 * S)
    d.text((1096 * S, 588 * S), "hyangdan2.github.io/PKPilot0003", font=mono(11.5 * S),
           fill="#9aa39a", anchor="rs")

    out = img.resize((1200, 630), Image.LANCZOS)
    path = os.path.join(out_dir, "og-image.png")
    out.save(path, "PNG", optimize=True)
    out.save(os.path.join(out_dir, "social-preview.png"), "PNG", optimize=True)
    return path


def main() -> int:
    import argparse
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
