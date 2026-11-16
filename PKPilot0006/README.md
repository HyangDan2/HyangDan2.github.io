# HD2Lab | DOS Player (PKPilot0006)

고전 DOS 게임을 설치 없이 브라우저에서 바로 실행하는 정적 인스턴트 플레이어. [js-dos v8](https://js-dos.com/)(DOSBox WebAssembly)이 에뮬레이터를 돌리고, 페이지는 GitHub Pages에서 정적으로 배포된다.

- 라이브: <https://hyangdan2.github.io/PKPilot0006/>
- 계열: Web-HQ / PKPilot0001·0002·0003·0005 와 같은 HD2Lab 다크 스튜디오 테마(`#101110` · `#ff824f`)
- 런타임: 빌드 없음. 서버 없음. 번들은 js-dos 공개 CDN에서, 내 파일은 브라우저 메모리에서만 읽는다

## 바로실행용 번들 (전부 실측 검증)

| # | 번들 | 원작 | 크기 | 라이선스 | URL |
|---|------|------|------|----------|-----|
| 1 | Digger | Windmill Software, 1983 | 26,875 B | Freeware | `https://v8.js-dos.com/bundles/digger.jsdos` |
| 2 | DOOM (셰어웨어 Ep.1) | id Software, 1993 | 5,539,791 B | Shareware | `https://v8.js-dos.com/bundles/doom.jsdos` |
| 3 | Dhrystone 2 | R. P. Weicker (DOS/4GW) | 178,752 B | Benchmark | `https://v8.js-dos.com/bundles/dhry2.jsdos` |

세 URL 모두 `curl` HTTP 200과 헤드리스 Chromium 실제 부팅(캔버스 생성 + 화면 렌더)까지 확인했다. `v8.js-dos.com/bundles/`는 `Origin`에 맞춰 `access-control-allow-origin`을 돌려주므로 GitHub Pages에서 CORS 문제가 없다. 그 밖의 후보 이름(keen4, prince, wolf3d, duke3d, tetris, sopwith 등 60여 개)은 이 CDN에서 404였다 — 공개 번들은 이 3종이 전부다.

## 기능

- **원클릭 부팅** — 첫 게임(Digger)이 자동 선택되고, 시작 베일의 `▶ 실행` 한 번이면 부팅. `Dos()` 호출을 사용자 클릭 안에서 하므로 브라우저 오디오 자동재생 정책에 걸리지 않는다
- **번들 전환** — 라이브러리 카드 클릭 한 번으로 기존 인스턴스를 `stop()`하고 새 번들을 부팅
- **내 파일 실행** — `.jsdos` / `.zip`을 드래그&드롭하거나 파일 선택. `URL.createObjectURL(file)`로 열고 페이지 어디에 떨어뜨려도 플레이어로 들어온다. 파일은 서버로 전송되지 않는다
- **전체화면** — 화면 셸을 네이티브 Fullscreen API로 전환하고, 전체화면 안에서도 `전체화면 나가기` 버튼을 제공(Esc는 DOS가 가로챌 수 있다)
- **가상 게임패드** — 방향키 · Enter · Space · Ctrl · Esc · Y · N을 실제 `KeyboardEvent`(keyCode 포함)로 에뮬레이터에 전달. 터치 기기에서 길게 눌러 이동할 수 있다
- **소리 · 다시 시작** — `setVolume(0|1)`, `stop()` 후 재부팅
- **딥링크 · 기억** — `?game=doom`으로 특정 번들 직행, 마지막 게임은 `localStorage`에 기억
- **반응형** — 1440×900 데스크톱 2단 / 390×844 모바일 1단, 가로 넘침 0 (320·768·1024px 확인)

## js-dos 크롬 정리

js-dos는 자체 사이드바(저장·키보드·확대·성능·설정)를 주입한다. 이 앱은 같은 기능을 자체 툴바로 제공하므로 주입된 `.sidebar-thin`·스페이서(`.w-4`)·배경 이미지를 CSS로 숨기고 캔버스만 중앙 정렬한다. 마우스 캡처(`mouseCapture`)는 껐다 — 켜면 "Click to capture mouse" 안내가 화면을 덮는다. 시작 시 js-dos가 도는 Dhrystone 성능 측정 오버레이(`.dhry2-window`)도 숨기고 자체 부팅 베일을 쓴다.

## 파일

| 파일 | 설명 |
|------|------|
| `index.html` | 마크업 + OG/PWA 메타 |
| `style.css` | HD2Lab 다크 테마, 플레이어·라이브러리·패드 레이아웃 |
| `app.js` | js-dos 로더, 부팅 상태 머신, 파일 실행, 전체화면, 가상 패드 |
| `manifest.json` | PWA 매니페스트 |
| `og-image.png` | 1200×630 소셜 카드 |
| `favicon.*`, `icon-*.png`, `apple-touch-icon.png` | 파비콘 세트 (듀얼 스큐 마크) |
| `tools/make_assets.py` | 파비콘·OG 카드 생성 스크립트 |

## 검증 (2026-11-16, 헤드리스 Chromium)

- 로컬 서버 + 1440×900: Digger 부팅 2.7초, 콘솔 오류 0, 페이지 오류 0, 실패 요청 0, 4xx 0, 가로 넘침 0
- `?game=doom` 2.6초 · `?game=dhrystone` 1.6초 부팅, 각각 캔버스 640×400 생성
- 파일 입력으로 `digger.jsdos` 로컬 실행 성공(`01 / RUNNING`)
- 가상 패드: DOOM 메뉴에서 ArrowDown 입력 시 화면 63px 평균 변화 = 입력이 에뮬레이터에 도달
- 음소거 `aria-pressed=true`, 전체화면 진입/나가기, 다시 시작 후 캔버스 재생성 확인
- 390×844: 가로 넘침 0, 캔버스가 셸에 맞게 325×203로 스케일
- 미검증: 실기기(iOS Safari·Android 카톡 인앱) 터치/오디오, 대용량(수십 MB) 번들 로딩 시간

## 라이선스

번들은 js-dos 프로젝트가 공개 배포하는 파일을 그대로 링크한다(직접 재배포하지 않는다). 원작 권리는 각 저작권자에게 있다.
