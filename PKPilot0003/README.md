# HD2Lab · Shutterplate (PKPilot0003)

사진 한 장을 갤러리 플레이트 한 장으로. 사진을 올리면 EXIF를 읽어 보더·노출 스펙·서명을 얹고,
원본 1:1 해상도로 내려받는 **브라우저 로컬 포토 플레이트 스튜디오**입니다.

- 라이브: <https://hyangdan2.github.io/PKPilot0003/>
- 업로드 **0 B** — 사진은 서버로 전송되지 않습니다. 파싱·렌더·인코딩 전부 이 기기에서 끝납니다.
- 외부 CDN 의존 없음 — EXIF 파서까지 로컬 번들.

## 워크플로

1. **Upload** — 드래그앤드롭 · 파일 선택 · `샘플 사진 불러오기` (EXIF가 심어진 샘플 3종)
2. **Plate Style** — 시그니처 4종 중 선택
3. **Exposure Deck** — EXIF 인라인 편집 (수정 즉시 캔버스 재렌더)
4. **Maker Emblems** — EXIF Make 기준 자동 선택 + 10종 수동 오버라이드
5. **Plate Geometry** — 보더 패딩 · 하단 여백 · 라운딩 · 폰트
6. **Export** — 원본 1:1 JPEG/PNG 다운로드

## 시그니처 플레이트 4종

| 스타일 | 특징 |
| --- | --- |
| **Classic Gallery** | 화이트 매트 · 제조사 엠블럼 · 노출 스펙 1열 · 세리프 서명 |
| **Studio Dark** | HD2Lab 매트 차콜 · 오렌지 레일/코너 브래킷 · 모노스페이스 메타 |
| **Clean Horizon** | 최소 여백 · 얇은 디바이더 · 한 줄 미니멀 텍스트 |
| **Film Plate** | 35mm 스프로킷 · 필름 스톡 뱃지(PORTRA 400 등) · 프레임 번호 |

각 플레이트의 여백·폰트는 Plate Geometry에서 자유롭게 조정되며, 스타일 변경 시 해당 스타일의
기본값으로 리셋됩니다.

## 구조

```
PKPilot0003/
├─ index.html              # 셸 · 인라인 SVG 아이콘 스프라이트(자체 제작)
├─ style.css               # HD2Lab 다크 테크 UI (#101110 / #ff824f)
├─ app.js                  # 업로드·EXIF·프리뷰(줌/팬)·내보내기 배선
├─ js/
│  ├─ exif-core.js         # EXIF → 8개 필드 정규화 (순수 함수)
│  ├─ emblems.js           # 메이커 엠블럼 10종 벡터 스펙 → SVG + Canvas 이중 렌더
│  ├─ plate.js             # 플레이트 레이아웃·페인트 엔진 (프리뷰/내보내기 공용)
│  └─ vendor/exifr.full.umd.js
├─ assets/samples/         # 데모용 샘플 3종 (EXIF 내장)
├─ tools/
│  ├─ generate_brand_assets.py   # 파비콘 세트 · OG 이미지
│  └─ make_samples.py            # 샘플 JPEG + EXIF 생성
├─ tests/run_tests.py      # 정적 + 브라우저(Playwright) 검증
├─ manifest.json
└─ favicon.svg · favicon.ico · icon-192/512.png · apple-touch-icon.png · og-image.png
```

### 렌더링 방식

프리뷰와 내보내기는 **같은 페인트 루틴**을 같은 "플레이트 좌표계"에서 호출합니다.
프리뷰는 `ctx.scale()`만 곱해 화면에 맞추고, 내보내기는 원본 해상도(최대 4096px) 캔버스에
1:1로 그립니다. 그래서 화면과 결과물의 서체·자간·여백이 어긋나지 않습니다.

## 테스트

```bash
python3 tests/run_tests.py        # -v 로 상세 출력
```

- **정적**: HTML 시맨틱(h1·viewport·OG), SVG 심볼 유효성, 자산 참조 무결성, CSS 토큰,
  모바일 규격(16px 입력·44px 터치 타깃), CDN 미사용, manifest 무결성
- **브라우저**: 번들 샘플의 실제 EXIF 파싱, 포매터 단위 테스트, 플레이트 기하,
  캔버스 렌더/재렌더, 내보내기 해상도·파일명, 모바일 인체공학(가로 스크롤 없음·sticky 프리뷰)

Playwright/Chromium이 없는 환경에서는 브라우저 계층만 SKIP하고 나머지로 판정합니다.

## 샘플 사진

`assets/samples/`의 3장은 이 프로젝트를 위해 생성한 데모 프레임에 EXIF(SONY / FUJIFILM / Canon)를
심은 것입니다. 실제 촬영물이 아니며, 앱 동작 시연용입니다.

## 브랜딩 자산 재생성

```bash
python3 tools/generate_brand_assets.py
python3 tools/make_samples.py --src-dir <샘플 원본 PNG 폴더>
```

HD2Lab 표준: 다크 `#101110`, 오렌지 `#ff824f`, 파비콘 SVG/ICO/32/180/192/512, OG 1200×630.
