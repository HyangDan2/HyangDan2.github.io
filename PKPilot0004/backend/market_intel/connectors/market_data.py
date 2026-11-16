"""무료 시세·밸류에이션 커넥터.

1순위 네이버 금융 공개 JSON(키 불필요, 국내 종목), 2순위 Yahoo Finance chart API
(키 불필요, 해외 종목), 마지막은 표본 데이터. 어느 단계에서 실패해도 예외를 밖으로
던지지 않고 ``ConnectorResult.status`` 로 실패 사실을 남긴다.
"""
from __future__ import annotations

import json
import statistics
from datetime import datetime, timezone
from urllib.parse import quote

from .base import (
    STATUS_ERROR,
    STATUS_LIVE,
    STATUS_SAMPLE,
    ConnectorResult,
    Fetcher,
    Stopwatch,
    TTLCache,
)

NAVER_BASIC = "https://m.stock.naver.com/api/stock/{ticker}/basic"
NAVER_INTEGRATION = "https://m.stock.naver.com/api/stock/{ticker}/integration"
NAVER_PRICE = "https://m.stock.naver.com/api/stock/{ticker}/price?pageSize=60&page={page}"
NAVER_ITEM = "https://finance.naver.com/item/main.naver?code={ticker}"
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=6mo&interval=1d"
YAHOO_ITEM = "https://finance.yahoo.com/quote/{symbol}"


def to_number(value) -> float | None:
    """'209,000', '4조 4,406억', '9.38배', '+8,216' 같은 표기를 숫자로 바꾼다."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "").replace("%", "")
    if not text:
        return None
    multiplier = 1.0
    if text.endswith("배"):
        text = text[:-1]
    if "조" in text:
        head, _, tail = text.partition("조")
        base = to_number(head) or 0.0
        rest = to_number(tail.replace("억", "")) if tail.strip() else 0.0
        return base * 1e12 + (rest or 0.0) * 1e8
    if text.endswith("억"):
        return (to_number(text[:-1]) or 0.0) * 1e8
    try:
        return float(text) * multiplier
    except ValueError:
        return None


def _json(text: str):
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


def moving_average(values: list[float], window: int) -> float | None:
    if len(values) < window:
        return None
    return round(sum(values[:window]) / window, 2)


def parse_naver(basic: dict, integration: dict | None, history: list | None) -> dict:
    """네이버 응답 3종을 하나의 quote dict 로 합친다(단위 테스트 대상)."""
    infos = {}
    for row in (integration or {}).get("totalInfos") or []:
        code = row.get("code")
        if code:
            infos[code] = row.get("value")

    closes = [c for c in (to_number(r.get("closePrice")) for r in (history or [])) if c]
    volumes = [v for v in (to_number(r.get("accumulatedTradingVolume")) for r in (history or [])) if v]
    trend = ((integration or {}).get("dealTrendInfos") or [{}])[0]

    return {
        "ticker": basic.get("itemCode", ""),
        "name": basic.get("stockName", ""),
        "market": (basic.get("stockExchangeType") or {}).get("name", ""),
        "currency": "KRW",
        "price": to_number(basic.get("closePrice")),
        "change_pct": to_number(basic.get("fluctuationsRatio")),
        "volume": to_number(infos.get("accumulatedTradingVolume") or trend.get("accumulatedTradingVolume")),
        "avg_volume_20d": (sum(volumes[:20]) / len(volumes[:20])) if len(volumes) >= 5 else None,
        "market_cap_value": to_number(infos.get("marketValue")),
        "market_cap": infos.get("marketValue", ""),
        "per": to_number(infos.get("per")),
        "pbr": to_number(infos.get("pbr")),
        "eps": to_number(infos.get("eps")),
        "consensus_per": to_number(infos.get("cnsPer")),
        "consensus_eps": to_number(infos.get("cnsEps")),
        "dividend_yield": to_number(infos.get("dividendYieldRatio")),
        "high_52w": to_number(infos.get("highPriceOf52Weeks")),
        "low_52w": to_number(infos.get("lowPriceOf52Weeks")),
        "ma20": moving_average(closes, 20),
        "ma60": moving_average(closes, 60),
        "foreign_net": to_number(trend.get("foreignerPureBuyQuant")),
        "institution_net": to_number(trend.get("organPureBuyQuant")),
        "individual_net": to_number(trend.get("individualPureBuyQuant")),
        "traded_at": basic.get("localTradedAt", ""),
        "market_status": basic.get("marketStatus", ""),
        "source": "naver",
    }


def parse_yahoo(payload: dict, symbol: str) -> dict:
    result = ((payload.get("chart") or {}).get("result") or [{}])[0]
    meta = result.get("meta") or {}
    timestamps = result.get("timestamp") or []
    quote_rows = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    closes = [c for c in (quote_rows.get("close") or []) if c is not None]
    volumes = [v for v in (quote_rows.get("volume") or []) if v is not None]
    price = meta.get("regularMarketPrice")
    if price is None and closes:
        price = closes[-1]
    prev = closes[-2] if len(closes) >= 2 else None
    change_pct = ((price / prev - 1) * 100) if price and prev else None
    return {
        "ticker": symbol,
        "name": meta.get("longName") or meta.get("shortName") or symbol,
        "market": meta.get("exchangeName", ""),
        "currency": meta.get("currency", ""),
        "price": price,
        "change_pct": round(change_pct, 2) if change_pct is not None else None,
        "volume": volumes[-1] if volumes else None,
        "avg_volume_20d": (sum(volumes[:20]) / len(volumes[:20])) if len(volumes) >= 5 else None,
        "market_cap": "",
        "market_cap_value": meta.get("marketCap"),
        "per": None,
        "pbr": None,
        "eps": None,
        "consensus_per": None,
        "consensus_eps": None,
        "high_52w": meta.get("fiftyTwoWeekHigh"),
        "low_52w": meta.get("fiftyTwoWeekLow"),
        "ma20": moving_average(closes[::-1], 20),
        "ma60": moving_average(closes[::-1], 60),
        "foreign_net": None,
        "institution_net": None,
        "individual_net": None,
        "traded_at": datetime.fromtimestamp(meta["regularMarketTime"], timezone.utc).isoformat()
        if meta.get("regularMarketTime")
        else "",
        "market_status": "",
        "source": "yahoo",
        "history_points": len(closes),
        "first_trade_date": datetime.fromtimestamp(timestamps[0], timezone.utc).date().isoformat() if timestamps else "",
    }


class NaverQuoteConnector:
    name = "naver_quote"
    label = "네이버 금융(무료, 키 불필요)"

    def __init__(self, fetcher: Fetcher, *, offline: bool = False, timeout: float = 6.0, cache: TTLCache | None = None, ttl: float = 120.0) -> None:
        self.fetcher = fetcher
        self.offline = offline
        self.timeout = timeout
        self.cache = cache or TTLCache()
        self.ttl = ttl

    def fetch(self, ticker: str) -> ConnectorResult:
        with Stopwatch() as sw:
            if self.offline:
                return ConnectorResult(name=self.name, status=STATUS_SAMPLE, reason="오프라인/표본 모드", elapsed_ms=sw.elapsed_ms)
            key = f"naver:{ticker}"
            cached = self.cache.get(key)
            if cached is not None:
                return ConnectorResult(name=self.name, status=STATUS_LIVE, items=[cached], reason="캐시", source_url=NAVER_ITEM.format(ticker=ticker), elapsed_ms=sw.elapsed_ms)
            try:
                basic = _json(self.fetcher(NAVER_BASIC.format(ticker=ticker), timeout=self.timeout).text)
                if not basic or not basic.get("itemCode"):
                    raise ValueError("basic 응답 없음")
                integration = _json(self.fetcher(NAVER_INTEGRATION.format(ticker=ticker), timeout=self.timeout).text) or {}
                history: list = []
                for page in (1, 2):
                    chunk = _json(self.fetcher(NAVER_PRICE.format(ticker=ticker, page=page), timeout=self.timeout).text)
                    if isinstance(chunk, list):
                        history.extend(chunk)
                    else:
                        break
            except Exception as exc:  # noqa: BLE001
                return ConnectorResult(name=self.name, status=STATUS_ERROR, reason=f"시세 조회 실패: {type(exc).__name__}", elapsed_ms=sw.elapsed_ms)
            quote = parse_naver(basic, integration, history)
            self.cache.set(key, quote, self.ttl)
            return ConnectorResult(
                name=self.name,
                status=STATUS_LIVE,
                items=[quote],
                reason=f"{quote['name']} 현재가 {quote['price']:,}원" if quote.get("price") else "시세 수신",
                source_url=NAVER_ITEM.format(ticker=ticker),
                elapsed_ms=sw.elapsed_ms,
            )


class YahooQuoteConnector:
    name = "yahoo_quote"
    label = "Yahoo Finance(무료, 키 불필요)"

    def __init__(self, fetcher: Fetcher, *, offline: bool = False, timeout: float = 6.0, cache: TTLCache | None = None, ttl: float = 120.0) -> None:
        self.fetcher = fetcher
        self.offline = offline
        self.timeout = timeout
        self.cache = cache or TTLCache()
        self.ttl = ttl

    def fetch(self, symbol: str) -> ConnectorResult:
        with Stopwatch() as sw:
            if self.offline:
                return ConnectorResult(name=self.name, status=STATUS_SAMPLE, reason="오프라인/표본 모드", elapsed_ms=sw.elapsed_ms)
            key = f"yahoo:{symbol}"
            cached = self.cache.get(key)
            if cached is not None:
                return ConnectorResult(name=self.name, status=STATUS_LIVE, items=[cached], reason="캐시", source_url=YAHOO_ITEM.format(symbol=quote(symbol)), elapsed_ms=sw.elapsed_ms)
            try:
                payload = _json(self.fetcher(YAHOO_CHART.format(symbol=quote(symbol)), timeout=self.timeout).text)
                if not payload or payload.get("chart", {}).get("error"):
                    raise ValueError("chart 응답 없음")
                quote_row = parse_yahoo(payload, symbol)
            except Exception as exc:  # noqa: BLE001
                return ConnectorResult(name=self.name, status=STATUS_ERROR, reason=f"Yahoo 조회 실패: {type(exc).__name__}", elapsed_ms=sw.elapsed_ms)
            if not quote_row.get("price"):
                return ConnectorResult(name=self.name, status=STATUS_ERROR, reason="Yahoo 가격 필드 없음", elapsed_ms=sw.elapsed_ms)
            self.cache.set(key, quote_row, self.ttl)
            return ConnectorResult(
                name=self.name,
                status=STATUS_LIVE,
                items=[quote_row],
                reason=f"{quote_row['name']} {quote_row['price']}",
                source_url=YAHOO_ITEM.format(symbol=quote(symbol)),
                elapsed_ms=sw.elapsed_ms,
            )


def is_korean_ticker(ticker: str) -> bool:
    return ticker.isdigit() and len(ticker) == 6


def median(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    return statistics.median(clean)
