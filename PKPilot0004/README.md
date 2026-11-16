# Market Intelligence — PKPilot0004

「기업 본질 가치와 무관한 경제 외적 주가 변동 요인 10선」을 **무료 공개 데이터만으로** 태깅하는 HD2Lab 대시보드입니다.
단기 과열(Non-Fundamental Drift Score)과 평균 회귀 리스크를 **다른 점수**로 분리해 보여주고,
어떤 데이터가 실데이터가 아닌지(표본) 화면에 그대로 표시합니다.

- 라이브(머지 후): `https://hyangdan2.github.io/PKPilot0004/`
- 상태: **초안(DRAFT)** · 검토용 PR · `noindex`
- 인수인계 명세: [HANDOFF_ANTIGRAVITY.md](HANDOFF_ANTIGRAVITY.md)
- 백엔드 초안: [`backend/`](backend/) → Server-HQ 이식 대상

## 두 가지 모드

| 모드 | 조건 | 데이터 | 점수 계산 | 네트워크 |
| --- | --- | --- | --- | --- |
| **정적 데모**(기본) | 그대로 열면 됨 | 내장 표본 4종목(삼성전자·SK하이닉스·에코프로·NAVER) | 브라우저 | 0회 |
| **API 모드** | 헤더 `API 연결` → Base URL | 서버 응답 | 서버 | `/api/analyze` 등 |

데모는 `2026-11-13 15:30 KST` 기준 시각을 고정해 **언제 열어도 같은 결과**가 나오며,
백엔드와 같은 스코어링 규칙을 씁니다(4종목 NFDS·MR·신호 수 일치 확인).
API 주소는 `localStorage` 에만 저장되고 서버로 전송되지 않습니다.

## 구성

| 파일 | 내용 |
| --- | --- |
| `index.html` | 헤더(Web-HQ 락업) · 히어로 · 메커니즘 도해 · 종목 분석기 · 10선 분류표 · 투자자 원칙 · API 설정 시트 |
| `style.css` | HD2Lab 다크/오렌지(#101110 / #ff824f), 320~1440px 반응형, 의존성 0 |
| `app.js` | 도메인 문구 · 표본 데이터 · 데모 스코어링 엔진 · API 클라이언트 · 렌더러 (외부 문자열은 `textContent` 만 사용) |
| `manifest.json`, `favicon.*`, `icon-*.png` | PWA·아이콘 세트(404 방지) |
| `backend/` | FastAPI 초안(무료 API 파이프라인 + pytest 61개) |

## 로컬 실행

```sh
# 프런트(정적)
python3 -m http.server 8804 --bind 127.0.0.1
# → http://127.0.0.1:8804/

# 백엔드(표본 모드)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
MI_OFFLINE=1 .venv/bin/python -m uvicorn market_intel.app:create_app --factory --host 127.0.0.1 --port 8791

# 프런트 → 백엔드 연결 확인 (정적 서버 출처를 CORS 에 허용)
MI_CORS_ORIGINS="http://127.0.0.1:8804,http://127.0.0.1:8791" \
  .venv/bin/python -m uvicorn market_intel.app:create_app --factory --host 127.0.0.1 --port 8791
# → http://127.0.0.1:8804/?api=http://127.0.0.1:8791
```

`?api=` 는 그 세션에서만 쓰는 주소입니다. 상단 `API 연결` 로 저장하면 다음 방문부터 자동 연결합니다.

## 검증

| 항목 | 결과 |
| --- | --- |
| 백엔드 테스트 | **61 passed** (`pytest`, 네트워크 미사용) |
| 데모 ↔ 백엔드 동등성 | 4종목 NFDS·MR·신호·축 점수 일치 |
| 화면(1440 / 390 / 320) | 가로 넘침 0, 콘솔 오류 0 |
| API 모드 실측 | 실제 무료 소스로 `mode: mixed`, NFDS 34.3(005930) |

자세한 수치와 재현 방법은 [HANDOFF_ANTIGRAVITY.md](HANDOFF_ANTIGRAVITY.md) 3.3~3.5절에 있습니다.

## 알려진 한계

- 데모 표본은 4종목이며 실시간이 아닙니다(기준 시각 고정).
- 해외 종목은 Yahoo 호출 제한(429) + 한국어 키워드 사전 미적용으로 신호가 비어 있을 수 있습니다.
- 공매도 잔고는 무료 실시간 소스가 없어 수급 역전으로 대체 추정합니다.
- 점수 계수는 백테스트 전 가설값입니다.

투자 자문이 아니며 모든 응답에 면책 문구가 포함됩니다.
