#!/usr/bin/env python3
"""
PKPilot0001 · HD2Lab Brand Asset Generator
==========================================
AGPilot0002의 HD2Lab 브랜딩 시스템(#101110 다크 + #ff824f 오렌지 듀얼 스큐)을
1:1 계승한 파비콘 세트와 카카오톡/소셜 공유용 OG 이미지(1200x630)를 생성한다.

사용법:
    python3 tools/generate_brand_assets.py [--font /path/NotoSansKR.ttf]

산출물 (PKPilot0001/):
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

# ── 브랜드 토큰 (AGPilot0002 계승) ────────────────────────────────────────────
INK = "#101110"          # 라운드 스퀘어 배경 / 테마 컬러
ACCENT = "#ff824f"       # 시그니처 오렌지
BG = "#0c0d0c"           # OG 배경 차콜
GRID = "#161816"         # OG 격자
CARD = "#141614"         # OG 컨테이너
CARD_BORDER = "#242824"
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
    """자간(letter-spacing)을 적용해 글자 단위로 그린다. anchor: l | m | r (기준선 정렬)."""
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


def photo_tile(draw, box, base, glyph):
    """미니 프리뷰 썸네일: 라운드 사각 + 산/달 실루엣."""
    x0, y0, x1, y1 = box
    rrect(draw, box, sc(5)[0], fill=base, outline="#20261f", width=sc(1)[0])
    # 산 능선
    draw.polygon([(x0 + (x1 - x0) * 0.12, y1 - (y1 - y0) * 0.18),
                  (x0 + (x1 - x0) * 0.42, y0 + (y1 - y0) * 0.46),
                  (x0 + (x1 - x0) * 0.78, y1 - (y1 - y0) * 0.18)], fill=glyph)
    # 해
    r = (x1 - x0) * 0.075
    cx, cy = x0 + (x1 - x0) * 0.74, y0 + (y1 - y0) * 0.3
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=glyph)


def draw_camera_icon(draw, cx, cy, s, color):
    """칩 안의 카메라 아이콘."""
    w, h = s * 0.92, s * 0.68
    x0, y0 = cx - w / 2, cy - h / 2 + s * 0.05
    rrect(draw, (x0, y0, x0 + w, y0 + h), s * 0.16, outline=color, width=s * 0.11)
    # 상단 뷰파인더 돌기
    draw.line([(cx - s * 0.18, y0), (cx - s * 0.10, y0 - s * 0.13),
               (cx + s * 0.10, y0 - s * 0.13), (cx + s * 0.18, y0)],
              fill=color, width=int(s * 0.11), joint="curve")
    r = s * 0.17
    draw.ellipse((cx - r, cy + s * 0.03 - r, cx + r, cy + s * 0.03 + r),
                 outline=color, width=int(s * 0.1))


def draw_search_icon(draw, cx, cy, s, color):
    r = s * 0.30
    ox, oy = -s * 0.04, -s * 0.04
    draw.ellipse((cx + ox - r, cy + oy - r, cx + ox + r, cy + oy + r),
                 outline=color, width=int(s * 0.1))
    draw.line([(cx + ox + r * 0.72, cy + oy + r * 0.72),
               (cx + s * 0.32, cy + s * 0.32)],
              fill=color, width=int(s * 0.12))


def draw_lock_icon(draw, cx, cy, s, color):
    w, h = s * 0.78, s * 0.58
    x0, y0 = cx - w / 2, cy - h / 2 + s * 0.10
    rrect(draw, (x0, y0, x0 + w, y0 + h), s * 0.14, outline=color,
          width=int(s * 0.1))
    # 셔클
    r = w * 0.30
    draw.arc((cx - r, y0 - r * 1.55, cx + r, y0 + r * 0.55), 180, 360,
             fill=color, width=int(s * 0.1))
    dr = s * 0.075
    draw.ellipse((cx - dr, y0 + h / 2 - dr, cx + dr, y0 + h / 2 + dr), fill=color)


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
    card = sc(56, 36, 1144, 594)
    rrect(d, card, 26 * S, fill=CARD, outline=CARD_BORDER, width=1.4 * S)

    # 3) 아이브로우
    dx, dy = 104, 90
    r = 5 * S
    d.ellipse((dx * S - r, dy * S - r, dx * S + r, dy * S + r), fill=ACCENT)
    draw_spaced(d, (124 * S, 96 * S), "01 / MEDIA · IOS STYLE STATIC PHOTO LAB",
                font(14 * S, "Medium"), MUTED, spacing=2.2 * S)

    # 4) 브랜드 헤더: 마크 + HD2Lab | Photos
    mark_px = 100 * S
    mark = render_svg(MARK_SVG, mark_px)
    img.paste(mark, (84 * S, 126 * S), mark)

    base_y = 200
    f_title = font(64 * S, "SemiBold")
    d.text((224 * S, base_y * S), "HD2Lab", font=f_title, fill=TEXT_HI, anchor="ls")
    pipe_x = 224 * S + d.textlength("HD2Lab", font=f_title) + 18 * S
    d.line([(pipe_x, (base_y - 42) * S), (pipe_x, (base_y + 2) * S)],
           fill="#3a403a", width=int(2.5 * S))
    fx = pipe_x + 20 * S
    d.text((fx, base_y * S), "Photos", font=f_title, fill=ACCENT, anchor="ls")

    # 5) 서브카피
    draw_text(d, (105 * S, 250 * S),
              "iOS Photos style production-grade static web application · EXIF 뷰어 · 패스코드 인증",
              font(18 * S, "Regular"), MUTED)

    # 6) 중앙 비주얼: 카톡 크롭 안전영역(800x400) 안의 3단 미니 프리뷰 카드
    cards = [
        dict(kind="grid", title="보관함 그리드", caption="연 · 월 · 일 그리드 · 22장 라이브러리"),
        dict(kind="exif", title="EXIF 상세 뷰어", caption="조리개 · 셔터 · ISO · 장소"),
        dict(kind="lock", title="정회원 인증", caption="패스코드 · 암호화 비밀 앨범"),
    ]
    cw, ch, gap = 246, 200, 21
    left = 600 - (cw * 3 + gap * 2) / 2  # = 210 (안전영역 200~1000)
    top = 300

    for i, spec in enumerate(cards):
        x0 = left + i * (cw + gap)
        box = sc(x0, top, x0 + cw, top + ch)
        rrect(d, box, 16 * S, fill=TILE, outline=TILE_BORDER, width=1.2 * S)

        # 헤더: 아이콘 칩 + 타이틀
        chip = sc(x0 + 16, top + 14, x0 + 46, top + 44)
        rrect(d, chip, 9 * S, fill="#241a14")
        cxc, cyc = (x0 + 31) * S, (top + 29) * S
        if spec["kind"] == "grid":
            draw_camera_icon(d, cxc, cyc, 18 * S, ACCENT)
        elif spec["kind"] == "exif":
            draw_search_icon(d, cxc, cyc + 1 * S, 18 * S, ACCENT)
        else:
            draw_lock_icon(d, cxc, cyc + 1 * S, 18 * S, ACCENT)
        draw_text(d, ((x0 + 54) * S, (top + 37) * S), spec["title"],
                  font(17 * S, "SemiBold"), TEXT_HI)

        # 프리뷰 영역
        px0, px1 = (x0 + 16) * S, (x0 + cw - 16) * S
        if spec["kind"] == "grid":
            tw, th, g = 45, 38, 10
            tones = [("#1f261e", "#2e382c"), ("#252d23", "#344030"),
                     ("#1c211b", "#29322a"), ("#2d2319", "#403324")]
            for row in range(2):
                for col in range(4):
                    tx = (x0 + 16 + col * (tw + g)) * S
                    ty = (top + 60 + row * (th + 8)) * S
                    tone = tones[(row * 4 + col) % 4]
                    photo_tile(d, (tx, ty, tx + tw * S, ty + th * S), tone[0], tone[1])
        elif spec["kind"] == "exif":
            rows = [("APERTURE", "f/1.8"), ("SHUTTER", "1/250s"), ("ISO", "100")]
            for r_i, (label, value) in enumerate(rows):
                ry = (top + 58 + r_i * 34) * S
                rrect(d, (px0, ry, px1, ry + 28 * S), 8 * S, fill="#12150f",
                      outline="#1e241d", width=sc(1)[0])
                draw_text(d, (px0 + 12 * S, ry + 19 * S), label, mono(11 * S), DIM)
                draw_text(d, (px1 - 12 * S, ry + 19 * S), value, mono(12 * S),
                          TEXT, anchor="rs")
            draw_text(d, (px0 + 2 * S, (top + 174) * S), "창원 · 대한민국 · 2026.11",
                      font(12 * S), DIM)
        else:
            draw_lock_icon(d, ((x0 + cw / 2) * S), (top + 88) * S, 34 * S, ACCENT)
            pw = 122
            pbox = ((x0 + (cw - pw) / 2) * S, (top + 118) * S,
                    (x0 + (cw + pw) / 2) * S, (top + 146) * S)
            rrect(d, pbox, 8 * S, fill="#231913", outline="#3a2a1e", width=sc(1)[0])
            draw_spaced(d, ((x0 + cw / 2) * S, (top + 138) * S), "HD2-2026",
                        mono(13 * S), ACCENT, spacing=1.6 * S, anchor="m")

        # 카드 캡션
        if spec["kind"] != "exif":
            draw_text(d, ((x0 + 16) * S, (top + 177) * S), spec["caption"],
                      font(13 * S), DIM)

    # 7) 푸터
    fy = 560
    d.line([(104 * S, 522 * S), (1096 * S, 522 * S)], fill="#1f241f",
           width=sc(1)[0])
    draw_spaced(d, (104 * S, (fy + 6) * S), "STAY CURIOUS · KEEP BUILDING · LIVE BETTER",
                font(13 * S, "Medium"), MUTED, spacing=1.4 * S)
    draw_text(d, (1096 * S, (fy + 6) * S), "hyangdan2.github.io/PKPilot0001",
              mono(13 * S), "#9aa39a", anchor="rs")

    out = img.resize((1200, 630), Image.LANCZOS)
    og_path = os.path.join(out_dir, "og-image.png")
    out.save(og_path, "PNG", optimize=True)
    out.save(os.path.join(out_dir, "social-preview.png"), "PNG", optimize=True)
    return og_path


def main() -> int:
    global FONT_PATH
    ap = argparse.ArgumentParser(description="PKPilot0001 브랜드 에셋 생성")
    ap.add_argument("--font", help="Noto Sans KR(.ttf/.otf) 경로")
    ap.add_argument("--out", default=ROOT, help="출력 디렉터리 (기본: PKPilot0001)")
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
