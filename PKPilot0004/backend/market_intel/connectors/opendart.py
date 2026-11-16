"""OpenDART 공시 커넥터 (무료, 일 10,000건 한도, API 키 필요).

키가 없으면 커넥터는 ``disabled`` 로 남고 분석은 표본 공시로 폴백한다.
키가 있으면 corp_code.xml(전체 기업 고유번호)을 한 번 받아 캐시하고,
최근 공시 목록을 종목별로 조회한다.
"""
from __future__ import annotations

import io
import xml.etree.ElementTree as ET
import zipfile
from datetime import date, datetime, timedelta, timezone

from .base import (
    STATUS_DISABLED,
    STATUS_ERROR,
    STATUS_LIVE,
    STATUS_SAMPLE,
    ConnectorResult,
    Fetcher,
    Stopwatch,
    TTLCache,
)

CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"
DISCLOSURE_URL = "https://opendart.fss.or.kr/api/list.json"

# OpenDART list.json pblntf_detail_ty 코드 (요인별 1차 필터)
DETAIL_TYPE_LABELS = {
    "A": "정기공시",
    "B": "주요사항보고",
    "C": "발행공시",
    "D": "지분공시",
    "E": "기타공시",
    "F": "외부감사관련",
    "I": "거래소공시",
}

STATUS_OK = "000"


class CorpCodeIndex:
    """CORPCODE.xml(ZIP) → {stock_code: corp_code} 인덱스."""

    def __init__(self) -> None:
        self.by_stock: dict[str, dict] = {}

    @classmethod
    def from_zip_bytes(cls, payload: bytes) -> "CorpCodeIndex":
        index = cls()
        with zipfile.ZipFile(io.BytesIO(payload)) as zf:
            name = next((n for n in zf.namelist() if n.lower().endswith(".xml")), None)
            if name is None:
                return index
            root = ET.fromstring(zf.read(name))
        for row in root.iter("list"):
            stock = (row.findtext("stock_code") or "").strip()
            corp_code = (row.findtext("corp_code") or "").strip()
            if not stock or not corp_code:
                continue
            index.by_stock[stock] = {
                "corp_code": corp_code,
                "corp_name": (row.findtext("corp_name") or "").strip(),
                "corp_cls": (row.findtext("corp_cls") or "").strip(),
                "modify_date": (row.findtext("modify_date") or "").strip(),
            }
        return index


def classify_report(report_nm: str) -> list[int]:
    """공시 제목에서 해당 요인 ID 목록을 뽑는다(키워드 기반 초안 로직)."""
    from ..domain import FACTORS

    hits: list[int] = []
    for factor in FACTORS:
        for term in factor["disclosure_terms"]:
            if term and term in report_nm:
                hits.append(factor["id"])
                break
    return hits


class OpenDartConnector:
    name = "opendart"
    label = "OpenDART 공시"

    def __init__(
        self,
        fetcher: Fetcher,
        *,
        api_key: str = "",
        offline: bool = False,
        timeout: float = 8.0,
        cache: TTLCache | None = None,
        corp_cache_ttl: float = 60 * 60 * 24 * 30,
        list_ttl: float = 3600.0,
    ) -> None:
        self.fetcher = fetcher
        self.api_key = api_key
        self.offline = offline
        self.timeout = timeout
        self.cache = cache or TTLCache()
        self.corp_cache_ttl = corp_cache_ttl
        self.list_ttl = list_ttl
        self._index: CorpCodeIndex | None = None

    @property
    def configured(self) -> bool:
        return bool(self.api_key) and not self.offline

    def _load_index(self) -> CorpCodeIndex:
        if self._index is not None:
            return self._index
        cached = self.cache.get("corp_codes")
        if isinstance(cached, CorpCodeIndex):
            self._index = cached
            return cached
        resp = self.fetcher(f"{CORP_CODE_URL}?crtfc_key={self.api_key}", timeout=self.timeout)
        if not resp.ok:
            raise RuntimeError(f"corpCode HTTP {resp.status}")
        payload = resp.content if resp.content is not None else resp.text.encode("utf-8")
        index = CorpCodeIndex.from_zip_bytes(payload)
        self.cache.set("corp_codes", index, self.corp_cache_ttl)
        self._index = index
        return index

    def corp_code_for(self, ticker: str) -> str | None:
        entry = self._load_index().by_stock.get(ticker)
        return entry["corp_code"] if entry else None

    def fetch(self, ticker: str, *, days: int = 30) -> ConnectorResult:
        with Stopwatch() as sw:
            if self.offline:
                return ConnectorResult(
                    name=self.name,
                    status=STATUS_SAMPLE,
                    reason="오프라인/표본 모드: OpenDART 를 호출하지 않았습니다.",
                    elapsed_ms=sw.elapsed_ms,
                )
            if not self.api_key:
                return ConnectorResult(
                    name=self.name,
                    status=STATUS_DISABLED,
                    reason="OPENDART_API_KEY 미설정: 표본 공시로 대체합니다.",
                    elapsed_ms=sw.elapsed_ms,
                )
            try:
                corp_code = self.corp_code_for(ticker)
            except Exception as exc:  # noqa: BLE001
                return ConnectorResult(
                    name=self.name,
                    status=STATUS_ERROR,
                    reason=f"고유번호 조회 실패: {type(exc).__name__}",
                    elapsed_ms=sw.elapsed_ms,
                )
            if not corp_code:
                return ConnectorResult(
                    name=self.name,
                    status=STATUS_ERROR,
                    reason=f"고유번호를 찾지 못했습니다(종목 {ticker}).",
                    elapsed_ms=sw.elapsed_ms,
                )

            end = date.today()
            begin = end - timedelta(days=days)
            url = (
                f"{DISCLOSURE_URL}?crtfc_key={self.api_key}&corp_code={corp_code}"
                f"&bgn_de={begin:%Y%m%d}&end_de={end:%Y%m%d}&page_count=50&sort=date"
            )
            try:
                resp = self.fetcher(url, timeout=self.timeout)
                payload = _json(resp.text)
            except Exception as exc:  # noqa: BLE001
                return ConnectorResult(
                    name=self.name,
                    status=STATUS_ERROR,
                    reason=f"공시 조회 실패: {type(exc).__name__}",
                    elapsed_ms=sw.elapsed_ms,
                )
            if payload.get("status") != STATUS_OK:
                return ConnectorResult(
                    name=self.name,
                    status=STATUS_ERROR,
                    reason=f"OpenDART 응답 {payload.get('status')}: {payload.get('message', '')}".strip(),
                    elapsed_ms=sw.elapsed_ms,
                )
            rows = payload.get("list") or []
            items = []
            for row in rows:
                report_nm = (row.get("report_nm") or "").strip()
                items.append(
                    {
                        "report_nm": report_nm,
                        "corp_name": row.get("corp_name", ""),
                        "rcept_dt": row.get("rcept_dt", ""),
                        "rcept_no": row.get("rcept_no", ""),
                        "flr_nm": row.get("flr_nm", ""),
                        "url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={row.get('rcept_no', '')}",
                        "factor_hits": classify_report(report_nm),
                    }
                )
            return ConnectorResult(
                name=self.name,
                status=STATUS_LIVE,
                items=items,
                reason=f"최근 {days}일 공시 {len(items)}건",
                source_url="https://opendart.fss.or.kr/",
                elapsed_ms=sw.elapsed_ms,
            )


def _json(text: str) -> dict:
    import json

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"status": "parse_error", "message": "JSON 아님"}


def business_days_between(start: date, end: date) -> int:
    days = 0
    cursor = start
    while cursor <= end:
        if cursor.weekday() < 5:
            days += 1
        cursor += timedelta(days=1)
    return days


def recency_weight(rcept_dt: str, *, now: datetime | None = None, half_life_days: float = 10.0) -> float:
    """공시 접수일이 오래될수록 신호를 약하게 만든다(지수 감쇠)."""
    if not rcept_dt:
        return 0.0
    try:
        parsed = datetime.strptime(rcept_dt, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return 0.0
    now = now or datetime.now(timezone.utc)
    age_days = max(0.0, (now - parsed).total_seconds() / 86400)
    return 0.5 ** (age_days / half_life_days)
