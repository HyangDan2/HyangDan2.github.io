"""HD2Lab Market Intelligence · FastAPI 초안.

실행(로컬 전용):
    uvicorn market_intel.app:create_app --factory --host 127.0.0.1 --port 8791

Nginx 서브패스(`/market-intel/`) 뒤에 둘 때는 `MI_ROOT_PATH=/market-intel` 을 준다.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .domain import DISCLAIMER, SERVICE_NAME, SERVICE_SLUG, VERSION, validate_domain
from .samples import suggestions
from .service import MarketIntelligenceService, Settings, UnknownSymbol

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# 정적 프런트(PKPilot0004)는 GitHub Pages 에서 이 API 를 부른다. 그래서 CORS 허용
# 출처에 Pages 오리진을 기본값으로 넣고, 운영 도메인·로컬은 MI_CORS_ORIGINS 로 덮어쓴다.
DEFAULT_CORS_ORIGINS = (
    "https://hyangdan2.github.io",
    "http://localhost:8000",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8791",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8791",
)


def load_cors_origins() -> list[str]:
    raw = os.environ.get("MI_CORS_ORIGINS", "")
    if not raw.strip():
        return list(DEFAULT_CORS_ORIGINS)
    origins = [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]
    return origins or list(DEFAULT_CORS_ORIGINS)


def load_settings_from_env() -> Settings:
    return Settings(
        opendart_api_key=os.environ.get("OPENDART_API_KEY", "").strip(),
        offline=os.environ.get("MI_OFFLINE", "").lower() in {"1", "true", "yes"},
        timeout=float(os.environ.get("MI_HTTP_TIMEOUT", "6")),
        news_days=int(os.environ.get("MI_NEWS_DAYS", "14")),
        disclosure_days=int(os.environ.get("MI_DISCLOSURE_DAYS", "30")),
    )


def create_app(settings: Settings | None = None, fetcher=None, service: MarketIntelligenceService | None = None) -> FastAPI:
    settings = settings or load_settings_from_env()
    service = service or MarketIntelligenceService(settings, fetcher=fetcher)
    root_path = os.environ.get("MI_ROOT_PATH", "").rstrip("/")

    app = FastAPI(
        title=SERVICE_NAME + " (draft)",
        version=VERSION,
        description="기업 본질 가치와 무관한 경제 외적 주가 변동 요인 10선 · 무료 API 초안",
        root_path=root_path,
    )
    app.state.service = service
    app.state.cors_origins = load_cors_origins()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app.state.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
        max_age=600,
    )

    problems = validate_domain()
    app.state.domain_problems = problems

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        payload = service.health()
        payload["domain_ok"] = not problems
        payload["domain_problems"] = problems
        payload["cors_origins"] = list(app.state.cors_origins)
        return payload

    @app.get("/api/factors")
    def factors() -> dict[str, Any]:
        return service.factors()

    @app.get("/api/symbols")
    def symbols() -> dict[str, Any]:
        return {"examples": suggestions(10), "hint": "국내 6자리 종목코드 또는 해외 티커(예: TSLA)"}

    @app.get("/api/analyze")
    def analyze(q: str = Query("", description="종목명 또는 티커")) -> JSONResponse:
        if not q.strip():
            return JSONResponse(
                status_code=400,
                content={"error": "query_required", "message": "q 파라미터에 종목명 또는 티커를 넣어 주세요.", "examples": suggestions(6)},
            )
        try:
            return JSONResponse(content=service.analyze(q))
        except UnknownSymbol as exc:
            return JSONResponse(
                status_code=404,
                content={
                    "error": "unknown_symbol",
                    "message": f"'{exc.query}' 종목을 찾지 못했습니다. 6자리 코드나 해외 티커로 다시 시도해 주세요.",
                    "suggestions": exc.suggestions,
                },
            )

    @app.get("/api/analyze/{ticker}")
    def analyze_path(ticker: str) -> JSONResponse:
        return analyze(q=ticker)

    @app.get("/api", include_in_schema=False)
    def api_index() -> dict[str, Any]:
        return {
            "service": SERVICE_NAME,
            "slug": SERVICE_SLUG,
            "version": VERSION,
            "endpoints": ["/api/health", "/api/factors", "/api/analyze?q=005930", "/api/symbols"],
            "disclaimer": DISCLAIMER,
        }

    if STATIC_DIR.is_dir():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

        @app.get("/", include_in_schema=False)
        def index() -> FileResponse:
            return FileResponse(STATIC_DIR / "index.html")

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception) -> JSONResponse:  # pragma: no cover - 방어선
        return JSONResponse(status_code=500, content={"error": "internal_error", "message": type(exc).__name__})

    return app


app = None  # uvicorn --factory 로만 생성한다(환경변수 주입 시점을 명확히 하기 위해)
