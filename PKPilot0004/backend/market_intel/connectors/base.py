"""Http fetcher 추상화와 커넥터 공통 결과 타입.

테스트는 네트워크를 쓰지 않는다. `Fetcher` 를 가짜로 바꿔 끼우면 커넥터의
파싱·폴백 경로를 외부 호출 없이 그대로 검증할 수 있다.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

STATUS_LIVE = "live"
STATUS_SAMPLE = "sample"
STATUS_DISABLED = "disabled"
STATUS_ERROR = "error"


@dataclass
class FetchResponse:
    status: int
    text: str
    headers: dict[str, str] = field(default_factory=dict)
    content: bytes | None = None

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300


@runtime_checkable
class Fetcher(Protocol):
    def __call__(self, url: str, *, timeout: float = 6.0) -> FetchResponse:  # pragma: no cover
        ...


class HttpxFetcher:
    """무료 공개 엔드포인트용 최소 GET 클라이언트.

    외부 API 는 키 없이 쓰는 공개 엔드포인트뿐이며, 요청 수는 호출부에서
    캐시로 제한한다. 식별 가능한 User-Agent 를 보내고 리다이렉트는 따르지 않는다.
    """

    def __init__(self, user_agent: str = "HD2Lab-MarketIntel/0.1 (draft; contact: server-hq)") -> None:
        self.user_agent = user_agent

    def __call__(self, url: str, *, timeout: float = 6.0) -> FetchResponse:
        import httpx

        headers = {"User-Agent": self.user_agent, "Accept": "*/*"}
        with httpx.Client(timeout=timeout, follow_redirects=False, headers=headers) as client:
            resp = client.get(url)
            return FetchResponse(resp.status_code, resp.text, dict(resp.headers), resp.content)


class OfflineFetcher:
    """테스트·오프라인 모드용. 어떤 요청도 네트워크로 나가지 않는다."""

    def __call__(self, url: str, *, timeout: float = 6.0) -> FetchResponse:
        raise RuntimeError("offline mode: external fetch disabled")


@dataclass
class ConnectorResult:
    """커넥터 1회 호출 결과. 화면과 보고서가 이 상태를 그대로 인용한다."""

    name: str
    status: str
    items: list[dict[str, Any]] = field(default_factory=list)
    reason: str = ""
    source_url: str = ""
    elapsed_ms: int = 0
    query: str = ""

    @property
    def live(self) -> bool:
        return self.status == STATUS_LIVE

    def summary(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "reason": self.reason,
            "count": len(self.items),
            "source_url": self.source_url,
            "elapsed_ms": self.elapsed_ms,
        }


class Stopwatch:
    def __enter__(self) -> "Stopwatch":
        self._start = time.monotonic()
        self.elapsed_ms = 0
        return self

    def __exit__(self, *exc: object) -> None:
        self.elapsed_ms = int((time.monotonic() - self._start) * 1000)


class TTLCache:
    """의존성 없는 TTL 캐시. 무료 API 호출 수를 줄이는 것이 목적이다."""

    def __init__(self, clock=time.monotonic) -> None:
        self._clock = clock
        self._data: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        hit = self._data.get(key)
        if hit is None:
            return None
        expires, value = hit
        if expires <= self._clock():
            self._data.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, ttl: float) -> None:
        self._data[key] = (self._clock() + ttl, value)

    def get_or_set(self, key: str, ttl: float, producer):
        cached = self.get(key)
        if cached is not None:
            return cached, True
        value = producer()
        self.set(key, value, ttl)
        return value, False

    def clear(self) -> None:
        self._data.clear()
