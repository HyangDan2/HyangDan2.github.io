"""정적 프런트(PKPilot0004 · GitHub Pages) → Server-HQ API 호출 계약 검증.

브라우저는 CORS 헤더가 없으면 응답을 읽지 못한다. 그래서 허용 출처·프리플라이트·
미허용 출처 차단을 테스트로 고정한다. 네트워크는 쓰지 않는다(offline=True).
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from market_intel.app import create_app
from market_intel.service import Settings

PAGES_ORIGIN = "https://hyangdan2.github.io"


def client() -> TestClient:
    return TestClient(create_app(Settings(offline=True)))


def test_cors_allows_github_pages_origin() -> None:
    response = client().get("/api/health", headers={"Origin": PAGES_ORIGIN})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == PAGES_ORIGIN


def test_cors_preflight_for_analyze() -> None:
    response = client().options(
        "/api/analyze",
        headers={
            "Origin": PAGES_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "accept",
        },
    )
    assert response.status_code in {200, 204}
    assert response.headers.get("access-control-allow-origin") == PAGES_ORIGIN
    assert "GET" in response.headers.get("access-control-allow-methods", "")


def test_cors_blocks_unknown_origin() -> None:
    response = client().get("/api/health", headers={"Origin": "https://example.invalid"})
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_health_lists_allowed_origins() -> None:
    body = client().get("/api/health").json()
    assert PAGES_ORIGIN in body["cors_origins"]
    assert "http://127.0.0.1:8791" in body["cors_origins"]
