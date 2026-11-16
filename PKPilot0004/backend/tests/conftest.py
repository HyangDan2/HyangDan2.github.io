from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from market_intel.connectors.base import FetchResponse  # noqa: E402
from market_intel.service import Settings  # noqa: E402


class FakeFetcher:
    """URL 조각 → 응답 매핑. 매칭이 없으면 404를 돌려준다."""

    def __init__(self, routes: dict[str, FetchResponse] | None = None) -> None:
        self.routes = routes or {}
        self.calls: list[str] = []

    def __call__(self, url: str, *, timeout: float = 6.0) -> FetchResponse:
        self.calls.append(url)
        for fragment, response in self.routes.items():
            if fragment in url:
                if isinstance(response, Exception):
                    raise response
                return response
        return FetchResponse(404, "")


@pytest.fixture
def offline_settings() -> Settings:
    return Settings(offline=True)


@pytest.fixture
def live_settings() -> Settings:
    return Settings(offline=False, opendart_api_key="TESTKEY")
