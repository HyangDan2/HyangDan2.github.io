#!/usr/bin/env python3
"""
PKPilot0002 · HD2Lab Brand Asset Generator (Midpoint)
=====================================================
AGPilot0002에서 시작된 HD2Lab 브랜딩 시스템(#101110 다크 + #ff824f 오렌지 듀얼 스큐)을
PKPilot0001과 동일한 규격으로 계승해, Midpoint 앱의 파비콘 세트와
카카오톡/SNS 공유용 OG 이미지(1200x630)를 생성한다.

사용법:
    python3 tools/generate_brand_assets.py [--font /path/NotoSansKR.ttf] [--out DIR]

산출물 (기본: PKPilot0002/):
    favicon.svg, favicon.ico(16/32/48), favicon-32x32.png,
    apple-touch-icon.png(180), icon-192.png, icon-512.png,
    og-image.png, social-preview.png (1200x630)
"""

from __future__ import annotations

import argparse
import io
import os
import sys

from PIL import Image, ImageDraw, ImageFont

try:
    import cairosvg
except ImportError:  # pragma: no cover
    cairosvg = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 브랜드 토큰 (HD2Lab 표준) ────────────────────────────────────────────────
INK = "#101110"          # 라운드 스퀘어 배경 / 테마 컬러
ACCENT = "#ff824f"       # 시그니처 오렌지
ACCENT_SOFT = "#2a1a12"  # 오렌지 계열 딤 배경
BG = "#0c0d0c"           # OG 배경 차콜
GRID = "#161816"         # OG 격자
CARD = "#141614"         # OG 컨테이너
CARD_BORDER = "#242824"
MAP_BG = "#101310"       # 미니 지도 배경
MAP_ROAD = "#1e241d"
MAP_ROAD_HI = "#28301f"
MAP_BLOCK = "#151914"
TILE = "#0f110f"
TILE_BORDER = "#242824"
TEXT_HI = "#e8ece7"
TEXT = "#cfd6cd"
MUTED = "#8d968c"
DIM = "#6f7a6f"

FAVICON_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    '<rect width="64" height="64" rx="12" fill="#101110"/>'
    '<path d="M15 20L35 10V43L15 53ZM29 24L49 14V47L29 57Z" fill="none" '
    'stroke="#ff824f" stroke-width="4"/></svg>'
)

# 카드/OG 위에 얹는 마크는 배경 판 없이 오렌지 스큐만 사용한다.
MARK_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    '<path d="M15 20L35 10V43L15 53ZM29 24L49 14V47L29 57Z" fill="none" '
    'stroke="#ff824f" stroke-width="4"/></svg>'
)

FONT_CANDIDATES = [
    os.environ.get("PICKLE_BRAND_FONT", ""),
    os.path.join(ROOT, "..", "..", "tmp-fonts", "NotoSansKR-VF.ttf"),
    "/usr/share/fonts/truetype/noto/NotoSansKR-VF.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansKR-Regular.otf",
    "/usr/share/fonts/pickle-hwp/NotoSansCJKkr-Regular.otf",
]

MONO_CANDIDATES = [
    "/usr/share/fonts/pickle-hwp/NotoSansMonoCJKkr-Regular.otf",
    "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
]

_font_cache: dict[tuple[str, int, str], ImageFont.FreeTypeFont] = {}


def _resolve(candidates: list[str]) -> str | None:
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return None


FONT_PATH = _resolve(FONT_CANDIDATES)
MONO_PATH = _resolve(MONO_CANDIDATES)


def font(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    """Noto Sans KR 가변 폰트에서 웨이트를 골라 캐시한다."""
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


# ── 텍스트 유틸 ───────────────────────────────────────────────────────────────
def text_width(draw, text: str, f, spacing: float = 0) -> float:
    if not text:
        return 0.0
    w = sum(draw.textlength(ch, font=f) for ch in text)
    return w + spacing * (len(text) - 1)


def draw_spaced(draw, xy, text, f, fill, spacing=0.0, anchor="l"):
    """자간(letter-spacing)을 적용해 글자 단위로 그린다. anchor: l | m | r."""
    total = text_width(draw, text, f, spacing)
    x = xy[0]
    if anchor == "m":
        x -= total / 2
    elif anchor == "r":
        x -= total
    y = xy[1]
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill, anchor="ls")
        x += draw.textlength(ch, font=f) + spacing
    return total


def draw_text(draw, xy, text, f, fill, anchor="ls"):
    draw.text(xy, text, font=f, fill=fill, anchor=anchor)


# ── 벡터(로고 마크) ──────────────────────────────────────────────────────────
def render_svg(svg: str, px: int) -> Image.Image:
    """SVG 문자열을 투명 배경 PNG로 래스터화한다."""
    if cairosvg is None:
        raise SystemExit("cairosvg 가 필요합니다: pip install cairosvg")
    buf = io.BytesIO()
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=buf,
                     output_width=px, output_height=px)
    buf.seek(0)
    return Image.open(buf).convert("RGBA")


# ── 파비콘 세트 ──────────────────────────────────────────────────────────────
def build_favicons(out_dir: str) -> list[tuple[str, tuple[int, int]]]:
    svg_path = os.path.join(out_dir, "favicon.svg")
    with open(svg_path, "w", encoding="utf-8") as fh:
        fh.write(FAVICON_SVG + "\n")

    master = render_svg(FAVICON_SVG, 1024)
    made: list[tuple[str, tuple[int, int]]] = [("favicon.svg", (64, 64))]

    for name, size in [
        ("favicon-32x32.png", 32),
        ("apple-touch-icon.png", 180),
        ("icon-192.png", 192),
        ("icon-512.png", 512),
    ]:
        img = master.resize((size, size), Image.LANCZOS)
        img.save(os.path.join(out_dir, name), "PNG", optimize=True)
        made.append((name, (size, size)))

    # 멀티사이즈 ICO (16 / 32 / 48)
    ico_base = master.resize((256, 256), Image.LANCZOS)
    ico_path = os.path.join(out_dir, "favicon.ico")
    ico_base.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    made.append(("favicon.ico", (48, 48)))

    return made


# ── OG 이미지 ────────────────────────────────────────────────────────────────
S = 2  # 슈퍼샘플링 배율 (2400x1260 로 그린 뒤 1200x630 으로 축소)


def sc(*vals):
    return tuple(int(round(v * S)) for v in vals)


def rrect(draw, box, r, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline,
                           width=max(1, int(width)))


def dash_line(draw, p0, p1, fill, width, dash=9, gap=7):
    """점선 — 약속 코스/이동 경로를 나타낸다."""
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    length = (dx * dx + dy * dy) ** 0.5
    if length == 0:
        return
    ux, uy = dx / length, dy / length
    step, pos = dash + gap, 0.0
    while pos < length:
        end = min(pos + dash, length)
        draw.line([(x0 + ux * pos, y0 + uy * pos), (x0 + ux * end, y0 + uy * end)],
                  fill=fill, width=max(1, int(width)))
        pos += step


def pin(draw, cx, cy, r, ring, fill, core):
    """지도 핀 — 링 + 코어 점."""
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=ring, width=int(2.4 * S))
    draw.ellipse((cx - r * 0.42, cy - r * 0.42, cx + r * 0.42, cy + r * 0.42), fill=core)


def build_og(out_dir: str) -> str:
    W, H = 1200 * S, 630 * S
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # 1) 미세 격자 그리드
    step = 40 * S
    for x in range(0, W + 1, step):
        d.line([(x, 0), (x, H)], fill=GRID, width=1)
    for y in range(0, H + 1, step):
        d.line([(0, y), (W, y)], fill=GRID, width=1)

    # 2) 컨테이너 카드
    rrect(d, sc(56, 36, 1144, 594), 26 * S, fill=CARD, outline=CARD_BORDER,
          width=1.4 * S)

    # 3) 아이브로우 + 우측 좌표
    r = 5 * S
    d.ellipse((104 * S - r, 90 * S - r, 104 * S + r, 90 * S + r), fill=ACCENT)
    draw_spaced(d, (124 * S, 96 * S), "02 / GEO · FAIR MEETING POINT ENGINE",
                font(14 * S, "Medium"), MUTED, spacing=2.2 * S)
    draw_text(d, (1096 * S, 96 * S), "37.5665N · 126.9780E", mono(13 * S),
              DIM, anchor="rs")

    # 4) 브랜드 헤더: 마크 + HD2Lab | Midpoint
    mark_px = 100 * S
    mark = render_svg(MARK_SVG, mark_px)
    img.paste(mark, (84 * S, 120 * S), mark)

    base_y = 194
    f_title = font(62 * S, "SemiBold")
    d.text((224 * S, base_y * S), "HD2Lab", font=f_title, fill=TEXT_HI, anchor="ls")
    pipe_x = 224 * S + d.textlength("HD2Lab", font=f_title) + 18 * S
    d.line([(pipe_x, (base_y - 40) * S), (pipe_x, (base_y + 2) * S)],
           fill="#3a403a", width=int(2.5 * S))
    fx = pipe_x + 20 * S
    d.text((fx, base_y * S), "Midpoint", font=f_title, fill=ACCENT, anchor="ls")

    # 5) 헤드라인 + 서브카피
    f_head = font(48 * S, "Bold")
    head_pre, head_hi = "여럿이 만날 때, 딱 ", "가운데"
    d.text((104 * S, 268 * S), head_pre, font=f_head, fill=TEXT_HI, anchor="ls")
    pre_w = d.textlength(head_pre, font=f_head)
    d.text(((104 * S) + pre_w, 268 * S), head_hi, font=f_head, fill=ACCENT,
           anchor="ls")

    draw_text(d, (105 * S, 320 * S),
              "전국 대중교통·자차, 어디서 출발해도 공평한 중간 지점 · 그 주변 맛집·카페로 1차+2차 약속 코스",
              font(17.5 * S, "Regular"), MUTED)

    # 6) 미니 지도 스트립 (좌) + 지표 타일 3개 (우)
    strip = (84, 366, 716, 512)
    rrect(d, sc(*strip), 16 * S, fill=MAP_BG, outline=TILE_BORDER, width=1.2 * S)

    # 지도 격자·블록·도로
    inner = (strip[0] + 1, strip[1] + 1, strip[2] - 1, strip[3] - 1)
    mstep = 26
    for x in range(inner[0] + 6, inner[2], mstep):
        d.line([(x * S, inner[1] * S), (x * S, inner[3] * S)], fill="#151915", width=1)
    for y in range(inner[1] + 6, inner[3], mstep):
        d.line([(inner[0] * S, y * S), (inner[2] * S, y * S)], fill="#151915", width=1)
    for bx, by, bw, bh in [(110, 384, 54, 34), (180, 396, 40, 26),
                           (300, 380, 66, 30), (380, 452, 58, 28),
                           (560, 392, 74, 40), (612, 462, 60, 26)]:
        rrect(d, sc(bx, by, bx + bw, by + bh), 5 * S, fill=MAP_BLOCK)
    # 주요 도로
    d.line([(104 * S, 452 * S), (700 * S, 408 * S)], fill=MAP_ROAD_HI,
           width=int(5 * S))
    d.line([(250 * S, 372 * S), (286 * S, 508 * S)], fill=MAP_ROAD,
           width=int(3.4 * S))
    d.line([(470 * S, 372 * S), (452 * S, 508 * S)], fill=MAP_ROAD,
           width=int(3.4 * S))
    d.line([(104 * S, 402 * S), (700 * S, 470 * S)], fill=MAP_ROAD,
           width=int(2.4 * S))

    center = (470, 436)
    starts = [(196, 404), (262, 484), (352, 388)]
    for sx, sy in starts:
        dash_line(d, (sx * S, sy * S), (center[0] * S, center[1] * S),
                  "#5a4638", 1.9 * S, dash=7 * S, gap=6 * S)
        pin(d, sx * S, sy * S, 8 * S, "#8d968c", "#0c0d0c", TEXT)

    # 중앙 공평 지점 — 펄스 링 + 오렌지 핀
    d.ellipse(((center[0] - 27) * S, (center[1] - 27) * S,
               (center[0] + 27) * S, (center[1] + 27) * S),
              outline="#4a2c1d", width=int(1.6 * S))
    d.ellipse(((center[0] - 17) * S, (center[1] - 17) * S,
               (center[0] + 17) * S, (center[1] + 17) * S),
              fill=ACCENT_SOFT, outline=ACCENT, width=int(2.6 * S))
    cr = 6 * S
    d.ellipse((center[0] * S - cr, center[1] * S - cr,
               center[0] * S + cr, center[1] * S + cr), fill=ACCENT)

    # MIDPOINT 라벨 칩
    label = "MIDPOINT"
    lf = mono(10 * S)
    lw = d.textlength(label, font=lf)
    lbox = ((center[0] - lw / 2 - 10) * S, (center[1] - 52) * S,
            (center[0] + lw / 2 + 10) * S, (center[1] - 32) * S)
    rrect(d, lbox, 5 * S, fill="#221912", outline="#4a2c1d", width=1 * S)
    draw_text(d, (center[0] * S, (center[1] - 38) * S), label, lf, ACCENT, anchor="ms")

    # 거리 칩
    for tx, ty, text in [(238, 398, "21.4km"), (300, 478, "34.1km"), (388, 430, "18.6km")]:
        wpx = d.textlength(text, font=mono(9.5 * S))
        rrect(d, ((tx - 5) * S, (ty - 12) * S, (tx + wpx + 5) * S, (ty + 1) * S),
              4 * S, fill="#0e110e", outline="#232a21", width=1 * S)
        draw_text(d, (tx * S, (ty - 3) * S), text, mono(9.5 * S), DIM)

    draw_text(d, ((strip[0] + 12) * S, (strip[1] + 17) * S),
              "NAVER MAPS · 공평 중간 지점", mono(9.5 * S), DIM)
    draw_text(d, ((strip[2] - 12) * S, (strip[3] - 10) * S),
              "TRANSIT + CAR", mono(9 * S), "#4d554d", anchor="rs")

    # 지표 타일
    tiles = [
        ("1,756", "전국 거점", "전철·KTX·터미널·IC"),
        ("1,435", "맛집·카페", "30개 거점 반경 800m"),
        ("1차+2차", "약속 코스", "도보 2~5분 페어링"),
    ]
    tx0, ty0, tw, th, gap = 732, 366, 120, 146, 12
    for i, (value, label_, note) in enumerate(tiles):
        x0 = tx0 + i * (tw + gap)
        rrect(d, sc(x0, ty0, x0 + tw, ty0 + th), 14 * S, fill=TILE,
              outline=TILE_BORDER, width=1.2 * S)
        vf = font(21 * S if len(value) > 5 else 26 * S, "SemiBold")
        d.text(((x0 + 14) * S, (ty0 + 62) * S), value, font=vf, fill=TEXT_HI,
               anchor="ls")
        d.text(((x0 + 14) * S, (ty0 + 86) * S), label_, font=font(12.5 * S, "Medium"),
               fill=ACCENT, anchor="ls")
        # 두 줄 설명
        words = note.split(" ")
        line = ""
        ly = ty0 + 108
        for wd in words:
            trial = (line + " " + wd).strip()
            if d.textlength(trial, font=font(10 * S)) > tw - 24 and line:
                d.text(((x0 + 14) * S, ly * S), line, font=font(10 * S), fill=DIM,
                       anchor="ls")
                ly += 14
                line = wd
            else:
                line = trial
        if line:
            d.text(((x0 + 14) * S, ly * S), line, font=font(10 * S), fill=DIM,
                   anchor="ls")

    # 7) 푸터
    d.line([(104 * S, 548 * S), (1096 * S, 548 * S)], fill="#1f241f",
           width=int(1 * S))
    draw_spaced(d, (104 * S, 574 * S), "STAY CURIOUS · KEEP BUILDING · LIVE BETTER",
                font(12.5 * S, "Medium"), MUTED, spacing=1.4 * S)
    draw_text(d, (1096 * S, 574 * S), "hyangdan2.github.io/PKPilot0002",
              mono(12.5 * S), "#9aa39a", anchor="rs")

    out = img.resize((1200, 630), Image.LANCZOS)
    og_path = os.path.join(out_dir, "og-image.png")
    out.save(og_path, "PNG", optimize=True)
    out.save(os.path.join(out_dir, "social-preview.png"), "PNG", optimize=True)
    return og_path


def main() -> int:
    global FONT_PATH
    ap = argparse.ArgumentParser(description="PKPilot0002 (Midpoint) 브랜드 에셋 생성")
    ap.add_argument("--font", help="Noto Sans KR(.ttf/.otf) 경로")
    ap.add_argument("--out", default=ROOT, help="출력 디렉터리 (기본: PKPilot0002)")
    args = ap.parse_args()
    if args.font:
        FONT_PATH = args.font

    icons = build_favicons(args.out)
    og = build_og(args.out)

    print("파비콘 세트")
    for name, size in icons:
        path = os.path.join(args.out, name)
        print(f"  {name:22s} {size[0]}x{size[1]:<4d} {os.path.getsize(path):>7,d} B")
    print(f"OG 이미지\n  {os.path.basename(og):22s} 1200x630 "
          f"{os.path.getsize(og):>7,d} B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
