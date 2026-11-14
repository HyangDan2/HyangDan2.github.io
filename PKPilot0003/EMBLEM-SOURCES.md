# Shutterplate 엠블럼 출처 (EMBLEM SOURCES)

`js/emblems.js`의 브랜드 엠블럼 10종은 **각 제조사가 공개한 실제 로고 벡터 원본**에서 가져온
path 데이터입니다. 글꼴로 글자를 흉내 내거나 새로 그린 것이 아니며, 아래 원본 파일의 path 명령을
그대로 옮긴 뒤(아크 → 3차 베지어 변환, 각 요소의 transform 적용) 다음 두 가지만 정규화했습니다.

1. **좌표계** — 마크 높이를 100 단위로 맞추고 종횡비는 원본 그대로 유지(`vb`).
2. **색상** — 각 제조사의 공식 브랜드 컬러를 살립니다(기본값). 단색으로 인쇄하는 **All Black
   (단색)** 옵션을 켜면 모든 마크가 플레이트 잉크 한 색으로 통일됩니다(HD2Lab의 오렌지 accent 포함).

형태(글자 모양, 심볼 비율)는 원본에서 한 점도 바꾸지 않았습니다.
HD2Lab 마크는 이 프로젝트의 공식 브랜드 시트(듀얼 스큐)를 그대로 씁니다.

### 브랜드 컬러 적용표

| 엠블럼 | 원본 컬러 | 밝은 프레임 | 어두운 프레임(Film Sprocket · Studio Dark) |
| --- | --- | --- | --- |
| Sony | 단색 워드마크 | `ink` | `ink` (크림) |
| Canon | Canon Red `#CC0000` | `#CC0000` | `#CC0000` |
| Nikon | 단색 워드마크 | `ink` | `ink` |
| Fujifilm | 본문 `ink` + `I` 노치 포인트 `#ED1A3D` | 동일 | 동일 (`ink`는 크림) |
| Samsung | Samsung Blue `#1428A0` | `#1428A0` | `#3B6BFF` (어두운 배경 시인성 보정) |
| Leica | Leica Red `#E20613` 원형 뱃지 | `#E20613` + 스크립트 컷아웃(`evenodd`) | 동일 |
| Hasselblad | 단색 워드마크 | `ink` | `ink` |
| Apple | 단색 심볼 | `ink` | `ink` |
| Lumix | Lumix Red `#E60012` | `#E60012` | `#E60012` |
| OM System | OM System Blue `#0033A0` | `#0033A0` | `#4B83FF` (시인성 보정) |
| HD2Lab | 오렌지 accent `#ff824f` + `ink` | 동일 | 동일 |

Leica는 흰 스크립트가 뚫린 원형 마크라 원본 구조 그대로 `evenodd`로 브랜드 원판을 그리고,
컷아웃 안쪽은 플레이트 배경색이 비칩니다(어두운 프레임에서는 어두운 필기체). All Black 모드에서는
원판·필기체 모두 플레이트 잉크 한 색으로 그립니다.

| 엠블럼 | 원본 파일 | 출처 | 원본 형식 | 라이선스 |
| --- | --- | --- | --- | --- |
| Sony | `Sony_logo.svg` | https://commons.wikimedia.org/wiki/File:Sony_logo.svg | SVG (1280×225) | Public domain (PD-textlogo, 상표) |
| Canon | `Canon_logo.svg` | https://commons.wikimedia.org/wiki/File:Canon_logo.svg | SVG (118×25) | Public domain (PD-textlogo, 상표) |
| Nikon | `logo.svg` (Nikon 공식 사이트) | https://www.nikon.com/etc.clientlibs/nikoncore/clientlibs/clientlib-site/resources/img/logo.svg | SVG (400×400, 워드마크 path `#150301`만 사용) | Public domain (PD-textlogo, 상표) — Wikimedia `File:Nikon Logo.svg`와 동일 아트워크 |
| Fujifilm | `Fujifilm_logo.svg` | https://commons.wikimedia.org/wiki/File:Fujifilm_logo.svg | SVG (1029×171) | Public domain (PD-textlogo, 상표) |
| Samsung | `Samsung_wordmark.svg` | https://commons.wikimedia.org/wiki/File:Samsung_wordmark.svg | SVG (7051×1080) | Public domain (PD-textlogo, 상표) |
| Leica | `Leica_Camera_logo.svg` | https://commons.wikimedia.org/wiki/File:Leica_Camera_logo.svg | SVG (768×768) | Public domain (PD-textlogo, 상표) |
| Hasselblad | `Hasselblad_logo.svg` | https://commons.wikimedia.org/wiki/File:Hasselblad_logo.svg | SVG (512×48) | Public domain (PD-textlogo, 상표) |
| Apple | `Apple_logo_black.svg` | https://commons.wikimedia.org/wiki/File:Apple_logo_black.svg | SVG (814×1000) | Public domain (PD-textlogo, 상표) |
| Lumix | `Lumix_logo.svg` | https://commons.wikimedia.org/wiki/File:Lumix_logo.svg | SVG (500×114) | Public domain (PD-textlogo, 상표) |
| OM System | `logo.svg` (OM System 공식 사이트) | https://nala.explore.omsystem.com/static/version1793784977/frontend/OMDigital/Hyva/en_US/images/logo.svg | SVG (186×23, `OM SYSTEM` 원라인) | Public domain (PD-textlogo, 상표) — Commons `File:OM-System-Logo.svg`는 `<text>` 기반이라 쓰지 않음 |
| HD2Lab | 프로젝트 브랜드 시트 | `HyangDan2.github.io` 듀얼 스큐 마크 | SVG path (64×64) | HD2Lab 자체 마크 |

## 상표 고지

Sony, Canon, Nikon, Fujifilm, Samsung, Leica, Hasselblad, Apple, Panasonic Lumix, OM System 및
각 로고는 해당 권리자의 등록 상표입니다. Shutterplate는 EXIF의 카메라 제조사를 표기하는
기존 인화 프레임의 관례를 따라 이 마크를 사용하며, 제조사와의 제휴·후원 관계를 주장하지 않습니다.

## 재생성 방법

`work/emblems/`의 파이프라인(`extract.py` → `build.py` → `gen_js.py`)으로 원본 SVG에서
path 데이터를 다시 뽑아 `js/emblems.js`를 생성합니다. 원본 파일은 저장소에 포함하지 않습니다.
