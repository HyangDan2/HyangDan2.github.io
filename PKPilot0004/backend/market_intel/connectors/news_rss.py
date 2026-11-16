"""Google News RSS 커넥터 (무료, API 키 불필요).

축별 키워드로 검색해 기사 목록을 모은다. 기사 태깅(요인 분류)은 `signals.py` 가
domain.py 의 키워드 사전으로 수행하므로, 이 커넥터는 사실 수집만 담당한다.
"""
from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus

from ..domain import AXES, FACTOR_BY_ID
from .base import (
    STATUS_ERROR,
    STATUS_LIVE,
    STATUS_SAMPLE,
    ConnectorResult,
    Fetcher,
    Stopwatch,
    TTLCache,
)

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"
_TAG_RE = re.compile(r"<[^>]+>")


def _clean(text: str | None) -> str:
    if not text:
        return ""
    return html.unescape(_TAG_RE.sub(" ", text)).replace("\n", " ").strip()


def _published(raw: str | None) -> str:
    if not raw:
        return ""
    try:
        dt = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def parse_rss(xml_text: str) -> list[dict]:
    """RSS 2.0 문서를 기사 dict 목록으로 바꾼다(네트워크 없이 검증 가능)."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []
    items: list[dict] = []
    for item in root.iter("item"):
        title = _clean(item.findtext("title"))
        if not title:
            continue
        source_el = item.find("source")
        items.append(
            {
                "title": title,
                "link": (item.findtext("link") or "").strip(),
                "source": _clean(source_el.text) if source_el is not None else "",
                "source_url": (source_el.get("url") if source_el is not None else "") or "",
                "published": _published(item.findtext("pubDate")),
                "summary": _clean(item.findtext("description"))[:400],
            }
        )
    return items


def axis_query(company: str, axis_id: str, days: int = 14) -> str:
    axis = next(a for a in AXES if a["id"] == axis_id)
    keywords: list[str] = []
    for fid in axis["factor_ids"]:
        for kw in FACTOR_BY_ID[fid]["keywords"][:3]:
            if kw not in keywords:
                keywords.append(kw)
    terms = " OR ".join(f'"{kw}"' for kw in keywords[:6])
    return f'"{company}" ({terms}) when:{days}d'


class NewsRssConnector:
    name = "news_rss"
    label = "Google News RSS"

    def __init__(
        self,
        fetcher: Fetcher,
        *,
        offline: bool = False,
        base_url: str = GOOGLE_NEWS_RSS,
        timeout: float = 6.0,
        cache: TTLCache | None = None,
        ttl: float = 900.0,
    ) -> None:
        self.fetcher = fetcher
        self.offline = offline
        self.base_url = base_url
        self.timeout = timeout
        self.cache = cache or TTLCache()
        self.ttl = ttl

    def _url(self, query: str) -> str:
        return f"{self.base_url}?q={quote_plus(query)}&hl=ko&gl=KR&ceid=KR:ko"

    def fetch(self, company: str, *, days: int = 14, axes: tuple[str, ...] = ("AX01", "AX02", "AX03", "AX04")) -> ConnectorResult:
        with Stopwatch() as sw:
            if self.offline:
                return ConnectorResult(
                    name=self.name,
                    status=STATUS_SAMPLE,
                    reason="오프라인/표본 모드: 외부 뉴스 요청을 보내지 않았습니다.",
                    elapsed_ms=sw.elapsed_ms,
                )

            collected: list[dict] = []
            seen: set[str] = set()
            errors: list[str] = []
            for axis_id in axes:
                query = axis_query(company, axis_id, days)
                url = self._url(query)
                cached = self.cache.get(url)
                if cached is None:
                    try:
                        resp = self.fetcher(url, timeout=self.timeout)
                    except Exception as exc:  # noqa: BLE001 - 무료 소스 실패는 폴백 대상
                        errors.append(f"{axis_id}: {type(exc).__name__}")
                        continue
                    if not resp.ok:
                        errors.append(f"{axis_id}: HTTP {resp.status}")
                        continue
                    cached = parse_rss(resp.text)
                    self.cache.set(url, cached, self.ttl)
                for article in cached:
                    key = article["title"]
                    if key in seen:
                        continue
                    seen.add(key)
                    collected.append({**article, "axis_hint": axis_id})

            if not collected:
                reason = "뉴스 검색 결과가 없습니다." if not errors else f"뉴스 소스 실패({', '.join(errors)})"
                return ConnectorResult(
                    name=self.name,
                    status=STATUS_ERROR,
                    reason=reason,
                    items=[],
                    elapsed_ms=sw.elapsed_ms,
                )
            return ConnectorResult(
                name=self.name,
                status=STATUS_LIVE,
                items=collected[:60],
                reason=f"{len(collected)}건 수집" + (f" / 일부 축 실패: {', '.join(errors)}" if errors else ""),
                source_url="https://news.google.com/",
                elapsed_ms=sw.elapsed_ms,
            )
