/* ============================================================================
   HD2Lab Market Intelligence · PKPilot0004
   Standalone dashboard.

   두 가지 모드로 동작한다.
   1) 정적 데모  — 이 파일에 내장한 표본 데이터 + 백엔드(market_intel)와 같은
                   스코어링 규칙을 브라우저에서 그대로 계산한다. 네트워크 0회.
   2) API 모드  — 설정한 API Base URL 로 /api/analyze 를 호출한다.
                   응답 스키마는 데모 계산 결과와 동일해서 렌더러가 하나다.

   외부 문자열(뉴스 제목·공시명)은 전부 textContent 로만 넣는다. innerHTML 금지.
   ==========================================================================*/
(function () {
  "use strict";

  var VERSION = "0.1.0-draft";
  var SERVICE = "HD2Lab Market Intelligence";
  var BRIEF_TITLE = "기업 본질 가치와 무관한 경제 외적 주가 변동 요인 10선";
  var DEMO_AS_OF = "2026-11-13T15:30:00+09:00";
  var STORE_KEY = "hd2lab.mi.apiBase";
  var CORE_CONCLUSION =
    "경제 외적 요인은 단기 주가에 강력한 모멘텀과 변동성을 제공하지만, " +
    "기업의 본질적 이익 창출 능력이 뒷받침되지 않을 경우 이벤트 종료와 함께 " +
    "원래의 내재 가치로 회귀(Mean Reversion)하는 특성을 보인다.";
  var DISCLAIMER =
    "본 화면은 HD2Lab Market Intelligence 초안이며 특정 종목의 매수·매도 추천이 아닙니다. " +
    "점수는 공개 데이터 기반 휴리스틱으로 산출되며 투자 판단의 근거로 사용할 수 없습니다.";

  /* ── 4대 축 ─────────────────────────────────────────────────────────── */
  var AXES = [
    {
      id: "AX01", name: "지배구조·자본 이벤트", factor_ids: [2, 9], weight: 0.20,
      summary: "주식 수·지분 구조·주주환원 정책처럼 기업의 자본 구조에서 직접 나오는 이벤트.",
      watch: "공시(OpenDART) 원문이 1차 근거이며, 뉴스보다 공시 접수 시각이 먼저다."
    },
    {
      id: "AX02", name: "수급·시장 구조 요인", factor_ids: [3, 8], weight: 0.25,
      summary: "지수 편출입·패시브 자금·공매도 잔고처럼 가격을 만드는 기계적 매매 구조.",
      watch: "거래량·거래대금 급증과 외국인/기관 순매수 방향으로 확인한다."
    },
    {
      id: "AX03", name: "정치·외부 환경 충격", factor_ids: [1, 6, 7], weight: 0.25,
      summary: "정치 테마, 지정학 갈등, 재난·감염병처럼 기업 외부에서 오는 충격.",
      watch: "뉴스 빈도와 확산 속도가 핵심이며, 업종 단위 수혜/피해로 갈린다."
    },
    {
      id: "AX04", name: "심리·평판·정보 확산", factor_ids: [4, 5, 10], weight: 0.30,
      summary: "평판·신뢰 훼손과 미확인 정보의 확산이 만드는 기대와 공포.",
      watch: "출처 신뢰도가 낮을수록 강도는 세고 수명은 짧다. 공시로 반증되는지가 관건."
    }
  ];

  /* ── 10가지 요인 (브리프 분류표 원문) ─────────────────────────────────── */
  var FACTORS = [
    {
      id: 2, name: "행동주의 및 주주환원", axis_id: "AX01",
      mechanism: "행동주의 펀드 개입, 자사주 소각·배당 확대 요구 및 물적분할 이슈",
      direction: "split", direction_label: "▲ 환원 / ▼ 분할", outcomes: ["up", "down"], weight: 0.9,
      keywords: ["행동주의", "주주환원", "자사주", "자사주 소각", "배당 확대", "물적분할", "주주제안", "의결권", "주주총회", "얼라인", "밸류업", "주주행동"],
      disclosure_terms: ["자사주", "주주환원", "물적분할", "배당", "주주제안", "대량보유"],
      sources: ["opendart", "news_rss"]
    },
    {
      id: 9, name: "무상증자 및 액면분할", axis_id: "AX01",
      mechanism: "시총 변화 없는 주식 수 증가로 유동성 개선 및 저가 착시 효과 발생",
      direction: "up", direction_label: "▲ 단기 급등", outcomes: ["up"], weight: 0.85,
      keywords: ["무상증자", "액면분할", "액면병합", "주식분할", "유동성 개선", "감자"],
      disclosure_terms: ["무상증자", "액면분할", "액면병합", "주식분할", "감자"],
      sources: ["opendart"]
    },
    {
      id: 3, name: "주가지수 편입·리밸런싱", axis_id: "AX02",
      mechanism: "MSCI·코스피200 등 지수 편출입에 따른 패시브 자금의 기계적 매매",
      direction: "split", direction_label: "▲ 편입 / ▼ 편출", outcomes: ["up", "down"], weight: 0.8,
      keywords: ["지수 편입", "지수 편출", "리밸런싱", "MSCI", "코스피200", "코스닥150", "패시브", "ETF 편입"],
      disclosure_terms: [],
      sources: ["news_rss", "market_data"]
    },
    {
      id: 8, name: "공매도 숏 스퀴즈", axis_id: "AX02",
      mechanism: "과도한 공매도 누적 종목에 개인 매수세 결집 시 기관의 강제 쇼트커버링",
      direction: "up", direction_label: "▲ 폭등 연출", outcomes: ["up"], weight: 0.9,
      keywords: ["공매도", "숏 스퀴즈", "쇼트커버링", "대차거래", "공매도 잔고", "숏커버", "공매도 금지"],
      disclosure_terms: ["공매도"],
      sources: ["news_rss", "market_data"]
    },
    {
      id: 1, name: "정치 및 선거 테마", axis_id: "AX03",
      mechanism: "유력 정치인 인맥(학연·지연) 및 선거 공약 수혜주로 분류되어 변동성 확대",
      direction: "both", direction_label: "▲▼ 극심한 변동", outcomes: ["up", "down"], weight: 0.85,
      keywords: ["정치 테마", "선거", "대선", "총선", "공약", "수혜주", "인맥", "친노", "친이", "지역구", "정부 정책"],
      disclosure_terms: [],
      sources: ["news_rss"]
    },
    {
      id: 6, name: "지정학적 갈등·안보 위기", axis_id: "AX03",
      mechanism: "국지전·무역보복 등 정세 급변 시 위험 회피 및 방산·보안주 반사이익",
      direction: "split", direction_label: "▲ 수혜 / ▼ 시장", outcomes: ["up", "down"], weight: 0.9,
      keywords: ["지정학", "전쟁", "무역분쟁", "관세", "수출통제", "제재", "안보", "미사일", "방산", "중동", "러시아", "대만"],
      disclosure_terms: [],
      sources: ["news_rss"]
    },
    {
      id: 7, name: "자연재해 및 전염병 확산", axis_id: "AX03",
      mechanism: "재난·이상기후·감염병 발생 시 피해 업종 하락 및 복구·제약·비대면 수혜",
      direction: "split", direction_label: "▲ 수혜 / ▼ 피해", outcomes: ["up", "down"], weight: 0.75,
      keywords: ["지진", "태풍", "홍수", "산불", "가뭄", "감염병", "전염병", "팬데믹", "독감", "조류인플루엔자", "메르스", "엘니뇨"],
      disclosure_terms: [],
      sources: ["news_rss"]
    },
    {
      id: 4, name: "경영진 사법·도덕적 리스크", axis_id: "AX04",
      mechanism: "오너 횡령·배임·분식회계·일탈 보도로 거래정지 우려 및 불매운동 확산",
      direction: "down", direction_label: "▼ 급락·폭락", outcomes: ["down"], weight: 1.0,
      keywords: ["횡령", "배임", "분식회계", "구속", "기소", "검찰", "재판", "거래정지", "불매운동", "사법리스크", "탈세", "경영권 분쟁"],
      disclosure_terms: ["횡령", "배임", "조회공시", "거래정지", "불성실공시"],
      sources: ["opendart", "news_rss"]
    },
    {
      id: 5, name: "유명 인사·미디어 노출", axis_id: "AX04",
      mechanism: "글로벌 기업가·셀럽의 특정 기업·제품 언급 및 사용 노출에 따른 매수 쏠림",
      direction: "up", direction_label: "▲ 단기 급등", outcomes: ["up"], weight: 0.7,
      keywords: ["일론 머스크", "머스크 언급", "셀럽", "연예인 사용", "SNS 언급", "트윗", "방문 인증", "품절 대란", "입소문"],
      disclosure_terms: [],
      sources: ["news_rss"]
    },
    {
      id: 10, name: "커뮤니티·SNS발 루머", axis_id: "AX04",
      mechanism: "미확인 M&A·신약·부도설 유포로 선취매 유입 후 사실무근 공시 시 원위치",
      direction: "reversal", direction_label: "▲▼ 급등락 회귀", outcomes: ["up", "down", "reversal"], weight: 1.0,
      keywords: ["루머", "풍문", "카더라", "찌라시", "M&A설", "인수설", "신약 기대", "부도설", "사실무근", "조회공시", "미확인"],
      disclosure_terms: ["조회공시", "풍문", "보도해명", "사실무근"],
      sources: ["news_rss", "opendart"]
    }
  ];

  var DISPLAY_ORDER = [2, 9, 3, 8, 1, 6, 7, 4, 5, 10];
  var FACTOR_BY_ID = {};
  var AXIS_BY_ID = {};
  FACTORS.forEach(function (f) { FACTOR_BY_ID[f.id] = f; });
  AXES.forEach(function (a) { AXIS_BY_ID[a.id] = a; });

  var MECHANISM = {
    center: "단기 수급 불균형 및 비이성적 기대·공포 증폭",
    outcomes: [
      { id: "UP", label: "▲ 단기 급등", detail: "테마·촉커버·수급", note: "재료 소멸 시 차익실현 매물 출회", tone: "up" },
      { id: "DOWN", label: "▼ 단기 급락", detail: "리스크·강제 매도", note: "불확실성 해소 전까지 투심 냉각", tone: "down" },
      { id: "REVERSION", label: "↺ 평균 회귀", detail: "실적 뒷받침 시 본질 가치로 복귀", note: "이벤트 종료 후 내재 가치 회귀", tone: "neutral" }
    ]
  };

  var INVESTOR_PRINCIPLES = [
    { type: "비재무적 상승 요인", trigger: "수급 쏠림, 이벤트성 기대감, 테마 형성에 의한 단기 과열", action: "재료 소멸 시 급격한 차익실현 매물 출회 가능성 경계", tone: "up" },
    { type: "비재무적 하락 요인", trigger: "신뢰도 훼손, 불확실성 증대, 기계적·강제적 매도 물량 출회", action: "단순 낙폭 과대 인식보다 실제 펀더멘털 훼손 여부 검증", tone: "down" }
  ];

  var FACTOR_ACTIONS = {
    2: "주주환원은 발표와 이행이 다릅니다. 자사주 소각 시점·수량 공시를 확인하고, 발표만으로 가격이 먼저 반영됐는지 봅니다.",
    9: "무상증자·액면분할은 시가총액을 늘리지 않습니다. 권리락 이후 가격 조정을 급등으로 오독하지 않습니다.",
    3: "지수 편입·편출은 발효일과 패시브 매매 마감일이 정해져 있습니다. 발효 후 수급은 되돌아오는 경우가 많습니다.",
    8: "공매도 잔고비율과 대차 상환 물량을 확인하기 전에는 숏 스퀴즈로 단정하지 않습니다.",
    1: "정치 테마는 공약의 실제 예산·법안 반영 여부와 무관하게 먼저 움직입니다. 실행 근거를 따로 확인합니다.",
    6: "같은 사건이 수혜 업종(방산·보안)과 피해 업종을 동시에 만듭니다. 우리 종목이 어느 쪽인지 먼저 구분합니다.",
    7: "재난 규모·복구 기간·기업의 실제 노출도를 확인합니다. 테마 확산과 매출 영향은 다릅니다.",
    4: "거래정지·소송 진행은 공시로 확인합니다. 평판 악화와 이익 창출력 훼손은 같은 사건에서도 다르게 나타납니다.",
    5: "노출의 지속성과 실제 매출 연결 여부를 확인합니다. 대부분의 노출 효과는 며칠 안에 소멸합니다.",
    10: "미확인 정보는 조회공시 답변으로 확인합니다. 사실무근 공시가 나오면 급등분이 그대로 반납될 수 있습니다."
  };

  var DRIFT_LABELS = [
    [70, "과열", "재료 소멸 시 차익실현 매물 출회 가능성이 큰 구간입니다."],
    [50, "경계", "수급·기대가 가격을 앞서고 있습니다. 재료의 지속성을 확인해야 합니다."],
    [30, "관찰", "일부 비재무 요인이 작동하지만 가격 영향은 제한적입니다."],
    [0, "안정", "비재무 요인 신호가 약합니다."]
  ];

  var MR_LEVELS = [
    [75, "매우 높음", true, "이벤트 종료 시 되돌림 폭이 클 수 있는 구간입니다."],
    [55, "높음", true, "평균 회귀 경보: 상승 재료의 수명과 실적 뒷받침을 함께 확인해야 합니다."],
    [35, "보통", false, "되돌림 가능성은 있으나 아직 경보 수준은 아닙니다."],
    [0, "낮음", false, "가격이 본질 가치 범위 안에 있는 것으로 계산됩니다."]
  ];

  /* ── 표본 데이터 (백엔드 market_intel/samples.py 와 동일) ─────────────── */
  var SYMBOL_REGISTRY = {
    "삼성전자": "005930", "samsung": "005930", "samsung electronics": "005930",
    "sk하이닉스": "000660", "하이닉스": "000660", "hynix": "000660",
    "에코프로": "086520", "에코프로비엠": "247540",
    "naver": "035420", "네이버": "035420",
    "카카오": "035720",
    "현대차": "005380", "현대자동차": "005380",
    "lg에너지솔루션": "373220",
    "삼성바이오로직스": "207940",
    "셀트리온": "068270",
    "포스코홀딩스": "005490", "posco": "005490",
    "kb금융": "105560",
    "신한지주": "055550",
    "두산에너빌리티": "034020",
    "한화에어로스페이스": "012450",
    "hd현대중공업": "329180",
    "엔씨소프트": "036570"
  };

  var SAMPLE_QUOTES = {
    "005930": {
      ticker: "005930", name: "삼성전자", market: "KOSPI", currency: "KRW",
      price: 209000, change_pct: 0.48, volume: 21159966, avg_volume_20d: 14200000,
      market_cap: "1,221조 8,722억", per: 9.38, pbr: 2.43, eps: 22292,
      consensus_per: 4.58, consensus_eps: 45655, high_52w: 380000, low_52w: 93500,
      ma20: 196400, ma60: 174800, foreign_net: 8216, institution_net: -328604,
      individual_net: 285654, traded_at: DEMO_AS_OF, source: "sample",
      source_url: "https://finance.naver.com/item/main.naver?code=005930"
    },
    "000660": {
      ticker: "000660", name: "SK하이닉스", market: "KOSPI", currency: "KRW",
      price: 412500, change_pct: -1.32, volume: 6840000, avg_volume_20d: 5120000,
      market_cap: "300조 1,200억", per: 6.10, pbr: 1.85, eps: 67623,
      consensus_per: 5.02, consensus_eps: 82171, high_52w: 448000, low_52w: 168500,
      ma20: 398200, ma60: 341000, foreign_net: -412000, institution_net: 118000,
      individual_net: 294000, traded_at: DEMO_AS_OF, source: "sample",
      source_url: "https://finance.naver.com/item/main.naver?code=000660"
    },
    "086520": {
      ticker: "086520", name: "에코프로", market: "KOSDAQ", currency: "KRW",
      price: 74800, change_pct: 12.45, volume: 9630000, avg_volume_20d: 2210000,
      market_cap: "9조 9,600억", per: 41.2, pbr: 3.11, eps: 1815,
      consensus_per: 28.4, consensus_eps: 2633, high_52w: 158000, low_52w: 61500,
      ma20: 66800, ma60: 70200, foreign_net: 128000, institution_net: -96000,
      individual_net: -32000, traded_at: DEMO_AS_OF, source: "sample",
      source_url: "https://finance.naver.com/item/main.naver?code=086520"
    },
    "035420": {
      ticker: "035420", name: "NAVER", market: "KOSPI", currency: "KRW",
      price: 241000, change_pct: -3.60, volume: 3150000, avg_volume_20d: 1820000,
      market_cap: "38조 4,300억", per: 18.7, pbr: 1.24, eps: 12890,
      consensus_per: 15.9, consensus_eps: 15157, high_52w: 292000, low_52w: 168000,
      ma20: 249600, ma60: 238400, foreign_net: -218000, institution_net: -74000,
      individual_net: 292000, traded_at: DEMO_AS_OF, source: "sample",
      source_url: "https://finance.naver.com/item/main.naver?code=035420"
    }
  };

  var SAMPLE_NEWS = {
    "005930": [
      { title: "삼성전자, 3분기 확정 실적 발표…메모리 가격 반등에 영업익 개선", source: "표본 통신", published: "2026-11-13T09:10:00+09:00", link: "" },
      { title: "\"삼성전자 주주환원 확대\" 행동주의 펀드, 자사주 소각·배당 확대 공개 요구", source: "표본 경제지", published: "2026-11-12T18:40:00+09:00", link: "" },
      { title: "코스피200 정기변경 앞두고 지수 편입 종목 리밸런싱 매매 집중", source: "표본 마켓", published: "2026-11-11T08:20:00+09:00", link: "" }
    ],
    "000660": [
      { title: "SK하이닉스, HBM 증설 발표…외국인 순매수 이어져", source: "표본 통신", published: "2026-11-13T10:05:00+09:00", link: "" }
    ],
    "086520": [
      { title: "에코프로 관련 M&A설 확산…커뮤니티발 루머에 선취매 유입", source: "표본 경제지", published: "2026-11-14T21:30:00+09:00", link: "" },
      { title: "에코프로, 거래량 급증 속 개인 매수세 결집…공매도 잔고 부담 확대", source: "표본 마켓", published: "2026-11-13T13:15:00+09:00", link: "" },
      { title: "2차전지 테마 재점화, 정치권 공약 수혜주로 분류되며 변동성 확대", source: "표본 정치부", published: "2026-11-13T07:50:00+09:00", link: "" }
    ],
    "035420": [
      { title: "NAVER, 물적분할 추진 보도에 주주환원 축소 우려…단체 행동 예고", source: "표본 경제지", published: "2026-11-12T16:05:00+09:00", link: "" },
      { title: "정보보호 사고 책임론 확산…거래정지 우려에 불매운동 조짐", source: "표본 통신", published: "2026-11-13T11:25:00+09:00", link: "" }
    ]
  };

  var SAMPLE_DISCLOSURES = {
    "005930": [
      { report_nm: "주요사항보고서(자사주취득결정)", corp_name: "삼성전자", rcept_dt: "2026-11-12", url: "" },
      { report_nm: "주요사항보고서(물적분할결정)", corp_name: "삼성전자", rcept_dt: "2026-11-05", url: "" }
    ],
    "086520": [
      { report_nm: "주요사항보고서(무상증자결정)", corp_name: "에코프로", rcept_dt: "2026-11-10", url: "" },
      { report_nm: "조회공시요구(풍문또는보도)에대한답변(미확인)", corp_name: "에코프로", rcept_dt: "2026-11-14", url: "" }
    ],
    "035420": [
      { report_nm: "주요사항보고서(물적분할결정)", corp_name: "NAVER", rcept_dt: "2026-11-11", url: "" }
    ],
    "000660": []
  };

  var EXAMPLES = [
    { name: "삼성전자", ticker: "005930" },
    { name: "SK하이닉스", ticker: "000660" },
    { name: "에코프로", ticker: "086520" },
    { name: "NAVER", ticker: "035420" },
    { name: "카카오", ticker: "035720" },
    { name: "현대차", ticker: "005380" }
  ];
  var DEMO_TICKERS = ["005930", "000660", "086520", "035420"];
  var SOURCE_LABELS = { naver_quote: "네이버 금융", yahoo_quote: "Yahoo Finance", news_rss: "Google News RSS", opendart: "OpenDART" };
  var SOURCE_WEIGHT = { disclosure: 0.85, news: 0.70, market: 0.55 };
  var NFDS_GAMMA = 0.6;

  /* ── helpers ────────────────────────────────────────────────────────── */
  var $ = function (id) { return document.getElementById(id); };
  function round(value, digits) {
    var f = Math.pow(10, digits || 0);
    return Math.round((Number(value) + (Number(value) >= 0 ? 1e-12 : -1e-12)) * f) / f;
  }
  function clamp(value, low, high) {
    low = low === undefined ? 0 : low; high = high === undefined ? 1 : high;
    return Math.max(low, Math.min(high, value));
  }
  function num(value) {
    if (value === null || value === undefined || value === "") return "—";
    var n = Number(value);
    if (!isFinite(n)) return String(value);
    return n.toLocaleString("ko-KR");
  }
  function pct(value, digits) {
    if (value === null || value === undefined) return "—";
    var n = Number(value);
    if (!isFinite(n)) return "—";
    return (n > 0 ? "+" : "") + n.toFixed(digits === undefined ? 2 : digits) + "%";
  }
  function compact(value) {
    if (value === null || value === undefined) return "—";
    var n = Number(value);
    if (!isFinite(n)) return "—";
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1).replace(/\.0$/, "") + "조";
    if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, "") + "억";
    if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, "") + "만";
    return num(n);
  }
  function won(value, currency) {
    if (value === null || value === undefined) return "—";
    return currency === "USD"
      ? "$" + Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })
      : num(value) + "원";
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  /* ── 날짜 유틸 (백엔드 _parse_dt / recency_weight 대응) ──────────────── */
  function parseDate(value) {
    if (!value) return null;
    var text = String(value).trim();
    var direct = new Date(text.replace("Z", "+00:00"));
    if (!isNaN(direct.getTime())) return direct;
    var m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(text);
    if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return null;
  }
  function newsRecency(published, now, halfLife) {
    var dt = parseDate(published);
    if (!dt) return 0.4;
    var age = Math.max(0, (now.getTime() - dt.getTime()) / 86400000);
    return Math.pow(0.5, age / (halfLife || 3));
  }
  function disclosureRecency(rceptDt, now, halfLife) {
    var dt = parseDate(rceptDt);
    if (!dt) return 0;
    var age = Math.max(0, (now.getTime() - dt.getTime()) / 86400000);
    return Math.pow(0.5, age / (halfLife || 10));
  }

  /* ── 신호 태깅 (signals.py 대응) ─────────────────────────────────────── */
  function tagArticles(articles, now) {
    var result = {};
    (articles || []).forEach(function (article) {
      var title = article.title || "";
      var summary = article.summary || "";
      var weight = newsRecency(article.published || "", now);
      FACTORS.forEach(function (factor) {
        var matched = factor.keywords.filter(function (kw) { return kw && title.indexOf(kw) >= 0; });
        var weak = factor.keywords.filter(function (kw) { return kw && matched.indexOf(kw) < 0 && summary.indexOf(kw) >= 0; });
        if (!matched.length && !weak.length) return;
        var score = weight * (matched.length + 0.35 * weak.length);
        var entry = result[factor.id] || { weighted: 0, evidence: [] };
        entry.weighted += score;
        entry.evidence.push({
          kind: "news", title: title, source: article.source || "",
          date: article.published || "", url: article.link || "", match: matched.concat(weak).slice(0, 6)
        });
        result[factor.id] = entry;
      });
    });
    return result;
  }

  function tagDisclosures(disclosures, now) {
    var result = {};
    (disclosures || []).forEach(function (row) {
      var report = row.report_nm || "";
      if (!report) return;
      var weight = disclosureRecency(row.rcept_dt || "", now, 10);
      FACTORS.forEach(function (factor) {
        var matched = factor.disclosure_terms.filter(function (term) { return term && report.indexOf(term) >= 0; });
        if (!matched.length) return;
        var entry = result[factor.id] || { weighted: 0, evidence: [] };
        entry.weighted += weight;
        entry.evidence.push({
          kind: "disclosure", title: report, source: row.corp_name || row.flr_nm || "",
          date: row.rcept_dt || "", url: row.url || "", match: matched
        });
        result[factor.id] = entry;
      });
    });
    return result;
  }

  function marketSignals(quote) {
    var signals = {};
    if (!quote) return signals;
    var price = quote.price, volume = quote.volume, avg = quote.avg_volume_20d;
    var ratio = (volume && avg) ? volume / avg : null;

    if (ratio !== null && ratio >= 1.5) {
      signals[3] = {
        strength: Math.min(1, (ratio - 1) / 2),
        evidence: [{
          kind: "market", title: "거래량 평균 대비 " + ratio.toFixed(1) + "배 (기계적 매매·리밸런싱 수급 점검)",
          source: quote.source || "", date: quote.traded_at || "", url: quote.source_url || "", match: ["거래량 급증"]
        }],
        note: "거래량 급증은 지수 리밸런싱·패시브 자금 유입의 대리 지표입니다."
      };
    }

    var individual = quote.individual_net, foreign = quote.foreign_net;
    if (ratio !== null && ratio >= 2 && individual && foreign !== undefined && foreign !== null && individual > 0 && foreign <= 0) {
      signals[8] = {
        strength: Math.min(1, 0.45 + (ratio - 2) / 4),
        evidence: [{
          kind: "market",
          title: "개인 순매수 +" + Number(individual).toLocaleString("ko-KR") + "주 / 외국인 " +
            (Number(foreign) > 0 ? "+" : "") + Number(foreign).toLocaleString("ko-KR") + "주, 거래량 " + ratio.toFixed(1) + "배",
          source: quote.source || "", date: quote.traded_at || "", url: quote.source_url || "", match: ["수급 역전"]
        }],
        note: "공매도 잔고 데이터는 무료 실시간 API가 없어 수급 역전으로 대신 추정했습니다."
      };
    }

    if (price && quote.high_52w && quote.low_52w) {
      var span = quote.high_52w - quote.low_52w;
      var pos = span ? (price - quote.low_52w) / span : 0.5;
      if (pos >= 0.9 && ratio !== null && ratio >= 1.2) {
        var strength = Math.min(1, 0.35 + (pos - 0.9) * 3);
        var prev = signals[9] || { strength: 0, evidence: [], note: "" };
        signals[9] = {
          strength: Math.max(prev.strength, strength),
          evidence: prev.evidence.concat([{
            kind: "market", title: "52주 최고가 대비 " + Math.round(pos * 100) + "% 구간, 거래량 " + ratio.toFixed(1) + "배",
            source: quote.source || "", date: quote.traded_at || "", url: quote.source_url || "", match: ["고점 근접"]
          }]),
          note: "고점 근접 + 거래량 증가는 주식 수 이벤트(무상증자·액면분할) 기대와 함께 나타날 수 있습니다."
        };
      }
    }
    return signals;
  }

  function logStrength(weighted, saturation) {
    if (weighted <= 0) return 0;
    return Math.min(1, Math.log1p(weighted) / Math.log1p(saturation || 3));
  }

  function buildSignals(options) {
    var now = options.now || new Date();
    var articles = options.articles || [];
    var disclosures = options.disclosures || [];
    var quote = options.quote || null;
    var minStrength = options.minStrength === undefined ? 0.12 : options.minStrength;

    var news = tagArticles(articles, now);
    var dart = tagDisclosures(disclosures, now);
    var market = marketSignals(quote);

    var ids = {};
    [news, dart, market].forEach(function (bag) {
      Object.keys(bag).forEach(function (key) { ids[key] = true; });
    });

    var signals = [];
    Object.keys(ids).map(Number).sort(function (a, b) { return a - b; }).forEach(function (fid) {
      var parts = [];
      if (news[fid]) parts.push({ kind: "news", strength: logStrength(news[fid].weighted, 3), evidence: news[fid].evidence });
      if (dart[fid]) parts.push({ kind: "disclosure", strength: logStrength(dart[fid].weighted, 1.5), evidence: dart[fid].evidence });
      if (market[fid]) parts.push({ kind: "market", strength: market[fid].strength, evidence: market[fid].evidence });

      var remaining = 1;
      parts.forEach(function (part) {
        remaining *= 1 - Math.min(0.99, part.strength * SOURCE_WEIGHT[part.kind]);
      });
      var strength = round(1 - remaining, 4);
      if (strength < minStrength) return;

      var evidence = [];
      parts.forEach(function (part) { evidence = evidence.concat(part.evidence); });
      evidence.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

      signals.push({
        factor_id: fid,
        name: FACTOR_BY_ID[fid].name,
        axis_id: FACTOR_BY_ID[fid].axis_id,
        direction: FACTOR_BY_ID[fid].direction,
        direction_label: FACTOR_BY_ID[fid].direction_label,
        strength: strength,
        score: round(strength * FACTOR_BY_ID[fid].weight * 100, 1),
        sources: parts.map(function (p) { return p.kind; }),
        evidence: evidence.slice(0, 6),
        note: market[fid] ? market[fid].note : ""
      });
    });

    signals.sort(function (a, b) {
      return b.strength * FACTOR_BY_ID[b.factor_id].weight - a.strength * FACTOR_BY_ID[a.factor_id].weight;
    });
    return signals;
  }

  /* ── 스코어링 (scoring.py 대응) ─────────────────────────────────────── */
  function axisBreakdown(signals) {
    var byAxis = {};
    AXES.forEach(function (axis) { byAxis[axis.id] = []; });
    signals.forEach(function (signal) {
      var factor = FACTOR_BY_ID[signal.factor_id];
      byAxis[factor.axis_id].push({
        factor_id: factor.id, name: factor.name,
        strength: round(signal.strength, 4),
        contribution: round(signal.strength * factor.weight, 4)
      });
    });
    return AXES.map(function (axis) {
      var parts = byAxis[axis.id].slice().sort(function (a, b) { return b.contribution - a.contribution; });
      var remaining = 1;
      parts.forEach(function (part) {
        remaining *= 1 - Math.min(0.99, part.strength * FACTOR_BY_ID[part.factor_id].weight);
      });
      var score = 1 - remaining;
      return {
        axis_id: axis.id, name: axis.name,
        score: round(score, 4), score_100: round(score * 100, 1),
        weight: axis.weight, factors: parts
      };
    });
  }

  function weightedPressure(axes) {
    return round(clamp(axes.reduce(function (sum, row) { return sum + row.score * row.weight; }, 0)), 4);
  }

  function nonFundamentalDriftScore(axes) {
    return round(Math.pow(weightedPressure(axes), NFDS_GAMMA) * 100, 1);
  }

  function driftLabel(score) {
    for (var i = 0; i < DRIFT_LABELS.length; i += 1) {
      if (score >= DRIFT_LABELS[i][0]) {
        return { label: DRIFT_LABELS[i][1], threshold: DRIFT_LABELS[i][0], message: DRIFT_LABELS[i][2] };
      }
    }
    return { label: "안정", threshold: 0, message: "" };
  }

  function driftDirection(signals) {
    var up = 0, down = 0;
    signals.forEach(function (signal) {
      var factor = FACTOR_BY_ID[signal.factor_id];
      var magnitude = signal.strength * factor.weight;
      if (factor.direction === "up") up += magnitude;
      else if (factor.direction === "down") down += magnitude;
      else if (factor.direction === "reversal") { up += magnitude * 0.6; down += magnitude * 0.6; }
      else { up += magnitude * 0.5; down += magnitude * 0.5; }
    });
    var total = up + down;
    if (total < 0.05) return { code: "NEUTRAL", label: "중립", up: 0, down: 0 };
    var share = Math.max(up, down) / total;
    if (share < 0.6) return { code: "VOLATILE", label: "▲▼ 양방향 변동성", up: round(up, 3), down: round(down, 3) };
    if (up > down) return { code: "UP", label: "▲ 단기 급등 우위", up: round(up, 3), down: round(down, 3) };
    return { code: "DOWN", label: "▼ 단기 급락 우위", up: round(up, 3), down: round(down, 3) };
  }

  function tanhNorm(value, scale) {
    return clamp(0.5 + 0.5 * Math.tanh(value / scale));
  }

  function valuationStretch(quote) {
    var result = { range_position: null, ma60_extension: null, valuation_premium: null, components: [], coverage: 0, notes: [] };
    if (!quote) { result.notes.push("시세 데이터 없음"); return result; }
    var price = quote.price, high = quote.high_52w, low = quote.low_52w;
    if (price && high && low && high > low) {
      result.range_position = round(clamp((price - low) / (high - low)), 4);
      result.components.push(["range_position", result.range_position]);
    }
    if (price && quote.ma60) {
      result.ma60_extension = round(price / quote.ma60 - 1, 4);
      result.components.push(["ma60_extension", tanhNorm(result.ma60_extension, 0.20)]);
    }
    var per = quote.per, fwd = quote.consensus_per;
    if (per && fwd && fwd > 0) {
      result.valuation_premium = round(per / fwd - 1, 4);
      result.components.push(["valuation_premium", tanhNorm(result.valuation_premium, 0.30)]);
    } else {
      result.notes.push("후행/선행 PER 비교 불가(밸류에이션 항목 제외)");
    }
    if (result.components.length) result.coverage = round(result.components.length / 3, 2);
    return result;
  }

  function meanReversionRisk(driftScore, stretch) {
    var weightMap = { range_position: 0.40, ma60_extension: 0.30, valuation_premium: 0.30 };
    var available = stretch.components || [];
    var baseScore = 0;
    if (available.length) {
      var weightSum = 0;
      var acc = 0;
      available.forEach(function (item) {
        weightSum += weightMap[item[0]];
        acc += weightMap[item[0]] * item[1];
      });
      baseScore = (acc / weightSum) * 100;
    }
    var combined = round(clamp(0.55 * (baseScore / 100) + 0.45 * (driftScore / 100)) * 100, 1);
    var level = MR_LEVELS[MR_LEVELS.length - 1];
    for (var i = 0; i < MR_LEVELS.length; i += 1) {
      if (combined >= MR_LEVELS[i][0]) { level = MR_LEVELS[i]; break; }
    }
    return {
      score: combined, level: level[1], alert: level[2], message: level[3],
      price_position_score: round(baseScore, 1),
      coverage: stretch.coverage || 0,
      components: {
        range_position: stretch.range_position,
        ma60_extension: stretch.ma60_extension,
        valuation_premium: stretch.valuation_premium
      },
      notes: (stretch.notes || []).slice()
    };
  }

  function fundamentalCheck(quote) {
    if (!quote) return { status: "unknown", message: "실적 데이터 없음", flags: [] };
    var flags = [];
    var per = quote.per, fwd = quote.consensus_per, eps = quote.eps, fwdEps = quote.consensus_eps;
    if (per && fwd && per > fwd * 1.2) flags.push("후행 PER이 선행 PER보다 높습니다(이익 개선 기대 선반영).");
    if (per && fwd && per < fwd * 0.8) flags.push("후행 PER이 선행 PER보다 낮습니다(이익 감소 전망 반영).");
    if (eps && fwdEps && fwdEps > eps) {
      flags.push("컨센서스 EPS " + Math.round(fwdEps).toLocaleString("ko-KR") + "원이 직전 EPS " +
        Math.round(eps).toLocaleString("ko-KR") + "원보다 높습니다.");
    }
    if (!flags.length) flags.push("이익 추정치와 PER 괴리가 크지 않습니다.");
    return { status: "ok", message: "이익 창출력 대비 가격 수준을 PER/EPS로만 비교한 초안 판정입니다.", flags: flags };
  }

  function investorPrinciples(signals, direction, mr) {
    var rows = [];
    INVESTOR_PRINCIPLES.forEach(function (principle) {
      if (principle.tone === "up" && (direction.code === "UP" || direction.code === "VOLATILE")) rows.push(principle);
      if (principle.tone === "down" && (direction.code === "DOWN" || direction.code === "VOLATILE")) rows.push(principle);
    });
    if (!rows.length) rows.push(INVESTOR_PRINCIPLES[0]);
    var actions = [];
    signals.slice(0, 5).forEach(function (signal) {
      var action = FACTOR_ACTIONS[signal.factor_id];
      if (action) actions.push({ factor_id: signal.factor_id, name: FACTOR_BY_ID[signal.factor_id].name, action: action });
    });
    return {
      rows: rows, factor_actions: actions, mean_reversion: mr.message,
      core_conclusion: CORE_CONCLUSION, disclaimer: DISCLAIMER
    };
  }

  function confidence(sources, stretch) {
    var live = (sources || []).filter(function (s) { return s.status === "live"; }).length;
    var total = (sources || []).length || 1;
    var ratio = live / total;
    var score = Math.round(clamp(0.6 * ratio + 0.4 * (stretch.coverage || 0)) * 100);
    var label = score >= 70 ? "높음" : score >= 40 ? "보통" : "낮음";
    return {
      score: score, label: label, live_sources: live, total_sources: total,
      note: "실데이터 연결 수와 밸류에이션 지표 확보율로 계산한 초안 신뢰도입니다."
    };
  }

  function scorePayload(signals, quote, sources) {
    var axes = axisBreakdown(signals);
    var nfds = nonFundamentalDriftScore(axes);
    var stretch = valuationStretch(quote);
    var mr = meanReversionRisk(nfds, stretch);
    var direction = driftDirection(signals);
    return {
      axes: axes,
      nfds: {
        score: nfds,
        weighted: round(weightedPressure(axes) * 100, 1),
        label: driftLabel(nfds).label,
        message: driftLabel(nfds).message,
        direction: direction
      },
      mean_reversion: mr,
      valuation: stretch,
      fundamental: fundamentalCheck(quote),
      principles: investorPrinciples(signals, direction, mr),
      confidence: confidence(sources, stretch)
    };
  }

  function quotePayload(quote) {
    if (!quote) return { available: false };
    var keys = ["ticker", "name", "market", "currency", "price", "change_pct", "volume", "avg_volume_20d",
      "market_cap", "per", "pbr", "eps", "consensus_per", "consensus_eps", "high_52w", "low_52w",
      "ma20", "ma60", "foreign_net", "institution_net", "individual_net", "traded_at", "source", "source_url"];
    var payload = {};
    keys.forEach(function (key) {
      if (quote[key] !== null && quote[key] !== undefined) payload[key] = quote[key];
    });
    payload.available = Boolean(quote.price);
    if (quote.volume && quote.avg_volume_20d) payload.volume_ratio = round(quote.volume / quote.avg_volume_20d, 2);
    return payload;
  }

  /* ── 종목 해석 · 표본 분석 ──────────────────────────────────────────── */
  function resolveSymbol(query) {
    if (!query) return null;
    var q = String(query).trim().toLowerCase();
    if (/^\d{6}$/.test(q)) return q;
    if (SYMBOL_REGISTRY[q]) return SYMBOL_REGISTRY[q];
    var compacted = q.replace(/\s+/g, "");
    var names = Object.keys(SYMBOL_REGISTRY);
    for (var i = 0; i < names.length; i += 1) {
      if (compacted && compacted === names[i].replace(/\s+/g, "")) return SYMBOL_REGISTRY[names[i]];
    }
    var hits = {};
    names.forEach(function (name) {
      if (compacted && name.replace(/\s+/g, "").indexOf(compacted) >= 0) hits[SYMBOL_REGISTRY[name]] = true;
    });
    var codes = Object.keys(hits);
    if (codes.length === 1) return codes[0];
    if (/^[a-z]{1,6}$/.test(q)) return q.toUpperCase();
    return null;
  }

  function sampleSources(ticker, articleCount, disclosureCount) {
    return [
      {
        name: "naver_quote", status: "sample",
        reason: "표본 시세(정적 데모)", count: SAMPLE_QUOTES[ticker] ? 1 : 0,
        source_url: "https://finance.naver.com/item/main.naver?code=" + ticker, elapsed_ms: 0
      },
      {
        name: "news_rss", status: "sample", reason: "표본 뉴스(정적 데모)",
        count: articleCount, source_url: "", elapsed_ms: 0
      },
      {
        name: "opendart", status: "sample", reason: "표본 공시(정적 데모)",
        count: disclosureCount, source_url: "https://dart.fss.or.kr/", elapsed_ms: 0
      }
    ];
  }

  function dataGaps(sources, quote) {
    var gaps = [];
    gaps.push("표본 시세·뉴스·공시로 계산했습니다(정적 데모). API Base URL을 연결하면 실데이터로 전환됩니다.");
    if (!quote || !quote.per) gaps.push("PER/PBR 없음 → 평균 회귀 계산에서 밸류에이션 항목이 빠집니다.");
    gaps.push("OpenDART 키 미설정 → 공시 근거는 표본입니다(무료 키 발급 후 실데이터 전환).");
    gaps.push("공매도 잔고는 무료 실시간 API 미제공 → 수급 역전으로 대체 추정합니다.");
    (sources || []).forEach(function (source) {
      if (source.status === "error" || source.status === "disabled") {
        gaps.push(source.name + ": " + (source.reason || source.status));
      }
    });
    return gaps;
  }

  function demoAnalyze(query) {
    var ticker = resolveSymbol(query);
    if (!ticker) {
      return { error: "unknown_symbol", message: "'" + query + "' 종목을 찾지 못했습니다. 6자리 코드나 해외 티커로 다시 시도해 주세요." };
    }
    var quote = SAMPLE_QUOTES[ticker] || null;
    var articles = SAMPLE_NEWS[ticker] || [];
    var disclosures = SAMPLE_DISCLOSURES[ticker] || [];
    if (!quote && !articles.length && !disclosures.length) {
      return {
        error: "no_sample",
        message: "'" + query + "' 표본 데이터가 이 데모에 없습니다. 데모 종목(삼성전자·SK하이닉스·에코프로·NAVER) 중에서 고르거나 API를 연결해 주세요."
      };
    }
    var now = parseDate(DEMO_AS_OF) || new Date();
    var company = (quote && quote.name) || (SYMBOL_REGISTRY[String(query).trim().toLowerCase()] ? query : ticker);
    var signals = buildSignals({ articles: articles, disclosures: disclosures, quote: quote, now: now });
    var sources = sampleSources(ticker, articles.length, disclosures.length);
    var scoring = scorePayload(signals, quote, sources);
    return {
      service: SERVICE, slug: "market-intelligence", version: VERSION,
      generated_at: DEMO_AS_OF, q: query,
      entity: {
        ticker: ticker, name: company,
        market: (quote && quote.market) || "", currency: (quote && quote.currency) || "",
        source: quote ? "sample" : "none"
      },
      mode: "sample",
      quote: quotePayload(quote),
      signals: signals,
      scoring: scoring,
      sources: sources,
      data_gaps: dataGaps(sources, quote),
      disclaimer: DISCLAIMER,
      sample_as_of: DEMO_AS_OF
    };
  }

  /* ── API 모드 ───────────────────────────────────────────────────────── */
  function storedBase() {
    try { return window.localStorage.getItem(STORE_KEY) || ""; } catch (error) { return ""; }
  }
  function saveBase(value) {
    try {
      if (value) window.localStorage.setItem(STORE_KEY, value);
      else window.localStorage.removeItem(STORE_KEY);
    } catch (error) { /* 사파리 프라이빗 모드: 저장 실패는 세션 한정으로 동작 */ }
  }
  function normalizeBase(raw) {
    var text = String(raw || "").trim();
    if (!text) return "";
    if (!/^https?:\/\//i.test(text)) text = "https://" + text;
    return text.replace(/\/+$/, "");
  }
  function apiUrl(path) {
    var base = state.apiBase;
    return base ? base + path : path;
  }
  function getJSON(path, timeoutMs) {
    var options = { headers: { Accept: "application/json" } };
    if (window.AbortController) {
      var controller = new AbortController();
      options.signal = controller.signal;
      var timer = window.setTimeout(function () { controller.abort(); }, timeoutMs || 8000);
      return fetch(apiUrl(path), options).then(function (res) {
        window.clearTimeout(timer);
        return res.json().then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
      }, function (error) {
        window.clearTimeout(timer);
        throw error;
      });
    }
    return fetch(apiUrl(path), options).then(function (res) {
      return res.json().then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
    });
  }

  function apiAnalyze(query) {
    return getJSON("/api/analyze?q=" + encodeURIComponent(query), 15000).then(function (res) {
      if (!res.ok) {
        var message = (res.body && res.body.message) || "분석에 실패했습니다.";
        if (res.body && res.body.suggestions && res.body.suggestions.length) {
          message += " 예: " + res.body.suggestions.slice(0, 4).map(function (s) { return s.name + "(" + s.ticker + ")"; }).join(", ");
        }
        return { error: "api", message: message };
      }
      return res.body;
    });
  }

  /* ── 렌더 ───────────────────────────────────────────────────────────── */
  var state = { apiBase: "", mode: "demo", busy: false, factors: null };

  function setMode(mode, note) {
    var pill = $("modePill");
    var labels = {
      live: "LIVE · 실데이터", mixed: "MIXED · 일부 표본", sample: "SAMPLE · 표본 데이터",
      demo: "DEMO · 정적 표본", offline: "OFFLINE"
    };
    pill.textContent = labels[mode] || String(mode || "unknown");
    pill.setAttribute("data-mode", mode || "unknown");

    var title = $("modeBarTitle");
    var text = $("modeBarText");
    if (mode === "live") {
      title.textContent = "실데이터 모드";
      text.textContent = "API에서 받은 시세·뉴스·공시로 계산했습니다.";
    } else if (mode === "mixed") {
      title.textContent = "일부 표본 포함";
      text.textContent = "일부 출처가 실데이터가 아닙니다. 표본 값은 투자 판단에 쓸 수 없습니다.";
    } else if (state.apiBase) {
      title.textContent = "API 연결됨 · 표본 응답";
      text.textContent = "서버가 표본 데이터를 반환했습니다. 아래 출처 상태를 확인하세요.";
    } else {
      title.textContent = "정적 데모 모드";
      text.textContent = "내장 표본 데이터로 계산합니다. 서버 API를 연결하면 실데이터로 전환됩니다.";
    }
    if (note) text.textContent = note;
  }

  function notify(message, isError) {
    var box = $("notice");
    box.textContent = message || "";
    box.className = "notice" + (isError ? " error" : "");
    box.hidden = !message;
  }

  function renderMechanism() {
    var inputs = $("mechInputs");
    clear(inputs);
    var marks = ["①", "②", "③", "④"];
    AXES.forEach(function (axis, index) {
      var chip = el("div", "axis-chip");
      chip.appendChild(el("span", "axis-no", marks[index] || String(index + 1)));
      var box = el("div");
      box.appendChild(el("strong", null, axis.name));
      box.appendChild(el("small", null, axis.factor_ids.join(" · ") + "번"));
      chip.appendChild(box);
      inputs.appendChild(chip);
    });

    var outcomes = $("mechOutcomes");
    clear(outcomes);
    MECHANISM.outcomes.forEach(function (outcome) {
      var card = el("article", "outcome " + outcome.tone);
      var head = el("h3", null, "");
      head.appendChild(document.createTextNode(outcome.label + " "));
      head.appendChild(el("small", null, outcome.detail));
      card.appendChild(head);
      card.appendChild(el("p", null, outcome.note));
      outcomes.appendChild(card);
    });

    var notes = $("axisNotes");
    clear(notes);
    AXES.forEach(function (axis) {
      var li = el("li");
      li.appendChild(el("b", null, axis.id + " · " + axis.factor_ids.map(pad2).join("·")));
      li.appendChild(el("p", null, axis.summary));
      li.appendChild(el("small", null, "확인: " + axis.watch));
      notes.appendChild(li);
    });
    $("mechCenter").textContent = MECHANISM.center;
  }

  function pad2(value) { return String(value).padStart(2, "0"); }

  function renderMatrix() {
    var body = $("matrixBody");
    clear(body);
    var sourceNames = { opendart: "공시", news_rss: "뉴스", market_data: "시세" };
    DISPLAY_ORDER.forEach(function (fid) {
      var factor = FACTOR_BY_ID[fid];
      var axis = AXIS_BY_ID[factor.axis_id];
      var tr = el("tr");
      tr.appendChild(el("td", "axis-cell", axis.name));

      var nameTd = el("td", "factor-cell");
      nameTd.appendChild(el("strong", null, factor.name));
      nameTd.appendChild(el("span", null, pad2(factor.id) + " · " + factor.axis_id));
      tr.appendChild(nameTd);

      tr.appendChild(el("td", "mech-cell", factor.mechanism));

      var dirClass = factor.direction === "down" ? "dir-down" : factor.direction === "up" ? "dir-up" : "dir-both";
      tr.appendChild(el("td", "dir-cell " + dirClass, factor.direction_label));

      var srcText = factor.sources.map(function (s) { return sourceNames[s] || s; }).join("·") +
        " / 키워드 " + factor.keywords.length;
      tr.appendChild(el("td", "src-cell", srcText));
      body.appendChild(tr);
    });
  }

  function renderPrinciples() {
    var body = $("principleBody");
    clear(body);
    INVESTOR_PRINCIPLES.forEach(function (row) {
      var tr = el("tr");
      var th = el("th", row.tone === "up" ? "tone-up" : "tone-down", row.type);
      th.setAttribute("scope", "row");
      tr.appendChild(th);
      tr.appendChild(el("td", null, row.trigger));
      tr.appendChild(el("td", null, row.action));
      body.appendChild(tr);
    });
    $("coreConclusion").textContent = "핵심 결론 · " + CORE_CONCLUSION;
  }

  function renderChips(examples) {
    var wrap = $("chips");
    clear(wrap);
    (examples || EXAMPLES).slice(0, 8).forEach(function (item) {
      var button = el("button", "chip", item.name + " · " + item.ticker);
      button.type = "button";
      button.addEventListener("click", function () {
        $("queryInput").value = item.ticker;
        analyze(item.ticker);
      });
      wrap.appendChild(button);
    });
  }

  function renderQuote(body) {
    var grid = $("quoteGrid");
    clear(grid);
    var quote = body.quote || {};
    var currency = (body.entity && body.entity.currency) || quote.currency;
    var cells = [
      ["현재가", won(quote.price, currency), quote.change_pct === undefined ? "" : pct(quote.change_pct), quote.change_pct > 0 ? "pos" : quote.change_pct < 0 ? "neg" : ""],
      ["거래량 / 평균", quote.volume ? num(quote.volume) : "—", quote.volume_ratio ? quote.volume_ratio.toFixed(1) + "배" : ""],
      ["시가총액", quote.market_cap || (quote.market_cap_value ? compact(quote.market_cap_value) : "—"), ""],
      ["PER / PBR", quote.per ? quote.per.toFixed(2) + "배" : "—", quote.pbr ? "PBR " + quote.pbr.toFixed(2) + "배" : ""],
      ["선행 PER", quote.consensus_per ? quote.consensus_per.toFixed(2) + "배" : "—", quote.consensus_eps ? "EPS " + num(quote.consensus_eps) : ""],
      ["52주 범위", quote.low_52w && quote.high_52w ? num(quote.low_52w) + " ~ " + num(quote.high_52w) : "—", ""],
      ["MA60", quote.ma60 ? num(quote.ma60) : "—", quote.price && quote.ma60 ? pct((quote.price / quote.ma60 - 1) * 100) : ""]
    ];
    cells.forEach(function (cell) {
      var box = el("dl", "quote-cell");
      box.appendChild(el("dt", null, cell[0]));
      var dd = el("dd", cell[3] || null, "");
      dd.appendChild(document.createTextNode(cell[1]));
      if (cell[2]) dd.appendChild(el("small", null, " " + cell[2]));
      box.appendChild(dd);
      grid.appendChild(box);
    });
    if (!quote.available) {
      var cell = el("dl", "quote-cell");
      cell.appendChild(el("dt", null, "시세"));
      cell.appendChild(el("dd", null, "시세 없음 — 뉴스·공시 신호만 반영"));
      grid.appendChild(cell);
    }
  }

  function renderScore(body) {
    var scoring = body.scoring || {};
    var nfds = scoring.nfds || {};
    $("nfdsValue").textContent = nfds.score === undefined ? "—" : Number(nfds.score).toFixed(1);
    var label = $("nfdsLabel");
    label.textContent = nfds.label || "—";
    label.className = "badge" + (nfds.label === "과열" ? " up" : nfds.label === "경계" ? " strong" : "");
    $("nfdsMessage").textContent = nfds.message || "";
    $("nfdsBar").style.width = clamp(Number(nfds.score) || 0, 0, 100) + "%";

    var bars = $("axisBars");
    clear(bars);
    (scoring.axes || []).forEach(function (axis) {
      var li = el("li");
      li.appendChild(el("span", null, axis.name));
      li.appendChild(el("span", null, axis.score_100.toFixed(1)));
      var bar = el("div", "bar");
      var fill = el("span");
      fill.style.width = clamp(axis.score_100, 0, 100) + "%";
      bar.appendChild(fill);
      li.appendChild(bar);
      bars.appendChild(li);
    });

    var dir = nfds.direction || {};
    $("directionLine").textContent = dir.label
      ? "우세 방향 · " + dir.label + " (상방 " + Number(dir.up || 0).toFixed(2) + " / 하방 " + Number(dir.down || 0).toFixed(2) + ")"
      : "";

    var mr = scoring.mean_reversion || {};
    $("mrLevel").textContent = mr.level || "—";
    $("mrScore").textContent = (mr.score === undefined ? "—" : Number(mr.score).toFixed(1)) + "/100";
    $("mrBar").style.width = clamp(Number(mr.score) || 0, 0, 100) + "%";
    $("mrMessage").textContent = mr.message || "";
    $("mrPanel").className = "panel mr-panel" + (mr.alert ? " alert" : "");

    var metrics = $("mrMetrics");
    clear(metrics);
    var comp = mr.components || {};
    var rows = [
      ["52주 위치", comp.range_position === null || comp.range_position === undefined ? "—" : Math.round(comp.range_position * 100) + "%"],
      ["MA60 대비", comp.ma60_extension === null || comp.ma60_extension === undefined ? "—" : pct(comp.ma60_extension * 100, 1)],
      ["PER 괴리(후행/선행)", comp.valuation_premium === null || comp.valuation_premium === undefined ? "—" : pct(comp.valuation_premium * 100, 1)],
      ["신뢰도", (scoring.confidence ? scoring.confidence.label : "—")]
    ];
    rows.forEach(function (row) {
      var box = el("div");
      box.appendChild(el("dt", null, row[0]));
      box.appendChild(el("dd", null, row[1]));
      metrics.appendChild(box);
    });
  }

  function renderSignals(body) {
    var list = $("signals");
    clear(list);
    var signals = body.signals || [];
    $("signalCount").textContent = String(signals.length);
    if (!signals.length) {
      list.appendChild(el("li", "empty", "이 종목에서 잡힌 비재무 요인 신호가 없습니다. 뉴스·공시가 실데이터로 연결됐는지 아래 출처를 확인하세요."));
      return;
    }
    signals.forEach(function (signal) {
      var li = el("li", "signal");
      li.appendChild(el("span", "signal-no", pad2(signal.factor_id)));
      var right = el("div");

      var top = el("div", "signal-top");
      top.appendChild(el("strong", null, signal.name));
      top.appendChild(el("span", "signal-axis", signal.axis_id + " · " + signal.direction_label));
      right.appendChild(top);

      var strength = el("div", "signal-strength");
      var bar = el("div", "strength-bar");
      var fill = el("span");
      fill.style.width = Math.round(signal.strength * 100) + "%";
      bar.appendChild(fill);
      strength.appendChild(bar);
      strength.appendChild(el("span", "strength-value", Math.round(signal.strength * 100) + "%"));
      right.appendChild(strength);

      if (signal.evidence && signal.evidence.length) {
        var ul = el("ul", "evidence");
        signal.evidence.forEach(function (item) {
          var ev = el("li");
          if (item.url && /^https?:\/\//.test(item.url)) {
            var link = el("a", null, item.title);
            link.href = item.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer nofollow";
            ev.appendChild(link);
          } else {
            ev.appendChild(document.createTextNode(item.title));
          }
          if (item.date) ev.appendChild(el("span", "src", String(item.date).slice(0, 10)));
          if (item.source) ev.appendChild(el("span", "src", item.source));
          if (item.kind) ev.appendChild(el("span", "src", item.kind));
          ul.appendChild(ev);
        });
        right.appendChild(ul);
      }
      if (signal.note) right.appendChild(el("p", "signal-note", signal.note));
      li.appendChild(right);
      list.appendChild(li);
    });
  }

  function renderPrinciplesPanel(body) {
    var principles = (body.scoring && body.scoring.principles) || {};
    var list = $("principles");
    clear(list);
    (principles.rows || []).forEach(function (row) {
      var li = el("li", row.tone || "");
      li.appendChild(el("span", "p-type", row.type));
      li.appendChild(el("p", "p-trigger", row.trigger));
      li.appendChild(el("p", "p-action", "→ " + row.action));
      list.appendChild(li);
    });
    (principles.factor_actions || []).slice(0, 3).forEach(function (action) {
      var li = el("li", "");
      li.appendChild(el("span", "p-type", "요인 대응"));
      li.appendChild(el("p", "p-trigger", action.name));
      li.appendChild(el("p", "p-action", "→ " + action.action));
      list.appendChild(li);
    });
    $("conclusion").textContent = principles.core_conclusion || "";
  }

  function renderSources(body) {
    var list = $("sources");
    clear(list);
    (body.sources || []).forEach(function (source) {
      var li = el("li");
      li.appendChild(el("span", "name", SOURCE_LABELS[source.name] || source.name));
      li.appendChild(el("span", "status " + source.status, source.status));
      list.appendChild(li);
    });
    var gaps = $("gaps");
    clear(gaps);
    (body.data_gaps || []).forEach(function (gap) { gaps.appendChild(el("li", null, gap)); });

    var fundamental = (body.scoring && body.scoring.fundamental) || {};
    var fund = $("fundamental");
    clear(fund);
    (fundamental.flags || []).forEach(function (flag) { fund.appendChild(el("li", null, flag)); });
    if (fundamental.message) fund.appendChild(el("li", null, "※ " + fundamental.message));
  }

  function renderResult(body) {
    setMode(body.mode || "sample");
    $("result").hidden = false;
    var meta = [
      body.entity.ticker, body.entity.market, body.entity.currency, "MODE " + String(body.mode || "").toUpperCase()
    ].filter(Boolean);
    if (body.mode !== "live" && body.sample_as_of) meta.push("표본 기준 " + formatStamp(body.sample_as_of));
    $("entityMeta").textContent = meta.join(" · ");
    $("entityName").textContent = body.entity.name || body.q;

    var badges = $("entityBadges");
    clear(badges);
    var dir = (body.scoring && body.scoring.nfds && body.scoring.nfds.direction) || {};
    if (dir.label) badges.appendChild(el("span", "badge", dir.label));
    var mr = (body.scoring && body.scoring.mean_reversion) || {};
    if (mr.level) badges.appendChild(el("span", "badge" + (mr.alert ? " strong" : ""), "평균 회귀 " + mr.level));
    if (body.scoring && body.scoring.confidence) badges.appendChild(el("span", "badge", "신뢰도 " + body.scoring.confidence.label));
    if (body.mode !== "live") badges.appendChild(el("span", "badge", "표본 데이터 포함"));

    renderQuote(body);
    renderScore(body);
    renderSignals(body);
    renderPrinciplesPanel(body);
    renderSources(body);

    if (body.mode !== "live") {
      notify("일부 출처가 실데이터가 아닙니다. 표본 값은 화면 확인용이며 투자 판단에 쓸 수 없습니다.", false);
    }
  }

  function formatStamp(value) {
    var dt = parseDate(value);
    if (!dt) return String(value).slice(0, 16);
    var parts = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(dt);
    var map = {};
    parts.forEach(function (part) { map[part.type] = part.value; });
    return map.year + "-" + map.month + "-" + map.day + " " + map.hour + ":" + map.minute;
  }

  /* ── 분석 실행 ──────────────────────────────────────────────────────── */
  function analyze(query) {
    var text = String(query || "").trim();
    if (!text || state.busy) return;
    state.busy = true;
    var button = document.querySelector("#searchForm .btn");
    if (button) button.disabled = true;
    $("queryInput").value = text;
    notify("", false);

    var task = state.apiBase
      ? apiAnalyze(text).catch(function (error) {
        return { error: "network", message: "API 호출 실패: " + (error && error.name === "AbortError" ? "응답 시간 초과" : (error && error.message) || "알 수 없는 오류") + " — 정적 데모로 계산합니다.", fallback: true };
      })
      : Promise.resolve(demoAnalyze(text));

    task.then(function (result) {
      if (result.error) {
        notify(result.message, true);
        $("result").hidden = true;
        if (result.fallback) {
          var demo = demoAnalyze(text);
          if (!demo.error) renderResult(demo);
        }
        return;
      }
      renderResult(result);
      var target = $("result");
      if (target.getBoundingClientRect().top < 0) target.scrollIntoView({ block: "start", behavior: "smooth" });
    }).catch(function (error) {
      notify("분석 중 오류: " + ((error && error.message) || "알 수 없는 오류"), true);
    }).then(function () {
      state.busy = false;
      if (button) button.disabled = false;
    });
  }

  /* ── 부팅 ───────────────────────────────────────────────────────────── */
  function applyBase(base) {
    state.apiBase = base || "";
    var btn = $("apiBtn");
    if (state.apiBase) btn.classList.add("on"); else btn.classList.remove("on");
    $("apiStatus").textContent = state.apiBase ? "현재: " + state.apiBase : "현재: 정적 데모 모드";
    $("apiStatus").className = "sheet-status" + (state.apiBase ? " ok" : "");
  }

  function loadFromApi() {
    return Promise.all([
      getJSON("/api/factors", 8000),
      getJSON("/api/symbols", 8000),
      getJSON("/api/health", 8000)
    ]).then(function (results) {
      var factors = results[0], symbols = results[1], health = results[2];
      if (factors.ok && factors.body && factors.body.factors) {
        state.factors = factors.body;
      }
      if (symbols.ok && symbols.body && symbols.body.examples) renderChips(symbols.body.examples);
      if (health.ok && health.body) {
        $("footerVersion").textContent = "v" + health.body.version + " · " + health.body.mode + " · " + (state.apiBase ? "api" : "demo");
        var ready = health.body.connectors && health.body.connectors.naver_quote ? health.body.connectors.naver_quote.status : "unknown";
        setMode(ready === "ready" ? "live" : "sample");
      }
      notify("", false);
      analyze("005930");
    }).catch(function (error) {
      notify("API에 연결하지 못했습니다(" + ((error && error.message) || "network") + "). 정적 데모로 계속합니다.", true);
      applyBase("");
      setMode("sample");
      analyze("005930");
    });
  }

  function boot() {
    renderMechanism();
    renderMatrix();
    renderPrinciples();
    renderChips(EXAMPLES);
    $("footerDisclaimer").textContent = "초안 · 무료 공개 데이터 전용 구성. 특정 종목의 매수·매도 추천이 아니며 점수는 공개 데이터 기반 휴리스틱입니다. " + DISCLAIMER;
    $("footerVersion").textContent = "v" + VERSION + " · demo";

    var params = new URLSearchParams(window.location.search);
    var queryBase = params.get("api");
    var base = queryBase ? normalizeBase(queryBase) : storedBase();
    applyBase(base);

    $("searchForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var query = $("queryInput").value.trim();
      if (query) analyze(query);
    });

    var dialog = $("apiDialog");
    $("apiBtn").addEventListener("click", function () {
      $("apiInput").value = state.apiBase;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
    $("apiClose").addEventListener("click", function () {
      if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
    });
    $("apiReset").addEventListener("click", function () {
      saveBase("");
      applyBase("");
      if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
      setMode("sample");
      notify("정적 데모 모드로 돌아왔습니다. 내장 표본 데이터로 계산합니다.", false);
      analyze("005930");
    });
    $("apiForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var status = $("apiStatus");
      var candidate = normalizeBase($("apiInput").value);
      if (!candidate) {
        status.textContent = "주소가 비어 있습니다. 데모로 초기화하려면 아래 버튼을 쓰세요.";
        status.className = "sheet-status err";
        return;
      }
      try { new URL(candidate); } catch (error) {
        status.textContent = "URL 형식이 아닙니다: " + candidate;
        status.className = "sheet-status err";
        return;
      }
      status.textContent = "연결 확인 중… " + candidate;
      status.className = "sheet-status";
      state.apiBase = candidate;
      getJSON("/api/health", 8000).then(function (res) {
        if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
        saveBase(candidate);
        applyBase(candidate);
        status.textContent = "연결됨: v" + res.body.version + " · " + res.body.mode + " · " + candidate;
        status.className = "sheet-status ok";
        if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
        loadFromApi();
      }).catch(function (error) {
        state.apiBase = state.apiBase === candidate ? storedBase() : state.apiBase;
        applyBase(storedBase());
        status.textContent = "연결 실패(" + ((error && error.name === "AbortError") ? "시간 초과" : (error && error.message) || "network") +
          "). 주소와 CORS 허용 여부를 확인하세요. 저장하지 않았습니다.";
        status.className = "sheet-status err";
      });
    });

    if (state.apiBase) loadFromApi();
    else { setMode("sample"); analyze("005930"); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
