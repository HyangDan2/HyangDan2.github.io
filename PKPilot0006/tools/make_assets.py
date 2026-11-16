#!/usr/bin/env python3
"""PKPilot0006 DOS Player — favicon / PWA icon / OG card generator.

Mark geometry is the HD2Lab dual-skew glyph used across PKPilot0002~0005:
    M15 20L35 10V43L15 53ZM29 24L49 14V47L29 57Z   (viewBox 0 0 64 64)
The OG card follows the PKPilot0005 1200×630 spec: dark grid ground, rounded
card, top eyebrow row, 62px "HD2Lab | <service>" lockup with the mark at the
left, headline, sub line, chips, footer rule.
"""
from __future__ import annotations

import io
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent
MARK_PATH = "M15 20L35 10V43L15 53ZM29 24L49 14V47L29 57Z"

BG = (16, 17, 16)          # #101110
CARD = (20, 22, 20)
CARD_BORDER = (52, 54, 48)
GRID = (26, 28, 26)
ACCENT = (255, 130, 79)
ACCENT_2 = (255, 167, 127)
TEXT = (243, 242, 236)
BODY = (198, 194, 187)
MUTED = (164, 167, 158)
DIM = (127, 131, 120)

F_LAT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
F_LAT_R = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
F_MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"
F_KR = "/usr/share/fonts/pickle-hwp/NotoSansCJKkr-Regular.otf"
F_KR_BOLD = "/usr/share/fonts/pickle-hwp/NotoSansCJKkr-Bold.otf"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.truetype(F_KR, size)


def mark_svg(stroke: float = 4.0, color: str = "#ff824f", size: int = 64) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" '
            f'height="{size}"><path d="{MARK_PATH}" fill="none" stroke="{color}" '
            f'stroke-width="{stroke}"/></svg>')


def raster(svg: str, width: int) -> Image.Image:
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=width)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def app_icon(size: int) -> Image.Image:
    scale = size / 64
    bg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}">' \
         f'<rect width="64" height="64" rx="12" fill="#101110"/>' \
         f'<path d="{MARK_PATH}" fill="none" stroke="#ff824f" stroke-width="{4}" /></svg>'
    icon = raster(bg, size)
    return icon


def spaced(draw, xy, text, fnt, fill, spacing=0.0):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + spacing
    return x


def spaced_len(draw, text, fnt, spacing=0.0):
    return sum(draw.textlength(c, font=fnt) for c in text) + spacing * max(0, len(text) - 1)


def og_card() -> Image.Image:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), (12, 13, 12))
    d = ImageDraw.Draw(img)

    for x in range(0, W + 1, 40):
        d.line([(x, 0), (x, H)], fill=GRID)
    for y in range(0, H + 1, 40):
        d.line([(0, y), (W, y)], fill=GRID)

    # soft warm vignette in the top-right corner (no hard edges)
    import numpy as np
    arr = np.asarray(img).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.sqrt((xx - (W + 40)) ** 2 + (yy + 260) ** 2) / 780.0
    falloff = np.clip(1.0 - r, 0.0, 1.0) ** 2.2 * 0.55
    tint = np.array([255, 130, 79], dtype=np.float32)
    arr = arr * (1 - falloff[..., None]) + (arr * 0.55 + tint * 0.45) * falloff[..., None]
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)

    # card
    d.rounded_rectangle((56, 30, 1144, 600), radius=26, fill=CARD, outline=CARD_BORDER, width=2)

    # eyebrow
    d.ellipse((98, 84, 110, 96), fill=ACCENT)
    spaced(d, (124, 80), "06 / PLAYER · INSTANT-PLAY DOSBOX (WEBASSEMBLY)", font(F_LAT_R, 14), MUTED, 2.0)
    d.text((1096, 82), "hyangdan2.github.io/PKPilot0006", font=font(F_MONO, 13), fill=DIM, anchor="rs")

    # lockup: [mark] HD2Lab | DOS Player
    badge = raster(mark_svg(4.0, "#ff824f", 64), 108)
    img.paste(badge, (86, 130), badge)
    f_lock = font(F_LAT, 62)
    d.text((216, 214), "HD2Lab", font=f_lock, fill=TEXT, anchor="ls")
    pipe_x = 216 + d.textlength("HD2Lab", font=f_lock) + 18
    d.line([(pipe_x, 174), (pipe_x, 216)], fill=(58, 64, 58), width=3)
    d.text((pipe_x + 20, 214), "DOS Player", font=f_lock, fill=ACCENT, anchor="ls")

    # headline (Noto Sans CJK KR ships regular only here — synthetic bold via stroke)
    f_h = font(F_KR_BOLD, 56)
    d.text((96, 296), "고전 DOS 게임을,", font=f_h, fill=TEXT, stroke_width=1.6, stroke_fill=TEXT)
    d.text((96, 366), "설치 없이 바로.", font=f_h, fill=ACCENT, stroke_width=1.6, stroke_fill=ACCENT)

    # sub
    f_sub = font(F_KR, 25)
    d.text((96, 456), "js-dos v8이 브라우저 안에서 DOSBox를 그대로 돌립니다.", font=f_sub, fill=BODY)

    # chips
    f_chip = font(F_KR, 19)
    x = 96
    for label, hot in (("Digger · DOOM · Dhrystone 2", False), ("내 .jsdos · .zip", False), ("전체화면 · 가상 패드", True)):
        w = d.textlength(label, font=f_chip) + 40
        d.rounded_rectangle((x, 502, x + w, 544), radius=21, fill=(26, 29, 26) if not hot else (28, 24, 20),
                            outline=(60, 62, 56) if not hot else (96, 62, 44), width=1)
        d.text((x + 20, 523), label, font=f_chip, fill=MUTED if not hot else ACCENT_2, anchor="lm")
        x += w + 12

    # footer rule
    d.line([(96, 572), (1104, 572)], fill=(44, 46, 42), width=2)
    spaced(d, (96, 582), "STAY CURIOUS · KEEP BUILDING · LIVE BETTER", font(F_LAT_R, 13), DIM, 2.0)
    d.text((1104, 584), "HD2Lab · PKPilot0006", font=font(F_MONO, 13), fill=DIM, anchor="rs")
    return img


def main():
    favicon_svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                   '<rect width="64" height="64" rx="12" fill="#101110"/>'
                   f'<path d="{MARK_PATH}" fill="none" stroke="#ff824f" stroke-width="4"/></svg>')
    (OUT / "favicon.svg").write_text(favicon_svg, encoding="utf-8")

    for size, name in ((32, "favicon-32x32.png"), (180, "apple-touch-icon.png"),
                       (192, "icon-192.png"), (512, "icon-512.png")):
        app_icon(size).save(OUT / name)

    ico = app_icon(256)
    ico.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    og_card().save(OUT / "og-image.png", optimize=True)
    print("wrote", sorted(p.name for p in OUT.iterdir() if p.suffix in {".png", ".svg", ".ico"}))


if __name__ == "__main__":
    main()
