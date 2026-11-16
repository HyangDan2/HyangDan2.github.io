"""분석 오케스트레이션: 종목 해석 → 무료 소스 수집 → 신호 태깅 → 스코어링.

커넥터 하나가 죽어도 전체 응답은 나간다. 대신 어떤 데이터가 실데이터가 아니라
표본인지 응답의 `sources`·`data_gaps`·`mode` 에 그대로 남긴다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from . import samples
from .connectors.base import ConnectorResult, HttpxFetcher, OfflineFetcher, STATUS_DISABLED, STATUS_ERROR, STATUS_LIVE, STATUS_SAMPLE, TTLCache
from .connectors.market_data import NaverQuoteConnector, YahooQuoteConnector, is_korean_ticker
from .connectors.news_rss import NewsRssConnector
from .connectors.opendart import OpenDartConnector
from .domain import DISCLAIMER, SERVICE_NAME, SERVICE_SLUG, VERSION, factors_payload
from .scoring import score_payload
from .signals import build_signals


@dataclass
class Settings:
    opendart_api_key: str = ""
    offline: bool = False
    timeout: float = 6.0
    user_agent: str = "HD2Lab-MarketIntel/0.1 (draft)"
    news_days: int = 14
    disclosure_days: int = 30
    analysis_ttl: float = 180.0
    extra: dict[str, Any] = field(default_factory=dict)


class UnknownSymbol(LookupError):
    def __init__(self, query: str, suggestions: list[dict[str, str]]) -> None:
        super().__init__(query)
        self.query = query
        self.suggestions = suggestions


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MarketIntelligenceService:
    def __init__(self, settings: Settings | None = None, fetcher=None) -> None:
        self.settings = settings or Settings()
        self.fetcher = fetcher if fetcher is not None else (OfflineFetcher() if self.settings.offline else HttpxFetcher(self.settings.user_agent))
        self.cache = TTLCache()
        self.navers = NaverQuoteConnector(self.fetcher, offline=self.settings.offline, timeout=self.settings.timeout, cache=self.cache)
        self.yahoo = YahooQuoteConnector(self.fetcher, offline=self.settings.offline, timeout=self.settings.timeout, cache=self.cache)
        self.news = NewsRssConnector(self.fetcher, offline=self.settings.offline, timeout=self.settings.timeout, cache=self.cache)
        self.dart = OpenDartConnector(self.fetcher, api_key=self.settings.opendart_api_key, offline=self.settings.offline, timeout=self.settings.timeout, cache=self.cache)

    # -- public ---------------------------------------------------------
    def factors(self) -> dict[str, Any]:
        return factors_payload()

    def health(self) -> dict[str, Any]:
        return {
            "status": "ok",
            "service": SERVICE_NAME,
            "slug": SERVICE_SLUG,
            "version": VERSION,
            "mode": "offline" if self.settings.offline else "online",
            "connectors": {
                "naver_quote": {"status": "disabled" if self.settings.offline else "ready", "key_required": False},
                "yahoo_quote": {"status": "disabled" if self.settings.offline else "ready", "key_required": False},
                "news_rss": {"status": "disabled" if self.settings.offline else "ready", "key_required": False},
                "opendart": {
                    "status": "ready" if (self.settings.opendart_api_key and not self.settings.offline) else STATUS_DISABLED,
                    "key_required": True,
                    "reason": "" if self.settings.opendart_api_key else "OPENDART_API_KEY 미설정 → 표본 공시 폴백",
                },
            },
            "generated_at": _now().isoformat(),
        }

    def analyze(self, query: str) -> dict[str, Any]:
        query = (query or "").strip()
        ticker = self.resolve(query)
        cache_key = f"analyze:{ticker}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached
        payload = self._analyze(query, ticker)
        self.cache.set(cache_key, payload, self.settings.analysis_ttl)
        return payload

    def resolve(self, query: str) -> str:
        if not query:
            raise UnknownSymbol(query, samples.suggestions())
        code = samples.resolve_symbol(query)
        if code:
            return code
        upper = query.upper().strip()
        if upper.isascii() and upper.isalpha() and 1 <= len(upper) <= 6:
            return upper  # 해외 티커(예: TSLA)
        raise UnknownSymbol(query, samples.suggestions())

    # -- internals ------------------------------------------------------
    def _quote(self, ticker: str) -> tuple[dict | None, ConnectorResult]:
        if is_korean_ticker(ticker):
            result = self.navers.fetch(ticker)
            if result.live and result.items:
                quote = dict(result.items[0])
                quote["source_url"] = result.source_url
                return quote, result
            sample = samples.sample_quote(ticker)
            if sample:
                fallback = ConnectorResult(
                    name=result.name,
                    status=STATUS_SAMPLE,
                    items=[dict(sample)],
                    reason=f"시세 폴백: {result.reason}" if result.reason else "표본 시세",
                    source_url=sample.get("source_url", ""),
                    elapsed_ms=result.elapsed_ms,
                )
                return dict(sample), fallback
            return None, result

        result = self.yahoo.fetch(ticker)
        if result.live and result.items:
            quote = dict(result.items[0])
            quote["source_url"] = result.source_url
            return quote, result
        return None, result

    def _news(self, company: str, ticker: str) -> tuple[list[dict], ConnectorResult]:
        result = self.news.fetch(company, days=self.settings.news_days)
        if result.live and result.items:
            return result.items, result
        sample = samples.sample_news(ticker)
        if sample:
            return sample, ConnectorResult(
                name=result.name,
                status=STATUS_SAMPLE,
                items=sample,
                reason=f"뉴스 폴백: {result.reason}" if result.reason else "표본 뉴스",
                source_url="",
                elapsed_ms=result.elapsed_ms,
            )
        return [], result

    def _disclosures(self, ticker: str) -> tuple[list[dict], ConnectorResult]:
        result = self.dart.fetch(ticker, days=self.settings.disclosure_days)
        if result.live:
            return result.items, result
        sample = samples.sample_disclosures(ticker)
        if sample:
            return sample, ConnectorResult(
                name=result.name,
                status=STATUS_SAMPLE,
                items=sample,
                reason=f"공시 폴백: {result.reason}" if result.reason else "표본 공시",
                source_url="https://dart.fss.or.kr/",
                elapsed_ms=result.elapsed_ms,
            )
        return [], result

    def _analyze(self, query: str, ticker: str) -> dict[str, Any]:
        quote, quote_result = self._quote(ticker)
        company = (quote or {}).get("name") or samples.SYMBOL_REGISTRY.get(query.lower(), query) or query
        articles, news_result = self._news(company, ticker)
        disclosures, dart_result = self._disclosures(ticker)

        sources = [quote_result.summary(), news_result.summary(), dart_result.summary()]
        signals = build_signals(articles=articles, disclosures=disclosures, quote=quote)
        scoring = score_payload(signals=signals, quote=quote, sources=sources)

        live = sum(1 for s in sources if s["status"] == STATUS_LIVE)
        sample = sum(1 for s in sources if s["status"] == STATUS_SAMPLE)
        mode = "live" if live == len(sources) else "mixed" if live else "sample"

        return {
            "service": SERVICE_NAME,
            "slug": SERVICE_SLUG,
            "version": VERSION,
            "generated_at": _now().isoformat(),
            "q": query,
            "entity": {
                "ticker": ticker,
                "name": company,
                "market": (quote or {}).get("market", ""),
                "currency": (quote or {}).get("currency", ""),
                "source": (quote or {}).get("source", "none"),
            },
            "mode": mode,
            "quote": self._quote_payload(quote),
            "signals": [s.as_dict() for s in signals],
            "scoring": scoring,
            "sources": sources,
            "data_gaps": self._data_gaps(sources, quote),
            "disclaimer": DISCLAIMER,
            "sample_as_of": samples.SAMPLE_AS_OF if mode != "live" else "",
        }

    @staticmethod
    def _quote_payload(quote: dict | None) -> dict[str, Any]:
        if not quote:
            return {"available": False}
        keys = (
            "ticker", "name", "market", "currency", "price", "change_pct", "volume", "avg_volume_20d",
            "market_cap", "per", "pbr", "eps", "consensus_per", "consensus_eps", "high_52w", "low_52w",
            "ma20", "ma60", "foreign_net", "institution_net", "individual_net", "traded_at", "source", "source_url",
        )
        payload = {k: quote.get(k) for k in keys if quote.get(k) is not None}
        for key in ("price", "volume", "avg_volume_20d", "per", "pbr", "eps", "consensus_per", "consensus_eps", "high_52w", "low_52w", "ma20", "ma60"):
            value = payload.get(key)
            if isinstance(value, float) and value.is_integer():
                payload[key] = int(value)
        payload["available"] = bool(quote.get("price"))
        if quote.get("volume") and quote.get("avg_volume_20d"):
            payload["volume_ratio"] = round(quote["volume"] / quote["avg_volume_20d"], 2)
        return payload

    def _data_gaps(self, sources: list[dict[str, Any]], quote: dict | None) -> list[str]:
        gaps: list[str] = []
        for source in sources:
            if source["status"] in {STATUS_DISABLED, STATUS_ERROR}:
                gaps.append(f"{source['name']}: {source['reason'] or source['status']}")
        if not self.settings.opendart_api_key:
            gaps.append("OpenDART 키 미설정 → 공시 근거는 표본입니다(무료 키 발급 후 실데이터 전환).")
        if not quote or not quote.get("per"):
            gaps.append("PER/PBR 없음 → 평균 회귀 계산에서 밸류에이션 항목이 빠집니다.")
        gaps.append("공매도 잔고는 무료 실시간 API 미제공 → 수급 역전으로 대체 추정합니다.")
        return gaps
