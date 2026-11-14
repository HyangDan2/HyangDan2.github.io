# PKPilot0003 · Shutterplate — 배포본 실측 검증 (2026-11-14)

`https://hyangdan2.github.io/PKPilot0003/` 를 Playwright(Chromium)로 직접 열어 캡처한 실측본입니다.
모든 캡처 시점의 콘솔 에러는 0건입니다.

| 파일 | 뷰포트 | 내용 |
| --- | --- | --- |
| `live-desktop-01-initial.png` | 1280×800 | 초기 상태 — 드래그앤드롭 업로드존 + 샘플 버튼, 하단 8종 프레임 스트립(플레이스홀더 미리보기) |
| `live-desktop-02-uploaded.png` | 1280×800 | 사진 선택 후 — 업로드존이 한 줄 활성 세션 카드(썸네일·파일명·1536×1024·225 KB·EXIF 22 tags·변경/비우기)로 전환 |
| `live-desktop-03-panel-exif.png` | 1280×800 | `EXIF 편집` 제어 패널 오픈 — 우측 420px 플로팅 패널 + 백드롭 |
| `live-desktop-04-strip-scrolled.png` | 1280×800 | 하단 가로 슬라이더 스크롤 상태 |
| `live-frame-01..08-*.png` | 1280×800 | 8종 프레임 각각의 플레이트 렌더 (Clean Horizon · Classic Gallery · Dual Deck · Strap Bar · Film Sprocket · Studio Dark · Minimal Edge · Pro Studio) |
| `live-frames-contact-sheet.png` | — | 위 8종을 한 장으로 모은 대조 시트 |
| `live-mobile-01-initial.png` | 390×844 | 모바일 초기 상태 |
| `live-mobile-02-uploaded.png` | 390×844 | 모바일 사진 선택 후 컴팩트 상태 |
| `live-mobile-03-panel-geometry.png` | 390×844 | `프레임/여백` 바텀시트 (패딩·하단 밴드·라운딩·비율·스톡·서체) |
| `live-mobile-04-strip-scrolled.png` | 390×844 | 모바일 가로 프레임 슬라이더 스크롤 상태 |
| `live-og-image.png` | 1200×630 | 배포된 `og-image.png` 원본 |
| `live-og-thumbnail.png` | 680×400 | 공유 카드에 표시되는 비율(600×315)로 확인한 OG 썸네일 |

## 실측 수치

- 데스크톱 1280×800: 문서 스크롤 없음(`scrollHeight == innerHeight`), 가로 오버플로 0
- 모바일 390×844: `scrollWidth 390 / innerWidth 390`, `scrollHeight 844 / innerHeight 844`
- 320×568: `scrollWidth 320 / innerWidth 320` — 헤더 한 줄, 브랜드명 말줄임 없음, ⋮ 버튼 뷰포트 내부
- 입력 컨트롤 16px, 터치 타깃 44px 이상, 8종 프레임 캔버스 해시 전부 상이
- 자동화 테스트: `python3 tests/run_tests.py` → PASS 325 · FAIL 0 · SKIP 0
