# PKPilot0003 · Shutterplate — 배포본 실측 검증 (2026-11-14)

`https://hyangdan2.github.io/PKPilot0003/` 를 Playwright(Chromium)로 직접 열어 캡처한 실측본입니다.
모든 캡처 시점의 콘솔 에러는 0건입니다.

## 8종 프레임 글자 잘림·겹침 수정 검증 (배포 754ee67)

`live-fit-` 접두사 파일은 **배포본 페이지의 `SPPlate.paint()`를 1:1 해상도로 직접 호출**해 받은
플레이트 원본입니다(내보내기와 같은 루틴). 화면 축소 캡처가 아니라 실제 출력 픽셀입니다.

| 파일 | 플레이트 | 내용 |
| --- | --- | --- |
| `live-fit-portrait-01..08-*.jpg` | 1024×1536 세로 샘플 + 아이폰 긴 EXIF | 8종 각각 — `24mm (24mm) · ƒ/1.78 · 1/1200s · ISO 400` 전부 온전, `…` 0건 |
| `live-fit-wide-studio.jpg` · `-strap` · `-film` · `-pro` · `-edge` | 1024×1536 | Hasselblad X2D 100C + HD2Lab 넓은 엠블럼 + 장문 렌즈명 — 좌우 열·엠블럼 비겹침 |
| `live-fit-pad0-film.jpg` | 1024×1833 | 보더 패딩 0% Film Sprocket — 퍼포레이션 유지, 날짜 줄 분리(이전엔 탭이 멈춤) |
| `live-desktop-05-portrait-iphone-longexif.png` | 1280×800 | 위 세로 플레이트의 실제 스튜디오 화면 |
| `live-desktop-06-pad0-film-geometry.png` | 1280×800 | `프레임/여백` 시트에서 패딩을 0%로 내린 상태 |

### 실측 수치 (배포본, 256장 매트릭스)

- 매트릭스: 규격 4종(`2:3` 1200×1800 · **`2:3` 1024×1536(번들 세로 샘플)** · `3:4` 1500×2000 · `3:2` 1536×1024)
  × 데이터 4종(아이폰 긴 EXIF · Hasselblad+HD2Lab · Apple 좁은 엠블럼 · EXIF 없음) × 8종 × 패딩 2종(기본·0%)
- 결과: `…` **0건** · 플레이트 밖 이탈 **0건** · 텍스트↔텍스트/엠블럼/퍼포레이션 겹침 **0건**
- Film Sprocket: 최하단 텍스트와 하단 퍼포레이션 상단 간격 **+9.0px** (수정 전 −2.0px)
- Film Sprocket 퍼포레이션: 패딩 0%에서도 구멍 97개 렌더 · 상단 여백 51px 확보 · 무한 루프 없음
- Studio Dark 세로(1024×1536): 우측 스펙 `ISO 400` 완전 표시(수정 전 `ISO 4…`)
- 자동화 테스트: `python3 tests/run_tests.py` → **PASS 353 · FAIL 0 · SKIP 0**

## 화면 · 프레임 (같은 배포본)

| 파일 | 뷰포트 | 내용 |
| --- | --- | --- |
| `live-desktop-01-initial.png` | 1280×800 | 초기 상태 — 드래그앤드롭 업로드존 + 샘플 버튼, 하단 8종 프레임 스트립 |
| `live-desktop-02-uploaded.png` | 1280×800 | 사진 선택 후 — 한 줄 활성 세션 카드 + 기본 프레임(Clean Horizon) |
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

## 레이아웃 수치

- 데스크톱 1280×800: 문서 스크롤 없음(`scrollHeight == innerHeight`), 가로 오버플로 0
- 모바일 390×844: `scrollWidth 390 / innerWidth 390`, `scrollHeight 844 / innerHeight 844`
- 320×568: `scrollWidth 320 / innerWidth 320` — 헤더 한 줄, 브랜드명 말줄임 없음, ⋮ 버튼 뷰포트 내부
- 입력 컨트롤 16px, 터치 타깃 44px 이상, 8종 프레임 캔버스 해시 전부 상이
