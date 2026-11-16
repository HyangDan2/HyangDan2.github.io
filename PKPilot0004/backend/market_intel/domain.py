"""Domain model: 「기업 본질 가치와 무관한 경제 외적 주가 변동 요인 10선」.

The source of truth is the approved one-page brief (4대 축 메커니즘 + 10가지 요인
+ 종합 시사점).  Every string that appears on that brief is stored here so the API,
the dashboard and the handoff document cannot drift apart.
"""
from __future__ import annotations

from typing import Any

SERVICE_NAME = "HD2Lab Market Intelligence"
SERVICE_SLUG = "market-intelligence"
VERSION = "0.1.0-draft"
BRIEF_TITLE = "기업 본질 가치와 무관한 경제 외적 주가 변동 요인 10선"

# ---------------------------------------------------------------------------
# 4대 축
# ---------------------------------------------------------------------------
AXES: tuple[dict[str, Any], ...] = (
    {
        "id": "AX01",
        "name": "지배구조·자본 이벤트",
        "factor_ids": (2, 9),
        "weight": 0.20,
        "summary": "주식 수·지분 구조·주주환원 정책처럼 기업의 자본 구조에서 직접 나오는 이벤트.",
        "watch": "공시(OpenDART) 원문이 1차 근거이며, 뉴스보다 공시 접수 시각이 먼저다.",
    },
    {
        "id": "AX02",
        "name": "수급·시장 구조 요인",
        "factor_ids": (3, 8),
        "weight": 0.25,
        "summary": "지수 편출입·패시브 자금·공매도 잔고처럼 가격을 만드는 기계적 매매 구조.",
        "watch": "거래량·거래대금 급증과 외국인/기관 순매수 방향으로 확인한다.",
    },
    {
        "id": "AX03",
        "name": "정치·외부 환경 충격",
        "factor_ids": (1, 6, 7),
        "weight": 0.25,
        "summary": "정치 테마, 지정학 갈등, 재난·감염병처럼 기업 외부에서 오는 충격.",
        "watch": "뉴스 빈도와 확산 속도가 핵심이며, 업종 단위 수혜/피해로 갈린다.",
    },
    {
        "id": "AX04",
        "name": "심리·평판·정보 확산",
        "factor_ids": (4, 5, 10),
        "weight": 0.30,
        "summary": "평판·신뢰 훼손과 미확인 정보의 확산이 만드는 기대와 공포.",
        "watch": "출처 신뢰도가 낮을수록 강도는 세고 수명은 짧다. 공시로 반증되는지가 관건.",
    },
)

# ---------------------------------------------------------------------------
# 10가지 요인 (표시 순서는 브리프 분류표 그대로: 2·9 / 3·8 / 1·6·7 / 4·5·10)
# ---------------------------------------------------------------------------
FACTORS: tuple[dict[str, Any], ...] = (
    {
        "id": 2,
        "name": "행동주의 및 주주환원",
        "axis_id": "AX01",
        "mechanism": "행동주의 펀드 개입, 자사주 소각·배당 확대 요구 및 물적분할 이슈",
        "direction": "split",
        "direction_label": "▲ 환원 / ▼ 분할",
        "outcomes": ("up", "down"),
        "weight": 0.9,
        "keywords": (
            "행동주의", "주주환원", "자사주", "자사주 소각", "배당 확대", "물적분할",
            "주주제안", "의결권", "주주총회", "얼라인", "밸류업", "주주행동",
        ),
        "disclosure_terms": ("자사주", "주주환원", "물적분할", "배당", "주주제안", "대량보유"),
        "disclosure_types": ("D", "B"),
        "primary_sources": ("opendart", "news_rss"),
    },
    {
        "id": 9,
        "name": "무상증자 및 액면분할",
        "axis_id": "AX01",
        "mechanism": "시총 변화 없는 주식 수 증가로 유동성 개선 및 저가 착시 효과 발생",
        "direction": "up",
        "direction_label": "▲ 단기 급등",
        "outcomes": ("up",),
        "weight": 0.85,
        "keywords": ("무상증자", "액면분할", "액면병합", "주식분할", "유동성 개선", "감자"),
        "disclosure_terms": ("무상증자", "액면분할", "액면병합", "주식분할", "감자"),
        "disclosure_types": ("B", "C"),
        "primary_sources": ("opendart",),
    },
    {
        "id": 3,
        "name": "주가지수 편입·리밸런싱",
        "axis_id": "AX02",
        "mechanism": "MSCI·코스피200 등 지수 편출입에 따른 패시브 자금의 기계적 매매",
        "direction": "split",
        "direction_label": "▲ 편입 / ▼ 편출",
        "outcomes": ("up", "down"),
        "weight": 0.8,
        "keywords": ("지수 편입", "지수 편출", "리밸런싱", "MSCI", "코스피200", "코스닥150", "패시브", "ETF 편입"),
        "disclosure_terms": (),
        "disclosure_types": (),
        "primary_sources": ("news_rss", "market_data"),
    },
    {
        "id": 8,
        "name": "공매도 숏 스퀴즈",
        "axis_id": "AX02",
        "mechanism": "과도한 공매도 누적 종목에 개인 매수세 결집 시 기관의 강제 쇼트커버링",
        "direction": "up",
        "direction_label": "▲ 폭등 연출",
        "outcomes": ("up",),
        "weight": 0.9,
        "keywords": ("공매도", "숏 스퀴즈", "쇼트커버링", "대차거래", "공매도 잔고", "숏커버", "공매도 금지"),
        "disclosure_terms": ("공매도",),
        "disclosure_types": (),
        "primary_sources": ("news_rss", "market_data"),
    },
    {
        "id": 1,
        "name": "정치 및 선거 테마",
        "axis_id": "AX03",
        "mechanism": "유력 정치인 인맥(학연·지연) 및 선거 공약 수혜주로 분류되어 변동성 확대",
        "direction": "both",
        "direction_label": "▲▼ 극심한 변동",
        "outcomes": ("up", "down"),
        "weight": 0.85,
        "keywords": ("정치 테마", "선거", "대선", "총선", "공약", "수혜주", "인맥", "친노", "친이", "지역구", "정부 정책"),
        "disclosure_terms": (),
        "disclosure_types": (),
        "primary_sources": ("news_rss",),
    },
    {
        "id": 6,
        "name": "지정학적 갈등·안보 위기",
        "axis_id": "AX03",
        "mechanism": "국지전·무역보복 등 정세 급변 시 위험 회피 및 방산·보안주 반사이익",
        "direction": "split",
        "direction_label": "▲ 수혜 / ▼ 시장",
        "outcomes": ("up", "down"),
        "weight": 0.9,
        "keywords": ("지정학", "전쟁", "무역분쟁", "관세", "수출통제", "제재", "안보", "미사일", "방산", "중동", "러시아", "대만"),
        "disclosure_terms": (),
        "disclosure_types": (),
        "primary_sources": ("news_rss",),
    },
    {
        "id": 7,
        "name": "자연재해 및 전염병 확산",
        "axis_id": "AX03",
        "mechanism": "재난·이상기후·감염병 발생 시 피해 업종 하락 및 복구·제약·비대면 수혜",
        "direction": "split",
        "direction_label": "▲ 수혜 / ▼ 피해",
        "outcomes": ("up", "down"),
        "weight": 0.75,
        "keywords": ("지진", "태풍", "홍수", "산불", "가뭄", "감염병", "전염병", "팬데믹", "독감", "조류인플루엔자", "메르스", "엘니뇨"),
        "disclosure_terms": (),
        "disclosure_types": (),
        "primary_sources": ("news_rss",),
    },
    {
        "id": 4,
        "name": "경영진 사법·도덕적 리스크",
        "axis_id": "AX04",
        "mechanism": "오너 횡령·배임·분식회계·일탈 보도로 거래정지 우려 및 불매운동 확산",
        "direction": "down",
        "direction_label": "▼ 급락·폭락",
        "outcomes": ("down",),
        "weight": 1.0,
        "keywords": ("횡령", "배임", "분식회계", "구속", "기소", "검찰", "재판", "거래정지", "불매운동", "사법리스크", "탈세", "경영권 분쟁"),
        "disclosure_terms": ("횡령", "배임", "조회공시", "거래정지", "불성실공시"),
        "disclosure_types": ("I", "E"),
        "primary_sources": ("opendart", "news_rss"),
    },
    {
        "id": 5,
        "name": "유명 인사·미디어 노출",
        "axis_id": "AX04",
        "mechanism": "글로벌 기업가·셀럽의 특정 기업·제품 언급 및 사용 노출에 따른 매수 쏠림",
        "direction": "up",
        "direction_label": "▲ 단기 급등",
        "outcomes": ("up",),
        "weight": 0.7,
        "keywords": ("일론 머스크", "머스크 언급", "셀럽", "연예인 사용", "SNS 언급", "트윗", "방문 인증", "품절 대란", "입소문"),
        "disclosure_terms": (),
        "disclosure_types": (),
        "primary_sources": ("news_rss",),
    },
    {
        "id": 10,
        "name": "커뮤니티·SNS발 루머",
        "axis_id": "AX04",
        "mechanism": "미확인 M&A·신약·부도설 유포로 선취매 유입 후 사실무근 공시 시 원위치",
        "direction": "reversal",
        "direction_label": "▲▼ 급등락 회귀",
        "outcomes": ("up", "down", "reversal"),
        "weight": 1.0,
        "keywords": ("루머", "풍문", "카더라", "찌라시", "M&A설", "인수설", "신약 기대", "부도설", "사실무근", "조회공시", "미확인"),
        "disclosure_terms": ("조회공시", "풍문", "보도해명", "사실무근"),
        "disclosure_types": ("I", "E"),
        "primary_sources": ("news_rss", "opendart"),
    },
)

FACTOR_BY_ID: dict[int, dict[str, Any]] = {f["id"]: f for f in FACTORS}
AXIS_BY_ID: dict[str, dict[str, Any]] = {a["id"]: a for a in AXES}

# 브리프 분류표의 행 순서
DISPLAY_ORDER: tuple[int, ...] = (2, 9, 3, 8, 1, 6, 7, 4, 5, 10)

# ---------------------------------------------------------------------------
# 메커니즘 다이어그램
# ---------------------------------------------------------------------------
MECHANISM: dict[str, Any] = {
    "center": "단기 수급 불균형 및 비이성적 기대·공포 증폭",
    "outcomes": (
        {
            "id": "UP",
            "label": "▲ 단기 급등",
            "detail": "테마·촉커버·수급",
            "note": "재료 소멸 시 차익실현 매물 출회",
            "tone": "up",
        },
        {
            "id": "DOWN",
            "label": "▼ 단기 급락",
            "detail": "리스크·강제 매도",
            "note": "불확실성 해소 전까지 투심 냉각",
            "tone": "down",
        },
        {
            "id": "REVERSION",
            "label": "↺ 평균 회귀 (Mean Reversion)",
            "detail": "실적 뒷받침 시 본질 가치로 복귀",
            "note": "이벤트 종료 후 내재 가치 회귀",
            "tone": "neutral",
        },
    ),
}

# ---------------------------------------------------------------------------
# 종합 시사점 및 투자자 대응 원칙 (브리프 3절 원문)
# ---------------------------------------------------------------------------
INVESTOR_PRINCIPLES: tuple[dict[str, str], ...] = (
    {
        "type": "비재무적 상승 요인",
        "trigger": "수급 쏠림, 이벤트성 기대감, 테마 형성에 의한 단기 과열",
        "action": "재료 소멸 시 급격한 차익실현 매물 출회 가능성 경계",
        "tone": "up",
    },
    {
        "type": "비재무적 하락 요인",
        "trigger": "신뢰도 훼손, 불확실성 증대, 기계적·강제적 매도 물량 출회",
        "action": "단순 낙폭 과대 인식보다 실제 펀더멘털 훼손 여부 검증",
        "tone": "down",
    },
)

CORE_CONCLUSION = (
    "경제 외적 요인은 단기 주가에 강력한 모멘텀과 변동성을 제공하지만, "
    "기업의 본질적 이익 창출 능력이 뒷받침되지 않을 경우 이벤트 종료와 함께 "
    "원래의 내재 가치로 회귀(Mean Reversion)하는 특성을 보인다."
)

DISCLAIMER = (
    "본 화면은 Server-HQ 내부 검토용 초안이며 특정 종목의 매수·매도 추천이 아닙니다. "
    "점수는 공개 데이터 기반 휴리스틱으로 산출되며 투자 판단의 근거로 사용할 수 없습니다."
)


def factor_payload() -> list[dict[str, Any]]:
    """10선 구조를 API 응답 형태로 직렬화한다(브리프 행 순서 유지)."""
    rows: list[dict[str, Any]] = []
    for fid in DISPLAY_ORDER:
        f = FACTOR_BY_ID[fid]
        axis = AXIS_BY_ID[f["axis_id"]]
        rows.append(
            {
                "id": f["id"],
                "name": f["name"],
                "axis_id": f["axis_id"],
                "axis_name": axis["name"],
                "mechanism": f["mechanism"],
                "direction": f["direction"],
                "direction_label": f["direction_label"],
                "outcomes": list(f["outcomes"]),
                "sources": list(f["primary_sources"]),
                "keyword_count": len(f["keywords"]),
            }
        )
    return rows


def axes_payload() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for axis in AXES:
        rows.append(
            {
                "id": axis["id"],
                "name": axis["name"],
                "factor_ids": list(axis["factor_ids"]),
                "factor_names": [FACTOR_BY_ID[i]["name"] for i in axis["factor_ids"]],
                "weight": axis["weight"],
                "summary": axis["summary"],
                "watch": axis["watch"],
            }
        )
    return rows


def factors_payload() -> dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "slug": SERVICE_SLUG,
        "version": VERSION,
        "brief_title": BRIEF_TITLE,
        "axes": axes_payload(),
        "factors": factor_payload(),
        "mechanism": {
            "center": MECHANISM["center"],
            "outcomes": [dict(o) for o in MECHANISM["outcomes"]],
            "inputs": [a["name"] for a in AXES],
        },
        "principles": [dict(p) for p in INVESTOR_PRINCIPLES],
        "core_conclusion": CORE_CONCLUSION,
        "disclaimer": DISCLAIMER,
    }


def validate_domain() -> list[str]:
    """도메인 정합성 검사. 비어 있으면 정상이며 테스트가 이 결과를 검사한다."""
    problems: list[str] = []
    ids = [f["id"] for f in FACTORS]
    if sorted(ids) != list(range(1, 11)):
        problems.append(f"요인 ID가 1~10이 아니다: {sorted(ids)}")
    if sorted(DISPLAY_ORDER) != list(range(1, 11)):
        problems.append("표시 순서가 10개 요인을 모두 포함하지 않는다")
    for axis in AXES:
        for fid in axis["factor_ids"]:
            f = FACTOR_BY_ID.get(fid)
            if f is None:
                problems.append(f"{axis['id']}가 없는 요인 {fid}를 가리킨다")
            elif f["axis_id"] != axis["id"]:
                problems.append(f"요인 {fid}의 축이 {f['axis_id']}로 불일치")
    covered = {fid for axis in AXES for fid in axis["factor_ids"]}
    if covered != set(ids):
        problems.append("축에 배정되지 않은 요인이 있다")
    weights = sum(a["weight"] for a in AXES)
    if abs(weights - 1.0) > 1e-9:
        problems.append(f"축 가중치 합이 1이 아니다: {weights}")
    for f in FACTORS:
        if not f["keywords"]:
            problems.append(f"요인 {f['id']}에 키워드가 없다")
        if not f["primary_sources"]:
            problems.append(f"요인 {f['id']}에 데이터 출처가 없다")
        if f["direction"] not in {"up", "down", "both", "split", "reversal"}:
            problems.append(f"요인 {f['id']}의 방향성 값이 정의 밖이다")
    return problems
