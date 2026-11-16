from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timedelta, timezone

import pytest
from conftest import FakeFetcher

from market_intel.connectors.base import FetchResponse, TTLCache
from market_intel.connectors.opendart import OpenDartConnector
from market_intel.service import MarketIntelligenceService, Settings, UnknownSymbol


def _rss(title: str, days_ago: int = 1) -> str:
    published = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%a, %d %b %Y %H:%M:%S GMT")
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<item><title>{title}</title><link>https://news.example/x</link>
<source url="https://example.com">표본경제</source>
<pubDate>{published}</pubDate><description>요약</description></item>
</channel></rss>"""


def _corp_zip() -> bytes:
    buffer = io.BytesIO()
    xml = "<result><list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code><corp_cls>Y</corp_cls></list></result>"
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("CORPCODE.xml", xml)
    return buffer.getvalue()


def _basic() -> str:
    return json.dumps(
        {
            "itemCode": "005930",
            "stockName": "삼성전자",
            "closePrice": "209,000",
            "fluctuationsRatio": "0.48",
            "localTradedAt": "2026-11-13T20:20:24+09:00",
            "stockExchangeType": {"name": "KOSPI"},
        }
    )


def _integration() -> str:
    return json.dumps(
        {
            "totalInfos": [
                {"code": "per", "value": "9.38배"},
                {"code": "cnsPer", "value": "4.58배"},
                {"code": "eps", "value": "22,292원"},
                {"code": "cnsEps", "value": "45,655원"},
                {"code": "highPriceOf52Weeks", "value": "380,000"},
                {"code": "lowPriceOf52Weeks", "value": "93,500"},
            ],
            "dealTrendInfos": [{"foreignerPureBuyQuant": "+8,216", "organPureBuyQuant": "-328,604", "individualPureBuyQuant": "+285,654", "accumulatedTradingVolume": "48000000"}],
        }
    )


def _history() -> str:
    return json.dumps([{"closePrice": str(120000 + i * 500), "accumulatedTradingVolume": str(10000000)} for i in range(90)])


def _dart_listing() -> str:
    return json.dumps(
        {
            "status": "000",
            "message": "정상",
            "list": [
                {
                    "report_nm": "주요사항보고서(자사주취득결정)",
                    "corp_name": "삼성전자",
                    "rcept_dt": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "rcept_no": "20261114000123",
                    "flr_nm": "삼성전자",
                }
            ],
        }
    )


@pytest.fixture
def live_service() -> MarketIntelligenceService:
    fetcher = FakeFetcher(
        {
            "/basic": FetchResponse(200, _basic()),
            "/integration": FetchResponse(200, _integration()),
            "/price": FetchResponse(200, _history()),
            "news.google.com": FetchResponse(200, _rss("삼성전자, 행동주의 펀드 자사주 소각·배당 확대 요구")),
            "corpCode.xml": FetchResponse(200, "", content=_corp_zip()),
            "list.json": FetchResponse(200, _dart_listing()),
        }
    )
    return MarketIntelligenceService(Settings(offline=False, opendart_api_key="KEY"), fetcher=fetcher)


def test_live_mode_uses_all_connectors(live_service: MarketIntelligenceService) -> None:
    body = live_service.analyze("005930")
    assert body["mode"] == "live"
    statuses = {s["name"]: s["status"] for s in body["sources"]}
    assert statuses == {"naver_quote": "live", "news_rss": "live", "opendart": "live"}
    assert body["quote"]["per"] == 9.38
    factor_ids = {s["factor_id"] for s in body["signals"]}
    assert 2 in factor_ids  # 자사주 공시 + 뉴스


def test_live_analyze_has_no_sample_gap(live_service: MarketIntelligenceService) -> None:
    body = live_service.analyze("005930")
    assert not any("표본" in gap for gap in body["data_gaps"])


def test_mixed_mode_when_news_fails() -> None:
    fetcher = FakeFetcher(
        {
            "/basic": FetchResponse(200, _basic()),
            "/integration": FetchResponse(200, _integration()),
            "/price": FetchResponse(200, _history()),
            "news.google.com": FetchResponse(503, ""),
        }
    )
    service = MarketIntelligenceService(Settings(offline=False, opendart_api_key=""), fetcher=fetcher)
    body = service.analyze("005930")
    assert body["mode"] == "mixed"
    statuses = {s["name"]: s["status"] for s in body["sources"]}
    assert statuses["naver_quote"] == "live"
    assert statuses["news_rss"] == "sample"
    assert statuses["opendart"] == "sample"


def test_offline_mode_never_calls_network() -> None:
    fetcher = FakeFetcher({})
    service = MarketIntelligenceService(Settings(offline=True), fetcher=fetcher)
    body = service.analyze("005930")
    assert body["mode"] == "sample"
    assert fetcher.calls == []
    assert body["sample_as_of"]


def test_service_analysis_cache_avoids_duplicate_work(live_service: MarketIntelligenceService) -> None:
    first = live_service.analyze("005930")
    second = live_service.analyze("005930")
    assert first is second


def test_resolve_handles_aliases_and_us_tickers() -> None:
    service = MarketIntelligenceService(Settings(offline=True))
    assert service.resolve("삼성전자") == "005930"
    assert service.resolve("하이닉스") == "000660"
    assert service.resolve("TSLA") == "TSLA"
    with pytest.raises(UnknownSymbol):
        service.resolve("")


def test_unknown_symbol_carries_suggestions() -> None:
    service = MarketIntelligenceService(Settings(offline=True))
    with pytest.raises(UnknownSymbol) as exc:
        service.resolve("없는종목")
    assert exc.value.suggestions


def test_us_ticker_without_data_reports_gap() -> None:
    service = MarketIntelligenceService(Settings(offline=True))
    body = service.analyze("TSLA")
    assert body["entity"]["ticker"] == "TSLA"
    assert body["quote"]["available"] is False
    assert any("PER/PBR 없음" in gap for gap in body["data_gaps"])


def test_opendart_cache_reuses_corp_index() -> None:
    fetcher = FakeFetcher(
        {
            "corpCode.xml": FetchResponse(200, "", content=_corp_zip()),
            "list.json": FetchResponse(200, _dart_listing()),
        }
    )
    conn = OpenDartConnector(fetcher, api_key="KEY", cache=TTLCache())
    conn.fetch("005930")
    conn.fetch("005930")
    assert sum(1 for url in fetcher.calls if "corpCode.xml" in url) == 1
