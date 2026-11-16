# HANDOFF_ANTIGRAVITY — HD2Lab Market Intelligence (PKPilot0004 이식본)

> **한 줄 요약**: 「기업 본질 가치와 무관한 경제 외적 주가 변동 요인 10선」을 **무료 공개 API만으로** 태깅해
> 단기 과열(NFDS)과 평균 회귀 리스크를 분리 표시하는 **정적 프런트(PKPilot0004 · GitHub Pages)** +
> **FastAPI 백엔드(Server-HQ)** 2단 구성 초안.
> 이 문서는 **안티그라비티(Antigravity) 인수인계용 작업 명세서**다.

| 항목 | 값 |
| --- | --- |
| 서비스명 | HD2Lab Market Intelligence (`market-intelligence`) |
| 버전 | `0.1.0-draft` |
| 프런트 저장소 | `HyangDan2/HyangDan2.github.io` · 경로 `PKPilot0004/` · 브랜치 `feat/pkpilot0004-market-intel-draft` |
| 프런트 주소(머지 후) | `https://hyangdan2.github.io/PKPilot0004/` |
| 백엔드 저장소 | `HyangDan2/Server-HQ` (이식 대상) · 원본 커밋 `ec75dc3` (PR #2 close 후 이관) |
| 백엔드 패키지 | `PKPilot0004/backend/` → Server-HQ 배포 시 `services/market-intelligence/` |
| 작업 일자 | 2026-11-15 (Asia/Seoul) |
| 구현 범위 | 정적 대시보드(데모 엔진 내장) + FastAPI 초안 + 테스트 61개 + 배포 예시(systemd/Nginx) |
| 배포 상태 | **미배포** · 프런트는 PR만 열어 검토 대기, 백엔드는 Server-HQ 반영 전 |
| 라이선스/비용 | 유료 API·유료 모델 **0원**. 무료 공개 엔드포인트만 사용 |
| 데이터 정본 | 원본 브리프 1장(4대 축 · 10선 · 투자자 대응 원칙)을 `backend/market_intel/domain.py` 로 고정하고, 프런트 `app.js` 의 `DOMAIN` 블록이 같은 문구를 들고 있다 |

### 이 문서를 읽는 순서

1. **1절**에서 왜 Server-HQ 단독이 아니라 PKPilot0004 + Server-HQ 2단인지 이해한다.
2. **2절**에서 도메인(무엇을 판별하는가)을 확인한다. 문구 정본은 `domain.py`.
3. **3절**은 프런트엔드(데모 모드 · API 모드 · 배포) 명세다.
4. **4절**은 백엔드의 무료 소스 표와 요청 예산, **6절**은 점수 공식이다. 점수를 바꾸면 6절을 먼저 고친다.
5. **7절**은 운영 반영 절차다. **"GitHub 업로드 ≠ 서버 배포"** 원칙을 지킨다.
6. **8절**이 안티그라비티가 실제로 착수할 작업 목록(Phase 1~3)이다.

---

## 1. 이식 배경과 2단 구조

### 1.1 왜 Server-HQ 안에 두지 않는가

- 최초 초안은 `Server-HQ/services/market-intelligence/` 에 올렸으나(PR #2), **사용자가 반려**했다:
  > "ㄴㄴ… 거기 심으면 안됨. PKPilot 다음 넘버링으로 해서 이식 요청을 해야됨"
- 그래서 **화면은 PKPilot0004(Web-HQ 하위 정적 앱)**, **API 는 Server-HQ(무료 API 파이프라인)** 로 나눴다.
  Server-HQ PR #2 는 close, 원격 브랜치는 삭제된 상태다. 코드는 이 저장소의 `PKPilot0004/backend/` 로 옮겼다.
- 이 구조의 이점: 프런트는 GitHub Pages 라 서버 없이도 항상 뜨고(데모 엔진), 백엔드는 준비되면 켠다.
  백엔드가 죽어도 화면이 404 가 되지 않는다.

### 1.2 컴포넌트

```
[브라우저 · https://hyangdan2.github.io/PKPilot0004/]
  index.html + style.css + app.js  (정적 · 의존성 0)
        │
        │  ① API Base URL 미설정 → 내장 표본 + 내장 스코어링(네트워크 0회)
        │  ② API Base URL 설정   → GET {base}/api/analyze?q=...
        ▼  (CORS: 서버가 Access-Control-Allow-Origin 발급)
[Server-HQ · FastAPI market_intel]
  app.py ─▶ service.MarketIntelligenceService
              │ 1) 종목 해석(samples.SYMBOL_REGISTRY → 6자리 코드 / 해외 티커)
              │ 2) 커넥터 수집(각자 상태·실패 사유 반환)
              │ 3) signals.build_signals : 뉴스·공시·시세 → 10선 태깅
              │ 4) scoring.score_payload : NFDS · 평균회귀 · 원칙
              ▼
  connectors/{opendart, market_data, news_rss}.py ─▶ 무료 공개 엔드포인트
  (TTLCache: 시세 120s · 뉴스 900s · 공시 3600s · 분석 180s)
```

설계 원칙

- **프런트는 백엔드 없이 완결된다.** 데모 엔진은 `market_intel` 과 같은 규칙으로 점수를 계산한다(3.3절 검증표).
- **커넥터는 예외를 밖으로 던지지 않는다.** 실패는 `ConnectorResult.status ∈ {live, sample, disabled, error}` 로 표현한다.
- **표본(sample)과 실데이터(live)를 응답에서 절대 섞어 표기하지 않는다.** `sources[]`·`mode`·`data_gaps` 로 구분한다.
- **화면은 외부 문자열을 `textContent` 로만 삽입**한다(뉴스 제목 XSS 차단, `innerHTML` 없음).
- **도메인 문구는 한 곳에서만 고친다.** 백엔드는 `domain.py`, 프런트는 `app.js` 의 `DOMAIN` 블록.
  두 곳을 동시에 고쳐야 하는 구조이므로, 문구를 바꿀 때는 **같은 커밋에서 양쪽을 고치고 3.3절 검증표를 다시 채운다.**

---

## 2. 프로젝트 목적 및 10선 · 4대 축 도메인 모델

### 2.1 목적

기업의 주가는 실적·재무·산업 펀더멘털로만 움직이지 않는다. 정치 테마, 지수 편출입, 공매도 스퀴즈,
무상증자, SNS 루머처럼 **기업의 본질 가치와 무관한 경제 외적 요인**이 단기 가격을 강하게 흔든다.
이 서비스의 목적은 세 가지다.

1. **분류**: 뉴스·공시·시세를 10개 요인 · 4개 축으로 자동 태깅한다.
2. **분리**: "가격을 미는 힘"(비재무 요인 과열)과 "되돌아올 거리"(밸류에이션·가격 위치)를 **다른 점수**로 낸다.
3. **경계**: 이벤트가 끝났을 때의 평균 회귀 위험과 투자자가 확인해야 할 항목을 함께 제시한다.

> **이 서비스가 하지 않는 것**: 매수·매도 신호, 목표주가, 수익률 예측, 자동 주문.
> 점수는 공개 데이터 기반 휴리스틱이며 화면·응답 모두에 면책 문구를 고정 출력한다.

### 2.2 4대 축 메커니즘

```
① 지배구조·자본 이벤트 (2·9번)  ┐
② 수급·시장 구조 요인  (3·8번)  ├─→  단기 수급 불균형 및      ┌─→ ▲ 단기 급등 (테마·촉커버·수급)
③ 정치·외부 환경 충격  (1·6·7번) │    비이성적 기대·공포 증폭 ─┤─→ ▼ 단기 급락 (리스크·강제 매도)
④ 심리·평판·정보 확산 (4·5·10번) ┘                            └─→ ↺ 평균 회귀 (Mean Reversion)
```

| 축 ID | 축 이름 | 요인 | 가중치(초안) | 판별 시 주의점 |
| --- | --- | --- | --- | --- |
| `AX01` | 지배구조·자본 이벤트 | 2, 9 | 0.20 | **공시 원문이 1차 근거.** 뉴스보다 접수 시각이 빠르고 정확하다 |
| `AX02` | 수급·시장 구조 요인 | 3, 8 | 0.25 | 거래량·거래대금 급증, 외국인/기관 순매수 방향으로 확인 |
| `AX03` | 정치·외부 환경 충격 | 1, 6, 7 | 0.25 | 뉴스 빈도·확산 속도가 핵심. 업종 단위 수혜/피해로 갈린다 |
| `AX04` | 심리·평판·정보 확산 | 4, 5, 10 | 0.30 | 출처 신뢰도가 낮을수록 강도는 세고 수명은 짧다 |

가중치는 `domain.AXES[*].weight` 에 있고 합은 1.0이다(`tests/test_domain.py`). 초안 값은
"심리·정보 확산이 단기 변동성에 가장 크게 기여한다"는 판단에서 정한 **가설값**이며 백테스트로 재보정해야 한다(6.8절).

### 2.3 10가지 요인 (브리프 원문 + 태깅 소스)

표시 순서는 브리프 분류표 행 순서(2·9 / 3·8 / 1·6·7 / 4·5·10)를 그대로 쓴다.

| # | 요인 | 축 | 핵심 유발 원리 및 시장 반응 (원문) | 주가 방향성 | 1차 소스 | 키워드 수 |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 행동주의 및 주주환원 | AX01 | 행동주의 펀드 개입, 자사주 소각·배당 확대 요구 및 물적분할 이슈 | ▲ 환원 / ▼ 분할 | 공시+뉴스 | 12 |
| 9 | 무상증자 및 액면분할 | AX01 | 시총 변화 없는 주식 수 증가로 유동성 개선 및 저가 착시 효과 발생 | ▲ 단기 급등 | 공시 | 6 |
| 3 | 주가지수 편입·리밸런싱 | AX02 | MSCI·코스피200 등 지수 편출입에 따른 패시브 자금의 기계적 매매 | ▲ 편입 / ▼ 편출 | 뉴스+시세 | 8 |
| 8 | 공매도 숏 스퀴즈 | AX02 | 과도한 공매도 누적 종목에 개인 매수세 결집 시 기관의 강제 쇼트커버링 | ▲ 폭등 연출 | 뉴스+시세 | 7 |
| 1 | 정치 및 선거 테마 | AX03 | 유력 정치인 인맥(학연·지연) 및 선거 공약 수혜주로 분류되어 변동성 확대 | ▲▼ 극심한 변동 | 뉴스 | 11 |
| 6 | 지정학적 갈등·안보 위기 | AX03 | 국지전·무역보복 등 정세 급변 시 위험 회피 및 방산·보안주 반사이익 | ▲ 수혜 / ▼ 시장 | 뉴스 | 12 |
| 7 | 자연재해 및 전염병 확산 | AX03 | 재난·이상기후·감염병 발생 시 피해 업종 하락 및 복구·제약·비대면 수혜 | ▲ 수혜 / ▼ 피해 | 뉴스 | 12 |
| 4 | 경영진 사법·도덕적 리스크 | AX04 | 오너 횡령·배임·분식회계·일탈 보도로 거래정지 우려 및 불매운동 확산 | ▼ 급락·폭락 | 공시+뉴스 | 12 |
| 5 | 유명 인사·미디어 노출 | AX04 | 글로벌 기업가·셀럽의 특정 기업·제품 언급 및 사용 노출에 따른 매수 쏠림 | ▲ 단기 급등 | 뉴스 | 9 |
| 10 | 커뮤니티·SNS발 루머 | AX04 | 미확인 M&A·신약·부도설 유포로 선취매 유입 후 사실무근 공시 시 원위치 | ▲▼ 급등락 회귀 | 뉴스+공시 | 11 |

각 요인의 `keywords`(뉴스 태깅), `disclosure_terms`(공시 제목 매칭), `disclosure_types`(OpenDART 분류)는
`domain.py` 의 `FACTORS` 와 `app.js` 의 `FACTORS` 에 있다. **키워드를 추가·수정하면 이 표와 6절 예시도 함께 갱신한다.**

### 2.4 세 가지 가격 경로와 평균 회귀

| 경로 | 트리거 | 브리프 문구 |
| --- | --- | --- |
| ▲ 단기 급등 | 테마·촉커버·수급 | 재료 소멸 시 차익실현 매물 출회 |
| ▼ 단기 급락 | 리스크·강제 매도 | 불확실성 해소 전까지 투심 냉각 |
| ↺ 평균 회귀 | 실적 뒷받침 시 | 실질(본질) 가치로 복귀 |

**핵심 결론(원문 고정)**

> 경제 외적 요인은 단기 주가에 강력한 모멘텀과 변동성을 제공하지만, 기업의 본질적 이익 창출 능력이
> 뒷받침되지 않을 경우 이벤트 종료와 함께 원래의 내재 가치로 회귀(Mean Reversion)하는 특성을 보인다.

### 2.5 투자자 대응 원칙 (원문 고정)

| 변동 유형 | 시장 메커니즘 특징 | 투자자 핵심 유의사항 |
| --- | --- | --- |
| 비재무적 상승 요인 | 수급 쏠림, 이벤트성 기대감, 테마 형성에 의한 단기 과열 | 재료 소멸 시 급격한 차익실현 매물 출회 가능성 경계 |
| 비재무적 하락 요인 | 신뢰도 훼손, 불확실성 증대, 기계적·강제적 매도 물량 출회 | 단순 낙폭 과대 인식보다 실제 펀더멘털 훼손 여부 검증 |

여기에 요인별 실무 확인 항목 10개(`scoring.FACTOR_ACTIONS` ↔ `app.js` `FACTOR_ACTIONS`)를 더해 화면에 최대 3개까지 노출한다.

### 2.6 용어 정의

| 용어 | 정의 | 백엔드 | 프런트(데모) |
| --- | --- | --- | --- |
| **신호 강도(strength)** | 한 요인이 이 종목에서 얼마나 세게 작동하는지 0~1 | `signals.build_signals` | `buildSignals()` |
| **축 점수** | 축에 속한 요인 신호를 확률적 OR로 합친 0~1 | `scoring.axis_breakdown` | `axisBreakdown()` |
| **NFDS** | 4축 가중 압력을 감마 보정한 0~100 과열 점수 | `scoring.non_fundamental_drift_score` | `nonFundamentalDriftScore()` |
| **평균 회귀 리스크(MR)** | 가격 위치·이격·밸류에이션으로 본 되돌림 거리 0~100 | `scoring.mean_reversion_risk` | `meanReversionRisk()` |
| **mode** | `live` / `mixed` / `sample` | `service._analyze` | `demoAnalyze()` 는 항상 `sample` |
| **데이터 갭** | 실데이터가 아닌 항목과 그 이유 목록 | `service._data_gaps` | `dataGaps()` |

---

## 3. 프런트엔드 (PKPilot0004 · GitHub Pages)

### 3.1 파일 · 규격

```
PKPilot0004/
├── index.html          ← 헤더 · 히어로 · 메커니즘 · 분석기 · 10선 표 · 원칙 · 푸터 + API 설정 시트
├── style.css           ← HD2Lab 다크/오렌지, Web-HQ 헤더 락업, 320~1440px
├── app.js              ← DOMAIN · SAMPLES · 데모 스코어링 엔진 · API 모드 · 렌더러
├── manifest.json       ← PWA(설치형) 메타
├── favicon.ico / favicon.svg / favicon-32x32.png / apple-touch-icon.png / icon-192.png / icon-512.png
├── README.md           ← 실행·모드·검증 요약
├── HANDOFF_ANTIGRAVITY.md ← 이 문서
└── backend/            ← Server-HQ 로 옮길 FastAPI 초안(4절)
```

**Web-HQ 헤더 표준 (엄수)**

```html
<a class="brand" href="https://hyangdan2.github.io/">
  <span class="mark" aria-hidden="true"></span>   <!-- CSS 듀얼 스큐: 17×22, skewY(-23deg), 3px 오렌지 -->
  <span class="brand-name">HD2Lab</span>          <!-- 25px / 800 / -1.5px -->
  <em>MARKET INTELLIGENCE</em>                    <!-- 12px, 좌측 1px 보더 = "|" 구분선 -->
</a>
```

- `gap: 12px`, `.brand em { border-left: 1px solid; padding-left: 13px; font-size: 12px; }` 로 `HD2Lab | MARKET INTELLIGENCE` 락업을 만든다.
- 1024px 이하에서 22px, 520px 이하에서 21px / em 9px 로 줄이되 **락업(HD2Lab | 이름)은 모바일에서도 유지**한다.
  좁은 화면에서는 `#modePill`·`DRAFT` 배지를 숨겨 자리를 만든다(모드 표시는 히어로 아래 모드 바와 결과 메타가 담당).
- 듀얼 스큐 마크는 **파비콘·헤더 락업 전용**이다. OG·엠블럼 자리에 쓰지 않는다(정식 로고 규격은 Phase 3).

**메타**

- `robots: noindex, nofollow` — 초안이므로 검색 노출을 막는다.
- OG 이미지는 만들지 않았다(Phase 3 항목). 카카오톡 미리보기를 붙일 때는 1200×630 규격과 정식 로고를 쓴다.
- `theme-color #101110`, PWA 매니페스트, 파비콘 6종으로 404 를 만들지 않는다.

### 3.2 두 가지 모드

| 모드 | 진입 | 데이터 | 점수 계산 | 네트워크 |
| --- | --- | --- | --- | --- |
| **정적 데모**(기본) | API Base URL 비어 있음 | `app.js` 내장 표본(4종목 시세·뉴스·공시) | 브라우저에서 계산 | 0회 |
| **API 모드** | 헤더 `API 연결` → Base URL 저장 / `?api=https://...` | 서버 응답 | 서버가 계산 | `/api/factors`·`/api/symbols`·`/api/health`·`/api/analyze` |

- 저장 키: `localStorage["hd2lab.mi.apiBase"]`. 저장 실패(사파리 프라이빗)해도 세션 한정으로 동작한다.
- Base URL 은 `https://` 자동 보정, 끝 슬래시 제거, `URL()` 형식 검증 후 **`/api/health` 로 연결 확인에 성공해야만 저장**한다.
- 연결 실패 시: 저장하지 않고 시트에 사유 표시 → 기존 상태 유지. 목록 첫 로딩이 실패하면 **자동으로 데모로 폴백**하고 배너에 알린다.
- 분석 요청이 실패하면(타임아웃 15초) 오류를 띄우고 데모 결과로 폴백한다.
- `?api=` 쿼리는 세션용(즉시 테스트)이며 저장하지 않는다. 예: `.../PKPilot0004/?api=https://hd2lab.duckdns.org/market-intel`.

**데모 표본 기준 시각**: `2026-11-13T15:30:00+09:00` **고정**. 최신성 감쇠(`0.5^(경과일/반감기)`)를 실제 현재 시각으로 계산하면
시간이 지날수록 점수가 0에 수렴해 데모가 무의미해지므로, 표본은 기준 시각을 고정해 **언제 열어도 같은 결과**가 나오게 했다.
화면에는 `표본 기준 2026-11-13 15:30` 을 표기한다.

### 3.3 데모 엔진 ↔ 백엔드 동등성 검증 (2026-11-15)

백엔드 `build_signals(now=SAMPLE_AS_OF)` + `score_payload` 결과와, 같은 기준 시각으로 계산한 브라우저 데모 결과가
**4종목 모두 일치**한다(헤드리스 Chromium 에서 DOM 값 추출).

| 종목 | NFDS | 판정 | MR | 신호 수(요인 ID) | 축 점수(01/02/03/04) | 일치 |
| --- | --- | --- | --- | --- | --- | --- |
| 005930 삼성전자 | 46.0 | 관찰 | 60.5 (높음) | 2 (2·3) | 85.7 / 41.1 / 0 / 0 | ✅ |
| 000660 SK하이닉스 | 0.0 | 안정 | 47.2 (보통) | 0 | 0 / 0 / 0 / 0 | ✅ |
| 086520 에코프로 | 78.4 | 과열 | 64.9 (높음) | 6 (10·4·8·9·1·3) | 46.2 / 71.6 / 45.1 / 94.3 | ✅ |
| 035420 NAVER | 52.6 | 경계 | 57.9 (높음) | 3 (2·4·3) | 70.1 / 16.1 / 0 / 54.2 | ✅ |

> 백엔드를 그대로 호출하면 기준 시각이 "지금"이라 값이 조금 낮게 나온다(예: 005930 → 34.3).
> 데모는 표본 기준 시각을 고정했기 때문에 46.0 이다. **둘 다 정상**이며, 차이는 최신성 감쇠뿐이다.

### 3.4 화면 검증 (헤드리스 Chromium · 로컬 정적 서버)

| 뷰포트 | 가로 넘침 | 문서 높이 | 콘솔 오류 | 증거 |
| --- | --- | --- | --- | --- |
| 1440×900 | 없음(`scrollWidth 1440`) | 4,417px | 0 | `work/market-intelligence/pkpilot0004-desktop.png` |
| 390×844 | 없음(`390`) | 6,997px | 0 | `work/market-intelligence/pkpilot0004-mobile.png` |
| 320×720 | 없음(`320`) | — | 0 | `work/market-intelligence/adv-m320-top.png` |

- 10선 표는 의도적으로 `.table-wrap` 안에서만 가로 스크롤한다(문서 전체 넘침 없음).
- 확인 항목: 4축→중심→3경로 도해, 종목 분석 카드(NFDS·MR·신호·원칙·출처), 10선 분류표, 투자자 원칙 표.
- 모드 배지(정적 데모/MIXED/LIVE), 표본 기준 시각, 데이터 갭 문장이 실제로 노출됨을 화면으로 확인.
- 스티키 헤더가 앵커 이동 시 제목을 가리지 않도록 `scroll-margin-top` 적용.

### 3.5 API 모드 실측 (로컬 백엔드 · 실제 무료 소스, 2026-11-15 10:40 KST)

| 항목 | 결과 |
| --- | --- |
| `/api/analyze?q=005930` | `mode: mixed`, 현재가 209,000원, NFDS 34.3, MR 43.9, 신호 1건 |
| 소스 상태 | `naver_quote: live` · `news_rss: live` · `opendart: sample`(키 미설정) |
| `/api/analyze?q=000660` | NFDS 45.5, 신호 3건(주주환원·숏스퀴즈·지수편입), 뉴스 링크 실제 연결 |
| CORS | `Origin: http://127.0.0.1:8804` 허용 설정 시 프리플라이트 통과, 페이지에서 응답 수신 |
| 미지 종목 | 404 + suggestions → 화면에 안내 문구와 예시 종목 표시 |
| 데모 초기화 | 저장 키 삭제, 모드 바 "정적 데모 모드" 복귀, 표본 결과 재계산 |

---

## 4. 백엔드 (Server-HQ 이식 대상)

### 4.1 100% 무료 API 구성표

| 소스 | 쓰임 | 엔드포인트 | 발급처 | 무료 한도 | 키 | 2026-11-15 실제 확인 | 폴백 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **OpenDART** | 공시 분류(2·4·9·10번) | `opendart.fss.or.kr/api/list.json`, `corpCode.xml` | opendart.fss.or.kr (이메일 신청) | 개인 키 기준 **일 10,000건**(2020 FAQ) · 이용현황 화면에 20,000 표기 사례 있음 → **발급 후 '오픈API 이용현황'에서 실제 한도 확인 필수**. 초과 시 응답코드 `020` | **필요(40자)** | 미설정 상태에서 `status:"010"(등록되지 않은 키)` 응답 확인 | 표본 공시 + 갭 표시 |
| **네이버 금융 공개 JSON** | 시세·PER/PBR·52주·수급(2·3·8·9번 보조) | `m.stock.naver.com/api/stock/{code}/basic`, `/integration`, `/price?pageSize=60&page=1..2` | 없음(비공식 공개 엔드포인트) | 문서화된 한도 없음 · **비공식이므로 과도 호출 금지** | **불필요** | 3콜로 현재가·PER/PBR·EPS·컨센서스·52주·MA20/60·투자자별 순매수 수신 확인 | Yahoo → 표본 |
| **Yahoo Finance chart** | 해외 종목 시세 | `query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=6mo&interval=1d` | 없음(비공식) | 문서화된 한도 없음 | **불필요** | 동일 IP에서 **HTTP 429(호출 제한)** 관측 → 폴백 경로 검증됨 | 표본/뉴스만 |
| **Google News RSS** | 요인 태깅용 기사(1·4·5·6·7·10번 등) | `news.google.com/rss/search?q=...&hl=ko&gl=KR&ceid=KR:ko` | 없음 | 문서화된 한도 없음, 개인 피드 리더용 약관 | **불필요** | 4축 질의로 삼성전자 기사 153건(중복 제거 후) 수신 | 표본 뉴스 |
| **네이버 뉴스 RSS** | (대체 후보) | `news.naver.com/rss/main.rss` 등 | — | — | — | **302 리다이렉트(HTML) → RSS 아님.** 공식 RSS 미제공으로 판단 | Google News RSS 로 대체 |
| KRX 정보데이터시스템 | 공매도 잔고·지수 구성 | data.krx.co.kr | 회원/약관 | 무료이지만 **자동 수집 약관 검토 필요** | 계정 | 미사용(초안 제외) | 수급 역전 대리 지표 |

> **중요**: "무료"라서 쓰는 것이 아니라, **약관상 자동 수집이 허용되는 범위**에서만 쓴다.
> 네이버·Yahoo 엔드포인트는 공개 웹앱이 쓰는 비공식 API로, 서비스화(공개 트래픽) 전에 약관 검토가 필요하다.
> 8절 Phase 1 의 첫 항목이 이 검토다.

### 4.2 요청 예산 (초안 기준 · 캐시 포함)

| 상황 | 외부 호출 | 비고 |
| --- | --- | --- |
| 최초 `/api/analyze?q=005930` | 네이버 3콜 + 뉴스 4콜 + DART 1~2콜 = **8~9콜** | 실측 3.2초 |
| 같은 종목 재요청(3분 이내) | **0콜** | 분석 캐시 TTL 180초 |
| 다른 종목 5개 조회 | 최대 45콜 | 시세 캐시 120초, 뉴스 캐시 900초, 공시 캐시 3600초 |
| OpenDART 고유번호(corpCode) | **30일에 1회** | 메모리+TTL 캐시 |

캐시 TTL 은 `Settings` 와 커넥터 생성자에서 조정한다. **호출 수를 늘리는 변경은 이 표를 갱신하고
OpenDART 일일 한도(10,000) 대비 사용률을 계산해 남긴다.**

### 4.3 비용 0원 유지 원칙 (위반 시 즉시 롤백)

1. 유료 API·유료 LLM 호출을 **추가하지 않는다**. 태깅은 문자열 매칭 + 규칙이다.
2. 키가 필요한 소스는 **OpenDART 하나뿐**이며, 키는 환경변수/EnvironmentFile 로만 주입한다(코드·프런트·Git 금지).
3. 무료 소스가 죽으면 **유료로 자동 우회하지 않는다.** 표본 폴백 + `data_gaps` 표시가 정답이다.
4. 캐시를 우회하는 실시간 폴링(예: 1분 크론)을 넣지 않는다. 필요하면 소스별 한도와 함께 설계한다.
5. 크롤링 범위를 넓히지 않는다(페이지네이션 무한 루프·상세 페이지 순회 금지).
6. 새 소스를 추가할 때는 **4.1 표에 발급처·한도·키 여부·약관 판단을 먼저 적는다.**

### 4.4 파일 구조

```
PKPilot0004/backend/            (Server-HQ 배포 시 services/market-intelligence/)
├── market_intel/
│   ├── app.py                  ← FastAPI 팩토리 · 라우트 · CORS · 정적 마운트 · root_path
│   ├── service.py              ← 오케스트레이션 · 폴백 · 데이터 갭 · 캐시
│   ├── domain.py               ← 4축·10선·메커니즘·원칙·결론 (문구 정본)
│   ├── signals.py              ← 뉴스/공시/시세 → FactorSignal(강도·근거)
│   ├── scoring.py              ← NFDS·평균회귀·방향·신뢰도·대응원칙
│   ├── samples.py              ← 표본 시세/뉴스/공시 + 종목 사전 + 표시명
│   └── connectors/
│       ├── base.py             ← FetchResponse · Fetcher · TTLCache · 상태값
│       ├── opendart.py         ← corpCode ZIP 파싱 · 공시 목록 · 요인 분류
│       ├── market_data.py      ← 네이버(국내) · Yahoo(해외) 파서
│       └── news_rss.py         ← Google News RSS 파서 · 축별 질의
├── static/                     ← API 단독 확인용 내부 대시보드(공개 프런트는 PKPilot0004 루트)
├── tests/                      ← conftest / domain / connectors / scoring / service / api / cors
├── tools/
│   ├── market-intelligence.service     ← systemd 유닛(하드닝 포함)
│   └── nginx-market-intelligence.conf  ← /market-intel/ 서브패스 + limit_req + 캐시
├── requirements.txt            ← fastapi 0.115.6 · uvicorn · httpx · pytest
├── pytest.ini
└── .env.example
```

> `backend/static/` 은 **서버에서 API 만 따로 확인할 때 쓰는 내부 화면**이다. 방문자에게 보여줄 화면은
> `PKPilot0004/index.html` 이며, 두 화면은 같은 API 계약(`/api/analyze`)을 쓴다.
> 내부 화면을 바꿀 필요가 없으면 그대로 두고, 공개 화면만 고친다.

---

## 5. API 스펙 · CORS 계약 · 데이터 스키마

### 5.1 엔드포인트

| 메서드 | 경로 | 설명 | 응답 |
| --- | --- | --- | --- |
| GET | `/api/health` | 상태·커넥터 준비도·도메인 정합성·허용 출처 | 200 |
| GET | `/api/factors` | 4축·10선·메커니즘·원칙·핵심 결론·면책 | 200 |
| GET | `/api/analyze?q={종목명\|코드\|티커}` | 비재무 요인 분석 | 200 / 400 / 404 |
| GET | `/api/analyze/{ticker}` | 위와 동일(경로형) | 200 / 404 |
| GET | `/api/symbols` | 예시 종목 목록(표시명) | 200 |
| GET | `/api` | 엔드포인트 안내(JSON) | 200 |
| GET | `/` · `/static/*` | 내부 대시보드 HTML · CSS·JS | 200 |

오류 계약

```json
// 400 query_required
{"error":"query_required","message":"q 파라미터에 종목명 또는 티커를 넣어 주세요.","examples":[{"name":"삼성전자","ticker":"005930"}]}
// 404 unknown_symbol
{"error":"unknown_symbol","message":"'없는종목' 종목을 찾지 못했습니다. ...","suggestions":[{"name":"삼성전자","ticker":"005930"}]}
```

`/api/analyze` 응답(축약 · 실제 키 순서와 동일)

```json
{
  "service": "HD2Lab Market Intelligence",
  "version": "0.1.0-draft",
  "generated_at": "2026-11-15T01:40:15+00:00",
  "q": "005930",
  "entity": {"ticker": "005930", "name": "삼성전자", "market": "KOSPI", "currency": "KRW", "source": "naver"},
  "mode": "mixed",
  "quote": {
    "available": true, "price": 209000, "change_pct": 0.48,
    "volume": 21159966, "avg_volume_20d": 18486851.6, "volume_ratio": 1.14,
    "market_cap": "1,221조 8,722억",
    "per": 9.38, "pbr": 2.43, "eps": 22292, "consensus_per": 4.58, "consensus_eps": 45655,
    "high_52w": 380000, "low_52w": 93500, "ma20": 214740.0, "ma60": 244963.33,
    "foreign_net": 8216, "institution_net": -328604, "individual_net": 285654,
    "traded_at": "2026-11-13T20:20:24+09:00", "source": "naver", "source_url": "https://finance.naver.com/..."
  },
  "signals": [
    {
      "factor_id": 2, "name": "행동주의 및 주주환원", "axis_id": "AX01",
      "direction": "split", "direction_label": "▲ 환원 / ▼ 분할",
      "strength": 0.93, "score": 83.7, "sources": ["news", "disclosure"],
      "evidence": [
        {"kind": "news", "title": "...자사주 소각...", "source": "연합뉴스", "date": "2026-11-14T...", "url": "https://news.google.com/...", "match": ["자사주","주주환원"]}
      ],
      "note": ""
    }
  ],
  "scoring": {
    "axes": [{"axis_id":"AX01","name":"지배구조·자본 이벤트","score":0.83,"score_100":83.0,"weight":0.2,"factors":["..."]}],
    "nfds": {"score": 34.3, "weighted": 16.7, "label": "관찰", "message": "...", "direction": {"code":"VOLATILE","label":"▲▼ 양방향 변동성","up":0.42,"down":0.42}},
    "mean_reversion": {"score": 43.9, "level": "보통", "alert": false, "message": "...", "price_position_score": 42.0,
                       "components": {"range_position": 0.40, "ma60_extension": -0.147, "valuation_premium": 1.048},
                       "coverage": 1.0, "notes": []},
    "valuation": {"range_position": 0.40, "ma60_extension": -0.147, "valuation_premium": 1.048, "coverage": 1.0, "notes": []},
    "fundamental": {"status": "ok", "flags": ["후행 PER이 선행 PER보다 높습니다(이익 개선 기대 선반영)."]},
    "principles": {"rows": ["..."], "factor_actions": ["..."], "mean_reversion": "...", "core_conclusion": "...", "disclaimer": "..."},
    "confidence": {"score": 66, "label": "보통", "live_sources": 2, "total_sources": 3}
  },
  "sources": [{"name":"naver_quote","status":"live","reason":"삼성전자 현재가 209,000원","count":1,"source_url":"...","elapsed_ms":410}],
  "data_gaps": ["opendart: OPENDART_API_KEY 미설정 …", "공매도 잔고는 무료 실시간 API 미제공 → 수급 역전으로 대체 추정합니다."],
  "disclaimer": "본 화면은 HD2Lab Market Intelligence 초안이며 ...",
  "sample_as_of": ""
}
```

### 5.2 CORS 계약 (프런트 ↔ 백엔드)

프런트가 `https://hyangdan2.github.io` 에서 `https://hd2lab.duckdns.org/market-intel` 을 부르는 **교차 출처** 요청이다.

| 항목 | 값 |
| --- | --- |
| 미들웨어 | `fastapi.middleware.cors.CORSMiddleware` (`app.py`) |
| 기본 허용 출처 | `https://hyangdan2.github.io` + 로컬(8000·3000·5173·8791·127.0.0.1:8791·127.0.0.1:8000) |
| 덮어쓰기 | `MI_CORS_ORIGINS` (쉼표 구분). 예: `https://hyangdan2.github.io,https://hd2lab.duckdns.org` |
| 허용 메서드 | `GET`, `OPTIONS` |
| 허용 헤더 | `*` · `max_age=600` |
| 쿠키/자격증명 | 사용하지 않는다(`allow_credentials=False`) |
| 확인 | `/api/health` 의 `cors_origins` 배열, `tests/test_cors.py` 4건 |

주의

- **Nginx 에서 `Access-Control-Allow-Origin` 을 또 붙이지 않는다.** 헤더가 중복되면 브라우저가 요청을 막는다.
  CORS 는 애플리케이션 미들웨어 한 곳에서만 낸다.
- 새 출처(예: 커스텀 도메인)를 쓰려면 `MI_CORS_ORIGINS` 만 고친다. 코드 수정은 필요 없다.
- 로컬 정적 서버로 화면을 시험할 때는 그 포트를 허용 목록에 넣는다:
  `MI_CORS_ORIGINS="http://127.0.0.1:8804,http://localhost:8788"`.

### 5.3 데이터 스키마

**Quote** (`connectors/market_data.parse_naver` / `parse_yahoo`)

| 필드 | 타입 | 의미 | 없을 때 |
| --- | --- | --- | --- |
| `ticker` | str | 6자리 코드 또는 해외 티커 | — |
| `name` | str | 종목명 | 티커로 대체 |
| `market`, `currency` | str | KOSPI/KOSDAQ · KRW/USD | "" |
| `price` | float | 현재가 | `quote.available=false` |
| `change_pct` | float | 등락률 | — |
| `volume`, `avg_volume_20d`, `volume_ratio` | float | 거래량·20일 평균·배수 | — |
| `market_cap` | str | 표시용 시총 문자열(예: `1,221조 8,722억`) | — |
| `per`, `pbr`, `eps` | float | 후행 지표 | 해외 종목 없음 |
| `consensus_per`, `consensus_eps` | float | 선행(추정) 지표 | 해외 종목 없음 |
| `high_52w`, `low_52w` | float | 52주 고저 | — |
| `ma20`, `ma60` | float | 단순이동평균 | 이력 부족 시 null |
| `foreign_net`, `institution_net`, `individual_net` | float | 투자자별 순매수(주) | — |
| `traded_at`, `source`, `source_url` | str | 기준 시각·출처 | — |

**FactorSignal** (`signals.FactorSignal`)

| 필드 | 의미 |
| --- | --- |
| `factor_id` | 1~10 |
| `strength` | 0~1 통합 강도 |
| `sources` | `news` / `disclosure` / `market` 중 실제 기여한 출처 |
| `evidence[]` | `{kind,title,source,date,url,match}` 최대 6건(최신순) |
| `note` | 대리 지표 사용 등 주의 문구 |

**SourceStatus** (`ConnectorResult.summary()`)

| 필드 | 의미 |
| --- | --- |
| `name` | `naver_quote` / `yahoo_quote` / `news_rss` / `opendart` |
| `status` | `live` · `sample` · `disabled` · `error` |
| `reason` | 사람이 읽는 사유(키 없음/HTTP 500/건수 등) |
| `count`, `source_url`, `elapsed_ms` | 수집 건수·출처 링크·소요 시간 |

상태 규칙: **`disabled` = 설정이 없어 시도하지 않음, `error` = 시도했지만 실패, `sample` = 표본으로 대체됨.**
세 상태 모두 `data_gaps` 에 문장으로 남는다.

---

## 6. 스코어링 · 평균 회귀 로직

> 아래 수식은 `backend/market_intel/scoring.py`(서버)와 `PKPilot0004/app.js`(데모)에 **같은 계수로** 있다.
> 한쪽을 고치면 반드시 다른 쪽도 고치고 3.3절 검증표를 다시 채운다.

### 6.1 뉴스 신호

```
weighted(article, factor) = recency(article) × (1.0 × 제목 적중 키워드 수 + 0.35 × 요약 적중 키워드 수)
recency(published)        = 0.5 ^ (경과일 / 3)          # 반감기 3일, 파싱 실패 시 0.4
news_strength(factor)     = min(1, ln(1 + Σweighted) / ln(1 + 3))   # 포화점 3.0
```

- 포화점 3.0 = "최근 사흘 안에 제목 3건" 수준이면 강도 1.0. 기사 폭증이 점수를 무한정 올리지 못하게 한다.
- 기사 1건이 여러 요인에 동시 적중할 수 있다(예: "물적분할 주주환원" → 2번). 의도된 동작이다.

### 6.2 공시 신호 (OpenDART)

```
dart_strength(factor) = min(1, ln(1 + Σ recency(rcept_dt)) / ln(1 + 1.5))
recency(rcept_dt)     = 0.5 ^ (경과일 / 10)             # 반감기 10일
```

- 요인 매칭은 `report_nm`(공시 제목)에 `disclosure_terms` 가 포함되는지로 판정한다(`opendart.classify_report`).
- 공시는 "사실"이므로 뉴스보다 출처 가중치가 높다(0.85 vs 0.70).
- **한계**: 제목 기반 매칭이라 `주요사항보고서(자사주취득결정)` 같은 정형 제목에 강하고,
  본문 안에만 언급된 이슈는 놓친다(Phase 1 에서 `document.xml` 본문 파싱으로 확장).

### 6.3 시세 기반 대리 신호 (3·8·9번)

| 요인 | 대리 지표 | 규칙 | 한계 |
| --- | --- | --- | --- |
| 3 지수 편입·리밸런싱 | 거래량 배수 | `volume/avg20 ≥ 1.5` → `min(1,(배수-1)/2)` | 편입/편출 사실 자체는 무료 소스로 확정 불가 |
| 8 숏 스퀴즈 | 수급 역전 | `배수 ≥ 2` & 개인 순매수>0 ≥ 외국인 → `0.45+(배수-2)/4` | **공매도 잔고 데이터 없음 → 대리 추정** |
| 9 무상증자·액면분할 | 고점 근접 | 52주 위치 ≥ 0.9 & 배수 ≥ 1.2 | 공시가 1차 근거, 이 지표는 보조 |

### 6.4 요인 병합 (확률적 OR)

```
strength = 1 - Π(1 - min(0.99, s_i × source_weight_i))
source_weight = {disclosure: 0.85, news: 0.70, market: 0.55}
```

여러 출처가 같은 요인을 가리키면 강도가 올라가되 1을 넘지 않는다. `strength < 0.12` 인 신호는 노이즈로 보고 버린다.

### 6.5 축 점수 → NFDS

```
axis_score(axis) = 1 - Π_{f∈axis} (1 - strength_f × factor_weight_f)     # factor_weight 0.7~1.0
weighted         = Σ_axis (axis_score × axis_weight)                     # 0~1
NFDS             = 100 × weighted ^ 0.6                                  # 감마 보정
```

**감마 0.6의 이유**: 선형 합(`100×weighted`)으로는 축 하나만 강하게 작동할 때 점수가 17점 근처에 머물러
"안정"으로 읽힌다(실제로는 그 요인이 가격을 강하게 흔드는 중). 감마 보정으로 단일 축 강신호를 30점대
("관찰")로 올리고, 4축 전방위 과열은 80~90대로 압축한다. **이 값은 백테스트로 재보정해야 하는 가설값이다.**

실측 예 (2026-11-15 10:40 KST, 실제 무료 소스 · 백엔드 직접 호출):

| 종목 | 축 점수(지배/수급/정치/심리) | weighted | NFDS | 판정 | 신호 수 |
| --- | --- | --- | --- | --- | --- |
| 삼성전자 005930 | 83.0 / 0 / 0 / 0 | 16.6 | **34.3** | 관찰 | 1 |
| SK하이닉스 000660 | — | — | **45.5** | 관찰 | 3 |
| 에코프로 086520 | — | — | **74.4** | 과열 | 6 |
| NAVER 035420 | — | — | **64.1** | 경계 | 5 |
| TSLA (해외) | 0 | 0 | **0.0** | 안정 | 0 |

판정 구간: `≥70 과열 / ≥50 경계 / ≥30 관찰 / <30 안정`.
(같은 표를 표본 기준 시각으로 고정하면 3.3절의 값이 된다 — 데모 화면이 보여주는 숫자다.)

### 6.6 평균 회귀 리스크

세 구성요소를 0~1로 정규화한 뒤 가중 평균하고, 과열 점수와 합성한다.

```
range_position    = (price - low52) / (high52 - low52)                     # 0~1
ma60_extension    = price / ma60 - 1
valuation_premium = per / consensus_per - 1                                # 후행/선행 괴리

norm_ma60 = 0.5 + 0.5·tanh(ma60_extension / 0.20)
norm_per  = 0.5 + 0.5·tanh(valuation_premium / 0.30)

base      = (0.40·range_position + 0.30·norm_ma60 + 0.30·norm_per) / Σ가중치(사용 가능한 항목만)
MR        = 100 × (0.55·base + 0.45·NFDS/100)
```

| MR 점수 | 레벨 | alert | 의미 |
| --- | --- | --- | --- |
| ≥75 | 매우 높음 | true | 이벤트 종료 시 되돌림 폭이 클 수 있는 구간 |
| ≥55 | 높음 | true | 평균 회귀 경보 |
| ≥35 | 보통 | false | 되돌림 가능성은 있으나 경보 아님 |
| <35 | 낮음 | false | 가격이 본질 가치 범위 안 |

- **밸류에이션 항목이 없으면(해외 종목·PER 미제공) 그 항목만 제외**하고 `coverage`(0~1)와 `notes` 에 남긴다.
  없는 값을 0으로 채워 점수를 왜곡하지 않는다.
- MR 은 NFDS 와 **별개 카드**로 표시한다. "지금 뜨겁다(NFDS)"와 "되돌아올 거리가 멀다(MR)"는 다른 질문이다.
  화면 카드 하단에 같은 수식을 한 줄로 노출해 오해를 막는다.

### 6.7 방향 판정과 신뢰도

- 방향: 요인 `direction`(up/down/both/split/reversal)을 강도×요인가중치로 누적해 상방/하방 비중을 낸다.
  우세 비중이 0.6 미만이면 `▲▼ 양방향 변동성`, 총합이 0.05 미만이면 `중립`.
- 신뢰도: `0.6 × (live 소스 비율) + 0.4 × (밸류에이션 확보율)` → 높음(≥70)/보통(≥40)/낮음.
  **실데이터가 아닌 분석은 신뢰도가 자동으로 떨어진다**(데모 모드는 항상 `낮음~보통`).

### 6.8 초안 구현 범위 vs 고도화 과제

| 항목 | 초안 현재 | 고도화 목표 | 방법/근거 |
| --- | --- | --- | --- |
| 공시 분류 | 제목 키워드 매칭 | 본문(`document.xml`)·정형 보고서 필드 파싱 | OpenDART `document.xml`, 무상증자 비율·자사주 수량 추출 |
| 지수 편입/편출 | 거래량 대리 지표 | 실제 편입·편출 이벤트 캘린더 | MSCI/한국거래소 발표문 수동 큐레이션(무료) |
| 공매도 | 수급 역전 추정 | 공매도 잔고·대차 잔고 추이 | KRX 정보데이터시스템 약관 검토 후 한도 내 수집 |
| 정치 테마 | 키워드 | 인물·지역·공약 엔터티 사전 | 소규모 룰 사전 + 수동 검수 |
| 해외 종목 | 시세만 | 밸류에이션·영문 키워드 태깅 | 영문 키워드 사전, 무료 재무 소스 검토 |
| 점수 계수 | 가설값 | 백테스트 보정(사건 후 20/60일 초과수익) | 이벤트 표본 수집 → 로지스틱/그리드 서치 |
| 평가 | 없음 | "요인 신호 발생 → 이후 변동성/회귀" 적중률 리포트 | 일별 스냅샷 저장 필요(Phase 2) |
| 알림 | 없음 | 종목별 NFDS/MR 임계 초과 알림 | Server-HQ 예약 작업 + 메일/푸시 |
| 프런트 | 정적(데모+API) | 스냅샷 이력 차트·관심종목 | Phase 2 API(`/api/history`) 추가 후 |

---

## 7. Server-HQ 운영 배포 가이드

> **전제**: `Server-HQ/AGENTS.md` — *"GitHub 업로드와 서버 배포를 구분한다."*
> 이번 작업은 **PR 만** 올린다. 운영 반영은 별도 승인·검증·복원 계획이 있어야 한다.

### 7.1 배포 전 준비

```sh
# 1) 릴리스 디렉터리(코드)와 데이터 디렉터리를 분리한다.
sudo install -d -o hd2lab-mi -g hd2lab-mi -m 0755 /opt/hd2lab-market-intel/releases
sudo install -d -o hd2lab-mi -g hd2lab-mi -m 0700 /var/lib/hd2lab-market-intel
sudo install -d -o hd2lab-mi -g hd2lab-mi -m 0700 /etc/hd2lab

# 2) 이식본은 HyangDan2.github.io 저장소의 PKPilot0004/backend/ 에 있다.
#    Server-HQ 로 옮길 때는 services/market-intelligence/ 로 배치한다.
sudo -u hd2lab-mi git clone --depth 1 -b <이식-브랜치> \
  https://github.com/HyangDan2/HyangDan2.github.io.git /tmp/webhq
sudo -u hd2lab-mi cp -r /tmp/webhq/PKPilot0004/backend /opt/hd2lab-market-intel/releases/20261115T110000
sudo -u hd2lab-mi python3 -m venv /opt/hd2lab-market-intel/venv
sudo -u hd2lab-mi /opt/hd2lab-market-intel/venv/bin/pip install -r \
  /opt/hd2lab-market-intel/releases/20261115T110000/requirements.txt
sudo -u hd2lab-mi ln -sfn /opt/hd2lab-market-intel/releases/20261115T110000 /opt/hd2lab-market-intel/current

# 3) 환경변수(키는 here-doc 대신 편집기로 넣고 권한을 좁힌다)
sudo install -m 0600 -o root -g hd2lab-mi .env.example /etc/hd2lab/market-intelligence.env
sudoedit /etc/hd2lab/market-intelligence.env      # OPENDART_API_KEY, MI_CORS_ORIGINS 확인
```

### 7.2 실행

```sh
sudo install -m 0644 tools/market-intelligence.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hd2lab-market-intel
systemctl status hd2lab-market-intel --no-pager
curl -s http://127.0.0.1:8791/api/health | python3 -m json.tool
#   → "cors_origins" 에 https://hyangdan2.github.io 가 있는지 확인
```

### 7.3 Nginx 서브패스 (`/market-intel/`)

`tools/nginx-market-intelligence.conf` 를 참고한다. 핵심 4가지:

1. `MI_ROOT_PATH=/market-intel` 로 백엔드를 띄운다. FastAPI `root_path` 는 문서·OpenAPI URL 생성용이며
   **라우팅은 접두사가 제거된 경로**로 매칭된다. 그래서 Nginx 는 항상 접두사를 떼고 넘긴다
   (`proxy_pass http://hd2lab_market_intel/;` 처럼 URI 를 준다).
2. 정규식 location 안에서는 `proxy_pass` 에 URI 를 쓸 수 없다. 캐시가 필요한 경로는
   `location = /market-intel/api/factors`, `location ^~ /market-intel/static/` 처럼 **exact/^~ 로 분리**한다.
   (정규식으로 묶으면 접두사가 남아 404 가 난다 — 이식 전 초안의 예시가 갖고 있던 함정.)
3. `limit_req` 로 **비공식 무료 엔드포인트를 보호**한다(기본 30r/m, burst 20).
4. `/static/`·`/api/factors`·`/api/health` 만 `proxy_cache`(1~5분). **`/api/analyze` 는 캐시하지 않는다**
   (종목별 최신성 + 캐시 키 폭발 방지). CORS 헤더는 앱이 내므로 Nginx 에서 추가하지 않는다.

```sh
sudo nginx -t && sudo systemctl reload nginx
curl -sI https://hd2lab.duckdns.org/market-intel/ | head -5
curl -s https://hd2lab.duckdns.org/market-intel/api/factors | head -c 200
# 교차 출처 확인(브라우저 없이 헤더만 볼 때)
curl -s -D - -o /dev/null -H "Origin: https://hyangdan2.github.io" \
  https://hd2lab.duckdns.org/market-intel/api/health | grep -i access-control
```

### 7.4 프런트 연결 (배포 후 1회)

1. `https://hyangdan2.github.io/PKPilot0004/` 를 연다 → 기본은 **정적 데모**.
2. 헤더 `API 연결` → `https://hd2lab.duckdns.org/market-intel` 입력 → `연결`.
3. `/api/health` 가 응답하면 저장되고 모드 배지가 `LIVE`/`MIXED` 로 바뀐다.
4. 이후 방문은 저장된 주소로 자동 연결한다(초기화는 시트의 `데모로 초기화`).

> 사용자별 설정이라 서버에 저장되지 않는다(localStorage). 공개 기본값을 서버로 두고 싶으면
> `app.js` 의 `storedBase()` 초기값을 상수로 바꾸는 방법이 있으나, **초안에서는 데모 기본**을 유지한다
> (백엔드가 내려가 있을 때 첫 화면이 깨지지 않게 하려는 의도).

### 7.5 운영 확인 체크리스트

배포 직후 실제로 확인하고 `QA.md` 에 시각과 결과를 남긴다.

- [ ] `/market-intel/` HTTP 200, CSS·JS 200(서브패스 누락 404 없음)
- [ ] `/api/health` 에서 `opendart.status` 가 `ready`(키 주입 성공) 또는 `disabled`(의도적)인지 확인
- [ ] `/api/health` 의 `cors_origins` 에 `https://hyangdan2.github.io` 포함
- [ ] `/api/analyze?q=005930` 이 `mode: live|mixed` 로 응답, `sources[]` 에 `live` 존재
- [ ] 브라우저 개발자도구에서 PKPilot0004 → API 호출이 CORS 오류 없이 200
- [ ] 390px·320px 실제 기기에서 가로 스크롤 없음(모바일 실측)
- [ ] 응답 헤더에 `X-Robots-Tag: noindex` 또는 페이지 meta robots 확인
- [ ] 저부하 상태에서 뉴스 4콜 포함 응답 시간 < 6초
- [ ] 로그에 `OPENDART_API_KEY` 값이 찍히지 않음(`journalctl -u hd2lab-market-intel | grep -i key`)

### 7.6 복원 / 롤백

```sh
# 코드 롤백: 심볼릭 링크만 이전 릴리스로 되돌린다(데이터 변경 없음).
sudo ln -sfn /opt/hd2lab-market-intel/releases/<이전_릴리스> /opt/hd2lab-market-intel/current
sudo systemctl restart hd2lab-market-intel

# 완전 제거: 서비스 중지 → 유닛 제거 → 릴리스/데이터 보존 후 삭제
sudo systemctl disable --now hd2lab-market-intel
sudo rm /etc/systemd/system/market-intelligence.service && sudo systemctl daemon-reload
```

이 서비스는 **DB가 없다**(요청 시 계산 + 메모리 캐시). 따라서 복원 난이도가 낮고 사용자 데이터 손실 위험이 없다.
프런트 롤백은 GitHub 에서 PR 을 revert 하거나 이전 커밋으로 되돌리면 끝난다(정적 파일).

### 7.7 보안 주의사항

| 위험 | 대응 |
| --- | --- |
| API 키 노출 | 키는 EnvironmentFile(0600)만. `/api/health` 는 키의 **존재 여부**만 노출하고 값은 절대 반환하지 않는다 |
| 외부 문자열 XSS | 뉴스 제목·공시명은 전부 `textContent` 로 삽입. `innerHTML` 사용 금지(코드에 없음) |
| 외부 콘텐츠 지시문 | 기사 본문은 **데이터**다. 요약/태깅 외 용도로 해석하지 않는다 |
| 무료 소스 과호출 | TTL 캐시 + `limit_req` + 캐시 가능 경로 분리. 크론 폴링 금지 |
| SSRF | 커넥터는 **고정 URL 템플릿**만 호출한다. 사용자 입력은 종목코드/티커 정규화 후 경로에만 쓰고, 임의 URL 을 받지 않는다 |
| CORS 남용 | 허용 출처를 명시 목록으로 관리(`MI_CORS_ORIGINS`). `*` 를 쓰지 않는다 |
| 개인정보 | 수집하지 않는다. 로그인·쿠키·추적 없음. 프런트는 `localStorage` 에 API 주소만 저장 |
| 오해 방지 | 모든 응답에 `disclaimer`, 화면 상단 `DRAFT` 배지, `mode`/`sample` 배지, MR 카드에 수식 표기 |
| 검색 노출 | 초안이므로 `robots: noindex` + (배포 시) `X-Robots-Tag` |

---

## 8. 안티그라비티 후속 작업 로드맵 (Phase 1~3)

### Phase 1 — 실데이터 완성 · 법적/약관 정리 (권장 1주)

| # | 작업 | 산출물 | 완료 조건 |
| --- | --- | --- | --- |
| 1.1 | **무료 소스 약관 검토**(네이버 금융 JSON, Yahoo chart, Google News RSS) | `docs/MARKET_INTEL_SOURCE_TERMS.md` | 소스별 "자동 수집 허용/금지/제한" 결론 + 대체안 |
| 1.2 | OpenDART 키 발급·주입, 실제 공시 태깅 확인 | `/api/health` `opendart: ready`, 실공시 evidence | 005930·086520 에서 실공시 근거 1건 이상 표시 |
| 1.3 | 공시 상세 분류 고도화 | `opendart.py` 확장 | 무상증자 비율·자사주 수량을 evidence 에 숫자로 표시 |
| 1.4 | 해외 종목 대응(영문 키워드 사전) | `domain.py`·`app.js` `keywords_en` | TSLA 에서 신호 ≥1건, `data_gaps` 에서 "키워드 없음" 해소 |
| 1.5 | 파일 캐시(선택) | `connectors/cache_file.py` | 재시작 후에도 뉴스 캐시 유지, `/var/lib` 밖 저장 금지 |
| 1.6 | Server-HQ 이식 PR | `Server-HQ/services/market-intelligence/` | `pytest` 61개 통과 + 7.5 체크리스트 |
| 1.7 | 프런트 PR 검토 반영 | `PKPilot0004/` 수정 커밋 | 사용자 확인 후 `main` 머지 → Pages 반영·실기기 확인 |

### Phase 2 — 평가·백테스트·알림 (권장 2~3주)

| # | 작업 | 산출물 | 완료 조건 |
| --- | --- | --- | --- |
| 2.1 | 일별 스냅샷 저장(SQLite, `/var/lib/hd2lab-market-intel`) | 스키마 0001 + 수집기 | 종목·일자·NFDS·MR·신호 JSON 이력 |
| 2.2 | 사건 후 성과 측정 | `tools/evaluate.py` | "신호 발생 후 5/20/60일 초과수익·변동성" 리포트 |
| 2.3 | 계수 보정 | `scoring.py` 상수 테이블화 | 백테스트 근거로 축 가중치·감마·임계값 재설정 |
| 2.4 | 공매도 잔고 연동(약관 허용 시) | `connectors/short_balance.py` | 8번 신호가 대리 지표가 아닌 실데이터 기반 |
| 2.5 | 임계 초과 알림 | Server-HQ 예약 작업 + 메일 | 관심 종목 NFDS/MR 임계 초과 시 1일 1회 요약 |
| 2.6 | 프런트 이력 화면 | `PKPilot0004` 차트 탭 | `/api/history` 로 NFDS/MR 추이 표시 |
| 2.7 | 백업/복원 절차 | `docs` + 스크립트 | 스냅샷 DB 백업·복원 리허설 통과 |

### Phase 3 — 제품화 (권장 2~3주)

| # | 작업 | 산출물 | 완료 조건 |
| --- | --- | --- | --- |
| 3.1 | ApplicationHub 등록 | `ApplicationHub` 카드 항목 | 06번 앱으로 등록 + `/PKPilot0004/` 연결 |
| 3.2 | 관리자 화면(공통 SSO) | `/admin/market-intel/` 뷰 | 키 상태·캐시 적중률·소스별 실패율 확인 |
| 3.3 | 관측성 | `/api/health` 확장 + 로그 포맷 | 소스별 p95 지연·실패율 7일 추이 |
| 3.4 | 브랜딩 정리 | OG 1200×630 + 정식 `LOGO.png` 규격 | 좌상단 100px 정식 로고 + `62px HD2Lab \| Market Intelligence`, 카카오 디버거 재수집 확인 |
| 3.5 | 면책·정책 고지 | `PRIVACY`/`TERMS` 섹션 | "투자자문 아님" 문구가 화면·API 양쪽에 존재 |

### 인수인계 체크리스트

- [ ] `domain.py` 문구가 원본 브리프와 일치하는지 대조(수정 시 `tests/test_domain.py` 통과)
- [ ] `pytest` 61개 통과 상태에서 시작
- [ ] 스코어링 상수 변경 시 **`scoring.py` + `app.js` + 이 문서 6절 + 3.3 검증표**를 같은 커밋에서 갱신
- [ ] 새 소스 추가 시 4.1 표 + 4.3 원칙 + `tests/test_connectors.py` 를 함께 갱신
- [ ] CORS 출처를 바꾸면 `MI_CORS_ORIGINS` 와 `tests/test_cors.py` 를 함께 갱신
- [ ] 운영 반영은 별도 승인 절차(7절)로만

---

## 부록 A. 로컬 실행

### A.1 프런트(정적 · 데모 확인)

```sh
cd PKPilot0004
python3 -m http.server 8804 --bind 127.0.0.1
# 브라우저: http://127.0.0.1:8804/
```

### A.2 백엔드

```sh
cd PKPilot0004/backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# 표본 모드(네트워크 없이 화면 확인)
MI_OFFLINE=1 .venv/bin/python -m uvicorn market_intel.app:create_app --factory --host 127.0.0.1 --port 8791

# 실데이터 모드
OPENDART_API_KEY=<40자리 키> .venv/bin/python -m uvicorn market_intel.app:create_app --factory --host 127.0.0.1 --port 8791

.venv/bin/python -m pytest -q
```

### A.3 프런트 + 백엔드 연결 확인

```sh
# 로컬 정적 서버 출처를 CORS 에 허용한 뒤 백엔드를 띄운다.
MI_CORS_ORIGINS="http://127.0.0.1:8804,http://127.0.0.1:8791" \
  .venv/bin/python -m uvicorn market_intel.app:create_app --factory --host 127.0.0.1 --port 8791
# 브라우저: http://127.0.0.1:8804/?api=http://127.0.0.1:8791
```

## 부록 B. 테스트 인벤토리 (61개 · 네트워크 미사용)

| 파일 | 검증 내용 |
| --- | --- |
| `test_domain.py` (8) | 10선·4축 매핑, 원문 문구, 표시 순서, 가중치 합, 손상된 매핑 탐지 |
| `test_connectors.py` (16) | 한국어 단위 파싱, RSS 파싱/중복 제거/실패 보고, 네이버 3종 병합·캐시, Yahoo 파싱, OpenDART ZIP·분류·키 없음, TTL 만료 |
| `test_scoring.py` (14) | NFDS 단조성·감마 구간, 축 배분, 방향 판정, 밸류에이션 결측 처리, MR 경보, 원칙 선택, 신뢰도 |
| `test_service.py` (9) | live/mixed/sample 전환, 오프라인 무호출, 분석 캐시, 종목 해석, 해외 티커 갭, corpCode 재사용 |
| `test_api.py` (10) | health/factors/analyze(200·400·404)/symbols/정적 자산 |
| `test_cors.py` (4) | Pages 오리진 허용, 프리플라이트, 미허용 오리진 차단, `/api/health` 의 허용 출처 목록 |

모든 테스트는 **네트워크를 쓰지 않는다**(`FakeFetcher` 주입 · `offline=True`).
실행 결과: **61 passed** (2026-11-15).

## 부록 C. 알려진 한계 (2026-11-15 기준)

1. **야후 429**: 동일 IP에서 반복 호출 시 제한. 해외 종목은 표본/뉴스만 남는다.
2. **네이버 뉴스 RSS 부재**: 302 → HTML. 공식 RSS 미제공으로 판단, Google News RSS 로 대체.
3. **공매도 잔고 미연동**: 무료 실시간 API 없음 → 수급 역전 대리 지표(화면·응답에 명시).
4. **해외 종목 태깅 공백**: 키워드 사전이 한국어 중심이라 TSLA 는 신호 0건.
5. **지수 편입/편출 사실 미확정**: 거래량 대리 지표만 사용.
6. **점수 계수 미검증**: 백테스트 전 가설값.
7. **데모 표본은 4종목**: 삼성전자·SK하이닉스·에코프로·NAVER. 그 외 종목은 API 연결이 필요하다(데모에서 안내).
8. **데모 기준 시각 고정**: 실제 현재 시각이 아니므로 최신 뉴스가 아니다. 화면에 표본 기준 시각을 항상 표기한다.
9. **프런트 도메인 문구 이중화**: `domain.py` 와 `app.js` 두 곳에 같은 문구가 있다. 문구 변경 시 같은 커밋에서 동기화해야 한다.
10. **OG 미구성**: 초안은 `noindex` 이며 소셜 썸네일이 없다(Phase 3).
