from __future__ import annotations

from fastapi.testclient import TestClient

from market_intel.app import create_app
from market_intel.domain import DISCLAIMER
from market_intel.service import Settings


def client() -> TestClient:
    return TestClient(create_app(Settings(offline=True)))


def test_health_reports_offline_connectors() -> None:
    response = client().get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["domain_ok"] is True
    assert body["connectors"]["opendart"]["status"] == "disabled"
    assert body["connectors"]["news_rss"]["status"] == "disabled"


def test_factors_endpoint_returns_axes_matrix_and_mechanism() -> None:
    body = client().get("/api/factors").json()
    assert len(body["axes"]) == 4
    assert len(body["factors"]) == 10
    assert body["mechanism"]["center"] == "단기 수급 불균형 및 비이성적 기대·공포 증폭"
    assert body["disclaimer"] == DISCLAIMER
    first = body["factors"][0]
    assert {"id", "name", "axis_name", "mechanism", "direction", "direction_label"} <= set(first)


def test_analyze_sample_mode_for_known_ticker() -> None:
    body = client().get("/api/analyze", params={"q": "005930"}).json()
    assert body["entity"]["ticker"] == "005930"
    assert body["entity"]["name"] == "삼성전자"
    assert body["mode"] == "sample"
    assert body["quote"]["available"] is True
    assert body["quote"]["price"] == 209000
    assert body["scoring"]["nfds"]["score"] > 0
    assert "weighted" in body["scoring"]["nfds"]
    assert body["signals"]
    factor_ids = {s["factor_id"] for s in body["signals"]}
    assert 2 in factor_ids  # 자사주·주주환원 표본
    assert any(g.startswith("OpenDART") for g in body["data_gaps"])


def test_analyze_accepts_name_and_path_form() -> None:
    by_name = client().get("/api/analyze", params={"q": "삼성전자"}).json()
    by_path = client().get("/api/analyze/005930").json()
    assert by_name["entity"]["ticker"] == by_path["entity"]["ticker"] == "005930"


def test_analyze_rumor_ticker_has_reversal_factor() -> None:
    body = client().get("/api/analyze", params={"q": "에코프로"}).json()
    factor_ids = {s["factor_id"] for s in body["signals"]}
    assert 10 in factor_ids
    assert body["scoring"]["mean_reversion"]["level"] in {"보통", "높음", "매우 높음"}


def test_analyze_unknown_symbol_returns_suggestions() -> None:
    response = client().get("/api/analyze", params={"q": "없는종목"})
    assert response.status_code == 404
    assert response.json()["error"] == "unknown_symbol"
    assert response.json()["suggestions"]


def test_analyze_requires_query() -> None:
    response = client().get("/api/analyze")
    assert response.status_code == 400
    assert response.json()["error"] == "query_required"


def test_symbols_endpoint_lists_examples() -> None:
    body = client().get("/api/symbols").json()
    assert len(body["examples"]) >= 5
    assert all("ticker" in row and "name" in row for row in body["examples"])


def test_index_page_is_served() -> None:
    response = client().get("/")
    assert response.status_code == 200
    assert "HD2Lab" in response.text
    assert "Market Intelligence" in response.text


def test_static_assets_are_served() -> None:
    response = client().get("/static/styles.css")
    assert response.status_code == 200
    assert "--orange" in response.text
