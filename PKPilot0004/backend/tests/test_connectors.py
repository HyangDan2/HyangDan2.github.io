from __future__ import annotations

import io
import json
import zipfile

from conftest import FakeFetcher
from market_intel.connectors.base import FetchResponse, TTLCache
from market_intel.connectors.market_data import NaverQuoteConnector, parse_naver, parse_yahoo, to_number
from market_intel.connectors.news_rss import NewsRssConnector, axis_query, parse_rss
from market_intel.connectors.opendart import CorpCodeIndex, OpenDartConnector, classify_report, recency_weight


RSS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>t</title>
<item><title>삼성전자, 행동주의 펀드 자사주 소각 요구</title><link>https://news.example/1</link>
<source url="https://example.com">표본경제</source>
<pubDate>Fri, 13 Nov 2026 09:00:00 GMT</pubDate>
<description>&lt;a href="x"&gt;삼성전자&lt;/a&gt; 주주환원 확대 요구</description></item>
<item><title>코스피200 리밸런싱 앞두고 지수 편입 종목 매매 집중</title><link>https://news.example/2</link>
<source url="https://example.com">표본마켓</source>
<pubDate>Thu, 12 Nov 2026 09:00:00 GMT</pubDate>
<description>패시브 자금</description></item>
</channel></rss>"""

NAVER_BASIC = json.dumps(
    {
        "itemCode": "005930",
        "stockName": "삼성전자",
        "closePrice": "209,000",
        "fluctuationsRatio": "0.48",
        "localTradedAt": "2026-11-13T20:20:24+09:00",
        "marketStatus": "CLOSE",
        "stockExchangeType": {"name": "KOSPI"},
    }
)
NAVER_INTEGRATION = json.dumps(
    {
        "totalInfos": [
            {"code": "accumulatedTradingVolume", "value": "21,159,966"},
            {"code": "marketValue", "value": "1,221조 8,722억"},
            {"code": "per", "value": "9.38배"},
            {"code": "pbr", "value": "2.43배"},
            {"code": "eps", "value": "22,292원"},
            {"code": "cnsPer", "value": "4.58배"},
            {"code": "cnsEps", "value": "45,655원"},
            {"code": "highPriceOf52Weeks", "value": "380,000"},
            {"code": "lowPriceOf52Weeks", "value": "93,500"},
        ],
        "dealTrendInfos": [
            {
                "foreignerPureBuyQuant": "+8,216",
                "organPureBuyQuant": "-328,604",
                "individualPureBuyQuant": "+285,654",
                "accumulatedTradingVolume": "21159966",
            }
        ],
    }
)
NAVER_HISTORY = json.dumps(
    [{"closePrice": str(100000 + i * 1000), "accumulatedTradingVolume": str(1000000 + i * 10000)} for i in range(90)]
)


def test_to_number_handles_korean_units() -> None:
    assert to_number("209,000") == 209000
    assert to_number("9.38배") == 9.38
    assert to_number("+8,216") == 8216
    assert to_number("1,221조 8,722억") == 1_221_8722_0000_0000
    assert to_number("4,406억") == 4406 * 1e8
    assert to_number("") is None


def test_parse_rss_extracts_fields() -> None:
    items = parse_rss(RSS_XML)
    assert len(items) == 2
    assert items[0]["title"].startswith("삼성전자")
    assert items[0]["source"] == "표본경제"
    assert items[0]["published"].startswith("2026-11-13")
    assert "삼성전자" in items[0]["summary"]


def test_axis_query_contains_keywords_and_window() -> None:
    query = axis_query("삼성전자", "AX01", days=7)
    assert "삼성전자" in query
    assert "행동주의" in query
    assert "when:7d" in query


def test_news_connector_offline_returns_sample_status() -> None:
    conn = NewsRssConnector(FakeFetcher(), offline=True)
    result = conn.fetch("삼성전자")
    assert result.status == "sample"
    assert result.items == []
    assert "오프라인" in result.reason


def test_news_connector_collects_and_dedupes() -> None:
    fetcher = FakeFetcher({"news.google.com": FetchResponse(200, RSS_XML)})
    conn = NewsRssConnector(fetcher, cache=TTLCache())
    result = conn.fetch("삼성전자")
    assert result.status == "live"
    # 4개 축 질의가 같은 기사를 돌려주므로 제목 기준으로 중복 제거된다.
    assert len(result.items) == 2
    assert len(fetcher.calls) == 4


def test_news_connector_reports_failure_instead_of_raising() -> None:
    fetcher = FakeFetcher({"news.google.com": FetchResponse(500, "")})
    conn = NewsRssConnector(fetcher, cache=TTLCache())
    result = conn.fetch("삼성전자")
    assert result.status == "error"
    assert "HTTP 500" in result.reason


def test_parse_naver_merges_three_payloads() -> None:
    quote = parse_naver(json.loads(NAVER_BASIC), json.loads(NAVER_INTEGRATION), json.loads(NAVER_HISTORY))
    assert quote["name"] == "삼성전자"
    assert quote["price"] == 209000
    assert quote["per"] == 9.38
    assert quote["consensus_per"] == 4.58
    assert quote["high_52w"] == 380000
    assert quote["individual_net"] == 285654
    assert quote["ma20"] is not None and quote["ma60"] is not None
    assert quote["avg_volume_20d"] > 0


def test_naver_connector_live_and_cached() -> None:
    fetcher = FakeFetcher(
        {
            "/basic": FetchResponse(200, NAVER_BASIC),
            "/integration": FetchResponse(200, NAVER_INTEGRATION),
            "/price": FetchResponse(200, NAVER_HISTORY),
        }
    )
    cache = TTLCache()
    conn = NaverQuoteConnector(fetcher, cache=cache)
    first = conn.fetch("005930")
    assert first.status == "live"
    assert first.items[0]["price"] == 209000
    calls_after_first = len(fetcher.calls)
    second = conn.fetch("005930")
    assert second.reason == "캐시"
    assert len(fetcher.calls) == calls_after_first


def test_naver_connector_failure_is_not_raised() -> None:
    conn = NaverQuoteConnector(FakeFetcher({"stock": FetchResponse(500, "")}), cache=TTLCache())
    result = conn.fetch("005930")
    assert result.status == "error"


def test_parse_yahoo_chart() -> None:
    payload = {
        "chart": {
            "result": [
                {
                    "meta": {
                        "regularMarketPrice": 421.5,
                        "longName": "Tesla, Inc.",
                        "currency": "USD",
                        "exchangeName": "NasdaqGS",
                        "fiftyTwoWeekHigh": 488.5,
                        "fiftyTwoWeekLow": 214.3,
                        "regularMarketTime": 1731493800,
                    },
                    "timestamp": [1731407400, 1731493800],
                    "indicators": {"quote": [{"close": [415.0, 421.5], "volume": [100, 200]}]},
                }
            ],
            "error": None,
        }
    }
    quote = parse_yahoo(payload, "TSLA")
    assert quote["name"] == "Tesla, Inc."
    assert quote["price"] == 421.5
    assert quote["change_pct"] == 1.57
    assert quote["per"] is None


def test_opendart_classify_report() -> None:
    assert 9 in classify_report("주요사항보고서(무상증자결정)")
    assert 4 in classify_report("횡령·배임혐의발생")
    assert 2 in classify_report("주요사항보고서(자사주취득결정)")
    assert classify_report("분기보고서") == []


def test_opendart_without_key_is_disabled() -> None:
    conn = OpenDartConnector(FakeFetcher(), api_key="")
    result = conn.fetch("005930")
    assert result.status == "disabled"
    assert "OPENDART_API_KEY" in result.reason


def test_opendart_live_flow_with_corp_code_zip() -> None:
    buffer = io.BytesIO()
    xml = "<result><list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code><corp_cls>Y</corp_cls></list></result>"
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("CORPCODE.xml", xml)
    listing = {"status": "000", "message": "정상", "list": [{"report_nm": "주요사항보고서(무상증자결정)", "corp_name": "삼성전자", "rcept_dt": "20261110", "rcept_no": "20261110000123", "flr_nm": "삼성전자"}]}
    fetcher = FakeFetcher(
        {
            "corpCode.xml": FetchResponse(200, "", content=buffer.getvalue()),
            "list.json": FetchResponse(200, json.dumps(listing)),
        }
    )
    conn = OpenDartConnector(fetcher, api_key="KEY", cache=TTLCache())
    result = conn.fetch("005930", days=7)
    assert result.status == "live"
    assert result.items[0]["report_nm"].startswith("주요사항보고서")
    assert result.items[0]["url"].startswith("https://dart.fss.or.kr/")
    assert 9 in result.items[0]["factor_hits"]


def test_corp_code_index_ignores_rows_without_stock_code() -> None:
    buffer = io.BytesIO()
    xml = "<result><list><corp_code>001</corp_code><stock_code></stock_code></list><list><corp_code>002</corp_code><stock_code>000660</stock_code></list></result>"
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("CORPCODE.xml", xml)
    index = CorpCodeIndex.from_zip_bytes(buffer.getvalue())
    assert list(index.by_stock) == ["000660"]


def test_recency_weight_decays() -> None:
    from datetime import datetime, timezone

    now = datetime(2026, 11, 15, tzinfo=timezone.utc)
    fresh = recency_weight("2026-11-14", now=now)
    old = recency_weight("2026-10-01", now=now)
    assert 0 < old < fresh <= 1


def test_ttl_cache_expires_without_sleep() -> None:
    now = [0.0]
    cache = TTLCache(clock=lambda: now[0])
    cache.set("k", "v", ttl=10)
    assert cache.get("k") == "v"
    now[0] = 11
    assert cache.get("k") is None
