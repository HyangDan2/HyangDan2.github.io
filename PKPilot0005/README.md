# HD2Lab | Solver (PKPilot0005)

문제를 넣으면 읽고 풀어주는 정적 웹앱. 텍스트·캡처·교재 사진을 받아 **유형 판독 → 정답 → 단계별 풀이 → 오답 소거·핵심 포인트**를 한 장의 답안 카드로 정리한다.

- 라이브: <https://hyangdan2.github.io/PKPilot0005/>
- 계열: Web-HQ / PKPilot0001·0002·0003·0004 와 같은 HD2Lab 다크 스튜디오 테마
- 런타임: 정적(빌드 없음). 서버가 없으면 **데모 모드**, Server-HQ API를 연결하면 **실제 비전 모델 판독**

## 두 가지 실행 모드

| 모드 | 조건 | 동작 |
|------|------|------|
| 데모(기본) | `API 연결`이 비어 있음 | 브라우저 안에서만 동작. 내장 예시 3종(객관식·코딩·캡처) + 일차방정식·사칙연산은 실제로 계산. 그 외 입력은 유형·주제 판독과 접근 전략만 제시하고 **정답을 지어내지 않는다** |
| API | `API 연결`에 `…/api/solver/solve` 저장 | Server-HQ `hd2lab-solver` 서비스 → AI Gateway(`hd2ai-solver` 라우트) → 무료 비전 모델 |

API 모드에서도 실패하면 데모로 **몰래 폴백하지 않는다.** 오류를 보여주고, 사용자가 `연결 해제`를 누르면 데모로 돌아간다.

## 기능

- **입력** — 텍스트 붙여넣기(최대 8,000자 권장), 이미지 클릭 선택 / 드래그&드롭 / `Ctrl`·`Cmd`+`V` 붙여넣기 / 모바일 카메라·앨범, 썸네일 미리보기와 지우기
- **이미지 처리** — 긴 변 1600px, JPEG 품질 0.9→0.5 자동 감소, **base64 1.5MB 이하** 유지. 캔버스 재인코딩으로 **EXIF·GPS 제거**
- **유형 선택** — `자동 판독` · `객관식` · `주관식·서술형` · `코딩·디버깅` · `엔파고다·어학` + 추가 힌트 한 줄
- **답안 카드** — 유형·주제·모드 배지, 정답 하이라이트, 단계별 풀이(번호), 오답 소거·핵심 포인트, 답안 복사
- **기록** — `localStorage` 최근 30건, 불러오기·삭제·전체 삭제(2단계 확인)
- **키보드** — `⌘`/`Ctrl` + `Enter` 로 바로 풀기
- **반응형** — 1440px 2단 스튜디오 / 390px 1단, 가로 넘침 0

## 파일

| 파일 | 설명 |
|------|------|
| `index.html` | 헤더 락업 `[mark] HD2Lab \| Solver`, 입력·답안 패널, 기록, `API 연결` 다이얼로그 |
| `style.css` | Web-HQ 토큰(`#101110`·`#ff824f`), 듀얼 스큐 `.mark`, 반응형 |
| `app.js` | 데모 솔버, 이미지 압축, API 클라이언트, 기록 관리 |
| `assets/sample-problem.png` | 캡처 예시(영어 빈칸 문제 워크시트) |
| `og-image.png` | 1200×630 소셜 프리뷰 |
| `favicon.svg` · `favicon.ico` · `favicon-32x32.png` · `apple-touch-icon.png` · `icon-192.png` · `icon-512.png` | 파비콘·PWA 아이콘 |
| `manifest.json` | PWA 매니페스트 |
| `HANDOFF_ANTIGRAVITY.md` | 서버(AI Gateway 멀티모달·라우트·비전 모델·FastAPI·Nginx) 인수인계서 |

## 저장 키 (localStorage)

| 키 | 내용 |
|----|------|
| `pkpilot0005_api_v1` | `{ url, auth: 'none'\|'bearer'\|'cookie', token }` |
| `pkpilot0005_history_v1` | 최근 30건 `{ id, at, type, topic, question, hint, mode, result }` |

토큰은 이 브라우저에만 저장되며 화면·로그에 남기지 않는다.

## API 계약 (요약)

```http
POST /api/solver/solve
{ "text": "...", "image_base64": "data:image/jpeg;base64,...", "mode": "auto|quiz|essay|code|enpago", "hint": "..." }
→ 200 { "answer": "④ x = 10", "answer_detail": "...", "steps": [...], "key_points": [...],
        "problem_type": "quiz", "topic": "수학 · 일차방정식", "confidence": "high",
        "model": "...", "elapsed_ms": 4210 }
```

`/api/solver/health` 로 연결을 확인한다. 엔드포인트가 `/solve`로 끝나면 프런트가 `/health`를 자동으로 만든다.
전체 계약·오류 표는 [`HANDOFF_ANTIGRAVITY.md`](HANDOFF_ANTIGRAVITY.md) 9장.

## 로컬에서 열기

```bash
python3 -m http.server 8899 --directory .
# http://127.0.0.1:8899/
```

`file://` 로 열어도 데모는 동작하지만, `localStorage`·`fetch` 제약 때문에 로컬 서버 사용을 권장한다.

## 검증 (2026-11-16, headless Chromium)

`1440×900` / `390×844` 두 뷰포트에서 콘솔·페이지 오류 0, 가로 넘침 0:

- 객관식 예시 → `④ x = 10` (단계 5, 포인트 5)
- 코딩 예시 → `ZeroDivisionError` 진단 + 수정 코드
- 캡처 예시 → 썸네일 1100×780 미리보기, `③ went ahead`
- 파일 업로드 → 1600px·JPEG 압축(74KB) 확인
- `API 연결` 모달 → 연결 테스트·저장·해제, 모킹 API 모드에서 `API` 배지 전환
- 기록 저장 → 새로고침 후 유지, 불러오기·삭제·전체 삭제
- 답안 복사 → 클립보드 `[정답] ④ x = 10`
- 브라우저 → FastAPI → Unix socket → 게이트웨이 응답까지 **E2E 스택 검증**(문서 작성 환경)

## 브랜딩 규격

- 배경 `#101110`, 카드 `#1b1d1a`, 보더 `#343630`, 액센트 `#ff824f`
- 헤더 락업: 듀얼 스큐 `.mark` + `HD2Lab`(25px/800/-1.5px) + 구분선 + `Solver`(12px)
- OG: 1200×630, 좌측 마크 + `62px HD2Lab | Solver`
