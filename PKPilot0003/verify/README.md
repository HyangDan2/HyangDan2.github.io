# PKPilot0003 · Shutterplate — 배포본 실측 검증 (2026-11-14)

`https://hyangdan2.github.io/PKPilot0003/` 를 Playwright(Chromium)로 직접 열어 캡처한 실측본입니다.
모든 캡처 시점의 콘솔 에러는 0건입니다.

## 랜딩 · 타이틀 홈 · ⋮ 메뉴 · 프레임 원복 (2026-11-14 네 번째 배포)

Film Studio식 랜딩과 타이틀→홈, 우상단 `⋮` 3섹션 메뉴를 얹은 빌드입니다. 같은 배포에서
**Film Sprocket(6 / 16%) · Pro Studio(8 / 25%)를 직전 계약으로 되돌리고**, Classic Gallery ·
Dual Deck · Studio Dark 세 프레임만 얇은 밴드를 유지합니다. 로컬 빌드 실측이며 콘솔 에러는 0건입니다.

| 파일 | 뷰포트 | 내용 |
| --- | --- | --- |
| `ui-landing-desktop.png` | 1440×900 | 랜딩 첫 화면 — 히어로 · 사진 열기/샘플 2단 카드 · 프레임 쇼케이스 |
| `ui-landing-editor-desktop.png` | 1440×900 | 샘플 카드로 편집기에 들어간 상태(세로 카페 · Clean Horizon) |
| `ui-landing-session-desktop.png` | 1440×900 | 타이틀 클릭으로 돌아온 랜딩 — Active Session(파일명·해상도·프레임) + `계속 편집하기` |
| `ui-landing-menu-desktop.png` | 1440×900 | `⋮` 메뉴 열림 — WORKSPACE · SAMPLES · NAVIGATION (EXIF 항목은 사진 없을 때 비활성) |
| `ui-landing-frames-desktop.png` | 1440×900 | 랜딩 하단 — 8장 프레임 카드 + 로컬/1:1/PWA 뱃지 |
| `ui-landing-mobile.png` · `ui-landing-mobile-frames.png` · `ui-landing-menu-mobile.png` | 390×844 | 폰 랜딩 첫 화면 · 8장 카드(2열) · `⋮` 메뉴 |
| `ui-frame-film-desktop.png` · `ui-frame-film-landscape.png` | 1440×900 | Film Sprocket 원복본 — 엠블럼 아래 메타 4줄 + 우하단 ISO/SEC/F 세로 스택 |
| `ui-frame-pro-desktop.png` · `ui-frame-pro-landscape.png` | 1440×900 | Pro Studio 원복본 — 넉넉한 밴드 + 스펙 2×2 격자 |
| `ui-frame-gallery-desktop.png` · `ui-frame-dual-desktop.png` · `ui-frame-studio-desktop.png` | 1440×900 | 밴드 다이어트를 유지한 세 프레임 |

### 라이브 배포 확인 (b534a98)

`https://hyangdan2.github.io/PKPilot0003/` 를 Playwright(Chromium)로 직접 열어 받은 실측본입니다.

| 파일 | 내용 |
| --- | --- |
| `ui-landing-live-desktop.png` | 라이브 첫 화면이 랜딩 — 히어로 · 2단 카드 · 8장 쇼케이스 |
| `ui-landing-live-session.png` | 타이틀 클릭으로 돌아온 라이브 랜딩 — `sample-02.jpg` 1024 × 1536 · Pro Studio 프레임 |
| `ui-landing-live-menu.png` | 라이브 `⋮` 메뉴 — WORKSPACE · SAMPLES · NAVIGATION |
| `ui-frame-film-live.png` · `ui-frame-pro-live.png` | 라이브 필름 스프로킷(메타 4줄 + 세로 스택) · 프로 스튜디오(2×2 격자) |

실측: 라이브 파일 SHA-256 = 저장소 파일 — `index.html` · `style.css` · `app.js` · `js/plate.js` 모두 일치(HTTP 200),
콘솔 에러 0건. 라이브 `SPPlate.STYLES` geo — film `6 / 16 / 0.3`, pro `8 / 25 / 0`,
gallery `4.5 / 13 / 0.6`, dual `3.8 / 13.5 / 0.25`, studio `3.8 / 11.5 / 1.2`.
세로 사진에서 측정한 실제 밴드(사진 높이 대비) — Gallery 13% · Dual 13.5% · Film 16% · Studio 11.5% · Pro 25%.


## 카카오톡 인앱 저장 대응 (2026-11-14 세 번째 배포)

안드로이드 카카오톡 인앱 브라우저에서 저장 단계가 **"지원하지 않는 파일 형식"** 으로 막힌 보고에 대한 수정본입니다.
`inapp-` 접두사 파일은 **카카오톡 안드로이드 WebView UA**
(`…; wv) … Chrome/119.0.6045.193 Mobile Safari/537.36 KAKAOTALK 10.3.0 (inapp)`)로 모바일 뷰포트를 열어
찍은 화면입니다(로컬 브랜치 빌드).

| 파일 | 뷰포트 | 내용 |
| --- | --- | --- |
| `inapp-390-landing.png` | 390×844 | 랜딩의 인앱 안내 한 줄 + `주소 복사` 버튼 — 무스크롤 유지 |
| `inapp-390-copy-toast.png` | 390×844 | 주소 복사 후 "주소를 복사했어요 — 브라우저에 붙여넣어 열어 주세요" |
| `inapp-390-export-card.png` | 390×844 | 결과 카드 — 미리보기 `img` src가 `data:image/jpeg;base64,…`(길게 눌러 저장 경로), 공유 시트 버튼 숨김 |
| `inapp-390-export-sheet.png` | 390×844 | 내보내기 시트의 인앱 안내 문구 |
| `inapp-390-preview.png` | 390×844 | 전체 화면 미리보기도 data URL — 길게 눌러 저장 |
| `inapp-320-landing.png` | 320×568 | 최소 폭에서도 안내·복사 버튼이 한 화면에 들어감 |
| `inapp-320-export-card.png` | 320×568 | 좁은 화면 결과 카드 — 카드 내부 스크롤 0 |
| `inapp-desktop-normal.png` | 1280×800 | 일반 크롬 — 안내 엘리먼트 `display:none`(높이 0) |

실측값: 결과 카드 미리보기 `data:image/jpeg;base64` 575,059자 · blob URL(`blob:`)도 함께 준비 ·
문서 스크롤 844=844(390) / 568=568(320) · 카드 내부 스크롤 546=546(390) · 501=501(320).

### 라이브 배포 확인 (7a72c21)

`https://hyangdan2.github.io/PKPilot0003/` 를 같은 카카오톡 UA로 직접 열어 받은 실측본입니다(콘솔 에러 0건).

| 파일 | 내용 |
| --- | --- |
| `inapp-live-390-landing.png` · `inapp-live-390-copy-toast.png` | 라이브 랜딩의 안내 + 주소 복사 토스트 |
| `inapp-live-390-export-sheet.png` · `inapp-live-390-export-card.png` · `inapp-live-390-preview.png` | 라이브 내보내기 시트 → 결과 카드(미리보기 `data:image/jpeg;base64`) → 전체 화면 미리보기 |
| `inapp-live-320-landing.png` · `inapp-live-320-export-card.png` | 최소 폭 320×568 |
| `inapp-live-desktop-normal.png` | 일반 크롬 — 안내 미표시(문서 구조도 기존과 동일) |

- 라이브 파일 SHA-256 = 저장소 파일: `app.js` `44ad7704…`, `style.css` `787e23ec…`, `index.html` `3522bd8d…`
- 라이브 결과 카드: `#exportImg` src `data:image/jpeg;base64,…`(575,059자) · `p.url` `blob:https:` 병행 · 공유 버튼 숨김 · 문서 스크롤 844=844 · 카드 내부 스크롤 546=546

## 공식 브랜드 엠블럼 11종 · 사진으로 저장 (2026-11-14 두 번째 배포)

`emblem-` 접두사 파일은 **페이지의 `SPApp.prepareExport()`를 그대로 호출해 받은 1:1 출력물**입니다
(내보내기와 같은 루틴, 같은 해상도). 화면 축소 캡처가 아닙니다.

| 파일 | 내용 |
| --- | --- |
| `emblem-<브랜드>-gallery.jpg` | 11종(Sony·Canon·Nikon·Fujifilm·Samsung·Leica·Hasselblad·Apple·Lumix·OM System·HD2Lab)을 Classic Gallery 중앙에 각각 적용한 1:1 플레이트 |
| `emblem-frame-<프레임>.jpg` | Samsung 엠블럼으로 8종 프레임 전부 (Clean Horizon·Classic Gallery·Dual Deck·Strap Bar·Film Sprocket·Studio Dark·Minimal Edge·Pro Studio) |
| `emblem-hasselblad-strap/pro/film/studio.jpg` | 가장 넓은 마크(12.8:1)를 폭 제한이 걸리는 프레임에 넣은 경우 — 높이를 줄여 원본 비율 유지 |
| `emblem-mobile-hasselblad-strap.jpg` | 390px 모바일 규격(1536 폭 출력) Strap Bar |
| `ui-emblem-picker-desktop.png` · `ui-emblem-picker-mobile.png` | 13타일(자동·11종·없음) 엠블럼 선택 시트 |
| `ui-export-sheet-*.png` · `ui-export-card-*.png` · `ui-preview-*.png` | 내보내기 시트 → 결과 카드 → 전체 화면 미리보기(길게 눌러 저장) |

엠블럼 원본 출처·라이선스는 [`../EMBLEM-SOURCES.md`](../EMBLEM-SOURCES.md).
iOS 공유 시트 자체는 실기기에서만 확인할 수 있어, 이 배포에서는 `navigator.canShare` 분기와
폴백·취소 처리를 코드와 스텁 주입 테스트로 검증했습니다(자동화 테스트 목록 참고).

### 라이브 배포 확인 (c0fa20a · 1cb634d)

`https://hyangdan2.github.io/PKPilot0003/` 를 직접 열어 받은 실측본입니다(콘솔 에러 0건).

| 파일 | 내용 |
| --- | --- |
| `live-emblem-<브랜드>-gallery.jpg` | 라이브 페이지에서 `SPApp.prepareExport()`로 받은 11종 1:1 출력물 (1752×1414) |
| `live-ui-emblem-picker-mobile.png` | 라이브 엠블럼 시트 — Leica 원판에 필기체가 뚫려 렌더됨 |
| `live-ui-export-card-mobile.png` | 라이브 결과 카드 — 파일명·용량·포맷과 큰 미리보기 |
| `live-og-image.png` | `og-image.png?v=20261114-2` 실물 (저장소 파일과 SHA-256 일치) |

## Film Sprocket 레일 대칭 · Strap Bar 슬림 밴드 (배포 7a61782)

`fix-` 접두사 파일은 배포본 페이지의 `SPPlate.paint()`를 직접 호출해 받은 플레이트 원본입니다
(내보내기와 같은 루틴, 긴 변 1600px). `fix-film-sprocket-01-portrait.png` · `fix-strap-bar-phone.png`는
390×844 모바일 화면 캡처입니다. 모두 **로컬 캡처와 라이브 캡처가 바이트 단위로 동일**합니다.

| 파일 | 플레이트 | 내용 |
| --- | --- | --- |
| `fix-film-sprocket-02-landscape.png` | 1600×1357 (가로 1:1) | 상·하단 레일 거울 대칭 — 가장자리↔구멍 20.5px = 구멍↔실선 20.5px (위·아래) |
| `fix-film-sprocket-03-pad0.png` | 894×1600 | 보더 패딩 0% — 레일 26.5px 유지, 실선↔뱃지 8px · 뱃지↔사진 6px, 날짜 줄이 실선 위 |
| `fix-film-sprocket-01-portrait.png` | 1170×2532 (390×844 @3x) | 모바일 화면의 Film Sprocket — 상하 여백·뱃지 위치 |
| `fix-strap-bar.png` | 1600×1195 (가로 1:1) | 스트랩 바 123px(사진 높이 12%) — 사진↔첫 줄 27px, 스티치가 바닥을 닫음 |
| `fix-strap-bar-portrait.png` | 953×1600 | 세로 판 — 바 184px, `HD2LAB · STRAP 04`가 스티치 위 우측 |
| `fix-strap-bar-phone.png` | 1170×2532 (390×844 @3x) | 모바일 화면 — 바가 낮아 워터마크는 생략되고 두 줄·스티치만 |
| `fix-emblem-color-desktop.png` · `fix-emblem-allblack-desktop.png` · `fix-emblem-color-mobile.png` | 1440×900 · 390×844 | 엠블럼 탭 원본 컬러 / All Black (PC 인스펙터·모바일 시트) |

- 라이브 파일 SHA-256 = 저장소 파일: `js/plate.js` `6d33638a…`, `tests/run_tests.py` `1ed10bbf…`
- 자동화 테스트: `python3 tests/run_tests.py` → **PASS 646 · FAIL 0 · SKIP 0**
  (film 대칭: 레일 높이 동일 · 각 구멍이 자기 레일 정중앙 · 그려진 구멍의 위/아래 간격 · 실선 여유 · 뱃지 자리 /
  strap 여백: 바 높이 ≤ 사진 높이 13% · 사진 아래 첫 줄 여백 · 스티치 위 여백 · 스티치에 글자 0건)

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
