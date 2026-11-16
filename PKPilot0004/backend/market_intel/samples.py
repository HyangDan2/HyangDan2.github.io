"""무료 API 키가 없거나 네트워크가 막혔을 때 쓰는 검증용 표본 데이터.

표본 값은 실제 시세가 아니라 데모용으로 만든 값이다. 모든 응답에는
``mode="sample"`` 과 ``sample_reason`` 이 함께 실려 화면에서 실데이터와 구분된다.
"""
from __future__ import annotations

from typing import Any

SAMPLE_AS_OF = "2026-11-13T15:30:00+09:00"

# 표시용 종목명. SYMBOL_REGISTRY 는 소문자 별칭까지 담는 검색용 사전이라
# 화면·응답에는 이 표기를 쓴다(예: 'sk하이닉스' → 'SK하이닉스').
DISPLAY_NAMES: dict[str, str] = {
    "005930": "삼성전자",
    "000660": "SK하이닉스",
    "086520": "에코프로",
    "247540": "에코프로비엠",
    "035420": "NAVER",
    "035720": "카카오",
    "005380": "현대차",
    "373220": "LG에너지솔루션",
    "207940": "삼성바이오로직스",
    "068270": "셀트리온",
    "005490": "포스코홀딩스",
    "105560": "KB금융",
    "055550": "신한지주",
    "034020": "두산에너빌리티",
    "012450": "한화에어로스페이스",
    "329180": "HD현대중공업",
    "036570": "엔씨소프트",
}

# 종목명/별칭 → 종목코드. 무료 시세 소스(네이버 금융)는 국내 6자리 코드를 쓴다.
SYMBOL_REGISTRY: dict[str, str] = {
    "삼성전자": "005930",
    "samsung": "005930",
    "samsung electronics": "005930",
    "sk하이닉스": "000660",
    "하이닉스": "000660",
    "hynix": "000660",
    "에코프로": "086520",
    "에코프로비엠": "247540",
    "naver": "035420",
    "네이버": "035420",
    "카카오": "035720",
    "현대차": "005380",
    "현대자동차": "005380",
    "lg에너지솔루션": "373220",
    "삼성바이오로직스": "207940",
    "셀트리온": "068270",
    "포스코홀딩스": "005490",
    "posco": "005490",
    "kb금융": "105560",
    "신한지주": "055550",
    "두산에너빌리티": "034020",
    "한화에어로스페이스": "012450",
    "hd현대중공업": "329180",
    "엔씨소프트": "036570",
}

SAMPLE_QUOTES: dict[str, dict[str, Any]] = {
    "005930": {
        "ticker": "005930",
        "name": "삼성전자",
        "market": "KOSPI",
        "currency": "KRW",
        "price": 209000,
        "change_pct": 0.48,
        "volume": 21159966,
        "avg_volume_20d": 14200000,
        "market_cap": "1,221조 8,722억",
        "per": 9.38,
        "pbr": 2.43,
        "eps": 22292,
        "consensus_per": 4.58,
        "consensus_eps": 45655,
        "high_52w": 380000,
        "low_52w": 93500,
        "ma20": 196400,
        "ma60": 174800,
        "foreign_net": 8216,
        "institution_net": -328604,
        "individual_net": 285654,
        "traded_at": SAMPLE_AS_OF,
        "source": "sample",
        "source_url": "https://finance.naver.com/item/main.naver?code=005930",
    },
    "000660": {
        "ticker": "000660",
        "name": "SK하이닉스",
        "market": "KOSPI",
        "currency": "KRW",
        "price": 412500,
        "change_pct": -1.32,
        "volume": 6840000,
        "avg_volume_20d": 5120000,
        "market_cap": "300조 1,200억",
        "per": 6.10,
        "pbr": 1.85,
        "eps": 67623,
        "consensus_per": 5.02,
        "consensus_eps": 82171,
        "high_52w": 448000,
        "low_52w": 168500,
        "ma20": 398200,
        "ma60": 341000,
        "foreign_net": -412000,
        "institution_net": 118000,
        "individual_net": 294000,
        "traded_at": SAMPLE_AS_OF,
        "source": "sample",
        "source_url": "https://finance.naver.com/item/main.naver?code=000660",
    },
    "086520": {
        "ticker": "086520",
        "name": "에코프로",
        "market": "KOSDAQ",
        "currency": "KRW",
        "price": 74800,
        "change_pct": 12.45,
        "volume": 9630000,
        "avg_volume_20d": 2210000,
        "market_cap": "9조 9,600억",
        "per": 41.2,
        "pbr": 3.11,
        "eps": 1815,
        "consensus_per": 28.4,
        "consensus_eps": 2633,
        "high_52w": 158000,
        "low_52w": 61500,
        "ma20": 66800,
        "ma60": 70200,
        "foreign_net": 128000,
        "institution_net": -96000,
        "individual_net": -32000,
        "traded_at": SAMPLE_AS_OF,
        "source": "sample",
        "source_url": "https://finance.naver.com/item/main.naver?code=086520",
    },
    "035420": {
        "ticker": "035420",
        "name": "NAVER",
        "market": "KOSPI",
        "currency": "KRW",
        "price": 241000,
        "change_pct": -3.60,
        "volume": 3150000,
        "avg_volume_20d": 1820000,
        "market_cap": "38조 4,300억",
        "per": 18.7,
        "pbr": 1.24,
        "eps": 12890,
        "consensus_per": 15.9,
        "consensus_eps": 15157,
        "high_52w": 292000,
        "low_52w": 168000,
        "ma20": 249600,
        "ma60": 238400,
        "foreign_net": -218000,
        "institution_net": -74000,
        "individual_net": 292000,
        "traded_at": SAMPLE_AS_OF,
        "source": "sample",
        "source_url": "https://finance.naver.com/item/main.naver?code=035420",
    },
}

SAMPLE_NEWS: dict[str, list[dict[str, Any]]] = {
    "005930": [
        {
            "title": "삼성전자, 3분기 확정 실적 발표…메모리 가격 반등에 영업익 개선",
            "source": "표본 통신",
            "published": "2026-11-13T09:10:00+09:00",
            "url": "",
            "note": "실적(펀더멘털) 뉴스. 비재무 요인 태깅 대상 아님.",
        },
        {
            "title": "\"삼성전자 주주환원 확대\" 행동주의 펀드, 자사주 소각·배당 확대 공개 요구",
            "source": "표본 경제지",
            "published": "2026-11-12T18:40:00+09:00",
            "url": "",
            "note": "요인 2 태깅 표본",
        },
        {
            "title": "코스피200 정기변경 앞두고 지수 편입 종목 리밸런싱 매매 집중",
            "source": "표본 마켓",
            "published": "2026-11-11T08:20:00+09:00",
            "url": "",
            "note": "요인 3 태깅 표본",
        },
    ],
    "000660": [
        {
            "title": "SK하이닉스, HBM 증설 발표…외국인 순매수 이어져",
            "source": "표본 통신",
            "published": "2026-11-13T10:05:00+09:00",
            "url": "",
            "note": "실적·수요 뉴스",
        }
    ],
    "086520": [
        {
            "title": "에코프로 관련 M&A설 확산…커뮤니티발 루머에 선취매 유입",
            "source": "표본 경제지",
            "published": "2026-11-14T21:30:00+09:00",
            "url": "",
            "note": "요인 10 태깅 표본",
        },
        {
            "title": "에코프로, 거래량 급증 속 개인 매수세 결집…공매도 잔고 부담 확대",
            "source": "표본 마켓",
            "published": "2026-11-13T13:15:00+09:00",
            "url": "",
            "note": "요인 8 태깅 표본",
        },
        {
            "title": "2차전지 테마 재점화, 정치권 공약 수혜주로 분류되며 변동성 확대",
            "source": "표본 정치부",
            "published": "2026-11-13T07:50:00+09:00",
            "url": "",
            "note": "요인 1 태깅 표본",
        },
    ],
    "035420": [
        {
            "title": "NAVER, 물적분할 추진 보도에 주주환원 축소 우려…단체 행동 예고",
            "source": "표본 경제지",
            "published": "2026-11-12T16:05:00+09:00",
            "url": "",
            "note": "요인 2 태깅 표본",
        },
        {
            "title": "정보보호 사고 책임론 확산…거래정지 우려에 불매운동 조짐",
            "source": "표본 통신",
            "published": "2026-11-13T11:25:00+09:00",
            "url": "",
            "note": "요인 4 태깅 표본",
        },
    ],
}

SAMPLE_DISCLOSURES: dict[str, list[dict[str, Any]]] = {
    "005930": [
        {
            "report_nm": "주요사항보고서(자사주취득결정)",
            "corp_name": "삼성전자",
            "rcept_dt": "2026-11-12",
            "flr_nm": "삼성전자",
            "summary": "자사주 취득 및 소각 결정",
        },
        {
            "report_nm": "주요사항보고서(물적분할결정)",
            "corp_name": "삼성전자",
            "rcept_dt": "2026-11-05",
            "flr_nm": "삼성전자",
            "summary": "사업부 물적분할 결정",
        },
    ],
    "086520": [
        {
            "report_nm": "주요사항보고서(무상증자결정)",
            "corp_name": "에코프로",
            "rcept_dt": "2026-11-10",
            "flr_nm": "에코프로",
            "summary": "보통주 1주당 1주 무상증자 결정",
        },
        {
            "report_nm": "조회공시요구(풍문또는보도)에대한답변(미확인)",
            "corp_name": "에코프로",
            "rcept_dt": "2026-11-14",
            "flr_nm": "에코프로",
            "summary": "M&A설 관련 미확인 답변",
        },
    ],
    "035420": [
        {
            "report_nm": "주요사항보고서(물적분할결정)",
            "corp_name": "NAVER",
            "rcept_dt": "2026-11-11",
            "flr_nm": "NAVER",
            "summary": "자회사 물적분할 추진 결정",
        }
    ],
    "000660": [],
}

SAMPLE_NEWS_FALLBACK: list[dict[str, Any]] = [
    {
        "title": "표본 모드: 뉴스 소스에 연결되지 않아 표본 헤드라인을 사용했습니다",
        "source": "sample",
        "published": "2026-11-13T09:00:00+09:00",
        "url": "",
        "note": "표본 폴백 알림",
    }
]


def sample_quote(ticker: str) -> dict[str, Any] | None:
    return SAMPLE_QUOTES.get(ticker)


def sample_news(ticker: str) -> list[dict[str, Any]]:
    return SAMPLE_NEWS.get(ticker, [])


def sample_disclosures(ticker: str) -> list[dict[str, Any]]:
    return SAMPLE_DISCLOSURES.get(ticker, [])


def resolve_symbol(query: str) -> str | None:
    """종목명·별칭·6자리 코드를 종목코드로 정규화한다(초안 로직)."""
    if not query:
        return None
    q = query.strip().lower()
    if q.isdigit() and len(q) == 6:
        return q
    if q in SYMBOL_REGISTRY:
        return SYMBOL_REGISTRY[q]
    compact = q.replace(" ", "")
    for name, code in SYMBOL_REGISTRY.items():
        if compact and compact == name.replace(" ", ""):
            return code
    # 부분 일치(예: "삼성" → 삼성전자)는 유일할 때만 인정한다.
    hits = {code for name, code in SYMBOL_REGISTRY.items() if compact and compact in name.replace(" ", "")}
    if len(hits) == 1:
        return hits.pop()
    return None


def suggestions(limit: int = 8) -> list[dict[str, str]]:
    seen: dict[str, str] = {}
    for name, code in SYMBOL_REGISTRY.items():
        if code not in seen:
            seen[code] = DISPLAY_NAMES.get(code, name)
    return [{"name": n, "ticker": c} for c, n in list(seen.items())[:limit]]
