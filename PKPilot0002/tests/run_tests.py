#!/usr/bin/env python3
"""PKPilot0002 단위 테스트 실행기.

core.js 의 순수 로직을 브라우저(tests/unit/index.html)에서 실행하고 결과를 집계한다.
Node.js 없이도 돌도록 Playwright(Chromium)만 사용한다.

    python3 tests/run_tests.py

종료 코드: 모든 테스트 통과 0, 실패 또는 실행 불가 1.
"""
from __future__ import annotations

import http.server
import json
import os
import socket
import sys
import threading
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent      # PKPilot0002/
REPO = ROOT.parent                                  # 저장소 루트 (http 서버 기준)


def serve() -> tuple[http.server.ThreadingHTTPServer, int]:
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(REPO))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = server.socket.getsockname()[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, port


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright가 필요합니다: pip install playwright && playwright install chromium", file=sys.stderr)
        return 1

    server, port = serve()
    url = f"http://127.0.0.1:{port}/PKPilot0002/tests/unit/index.html"
    code = 1
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 900, "height": 900})
        errors: list[str] = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        try:
            page.goto(url, wait_until="load")
            page.wait_for_function("window.__PKP_TEST__ && window.__PKP_TEST__.done", timeout=60_000)
            payload = page.evaluate("window.__PKP_TEST__")
        finally:
            browser.close()

    results = payload["results"]
    for item in results:
        if item["ok"]:
            print(f"  ✓ {item['name']}  ({item['ms']:.1f}ms)")
        else:
            print(f"  ✗ {item['name']}\n      {item['error']}")
    print()
    print(f"{payload['passed']}개 통과 / {payload['failed']}개 실패 (총 {payload['total']}개)")
    if errors:
        print("\n페이지 오류:")
        for err in errors:
            print("  -", err)
    code = 0 if payload["failed"] == 0 and not errors else 1
    server.shutdown()
    return code


if __name__ == "__main__":
    sys.exit(main())
