#!/usr/bin/env python3
"""(구버전) 수도권 전용 stations.js 생성기 — tools/build_network.py 로 대체됐다.

이 스크립트는 수도권 BBOX로 잘라낸 589개 역만 만들기 때문에 지금의 전국 스냅샷(js/stations.js·js/driving_spots.js)과 형식도 다르다.
다시 생성하려면 다음을 쓴다:

    python3 tools/build_network.py

---

Build js/stations.js from a Wikidata SPARQL query.

The app ships a static snapshot of 수도권 subway stations so the "추천 만남 거점"
feature works without any API key. Re-run this script to refresh the snapshot:

    python3 tools/build_stations.py

Data source: Wikidata (CC0), query below. Coordinates come from Wikidata's
P625 statement for each station item.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "js" / "stations.js"
CACHE = ROOT / "tools" / ".wikidata_stations.json"

QUERY = """
SELECT ?s ?sLabel ?coord ?lineLabel WHERE {
  ?s wdt:P31/wdt:P279* wd:Q928830 .
  ?s wdt:P625 ?coord .
  ?s wdt:P17 wd:Q884 .
  OPTIONAL { ?s wdt:P81 ?line . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
}
"""

# 수도권(서울·인천·경기) 대략 경계 — 이 밖의 역은 목록에서 뺀다.
BBOX = {"lat_min": 36.95, "lat_max": 37.95, "lng_min": 126.35, "lng_max": 127.65}

# 지하철 노선 코드와 색상 (서울교통공사·각 운영기관 공식 노선색)
LINES = {
    "1": {"name": "1호선", "color": "#0052A4"},
    "2": {"name": "2호선", "color": "#00A84D"},
    "3": {"name": "3호선", "color": "#EF7C1C"},
    "4": {"name": "4호선", "color": "#00A5DE"},
    "5": {"name": "5호선", "color": "#996CAC"},
    "6": {"name": "6호선", "color": "#CD7C2F"},
    "7": {"name": "7호선", "color": "#747F00"},
    "8": {"name": "8호선", "color": "#E6186C"},
    "9": {"name": "9호선", "color": "#BDB092"},
    "GTX-A": {"name": "GTX-A", "color": "#9A6292"},
    "경의중앙": {"name": "경의중앙", "color": "#77C4A3"},
    "분당": {"name": "수인분당", "color": "#F5A200"},
    "신분당": {"name": "신분당", "color": "#D4003B"},
    "경춘": {"name": "경춘", "color": "#0C8E72"},
    "경강": {"name": "경강", "color": "#0054A6"},
    "서해": {"name": "서해", "color": "#81A914"},
    "김포": {"name": "김포골드", "color": "#A17800"},
    "우이": {"name": "우이신설", "color": "#B7C452"},
    "신림": {"name": "신림", "color": "#6789CA"},
    "의정부": {"name": "의정부", "color": "#FDA600"},
    "에버": {"name": "에버라인", "color": "#56AD2D"},
    "공항": {"name": "공항철도", "color": "#0090D2"},
    "인천1": {"name": "인천1", "color": "#7CA8D5"},
    "인천2": {"name": "인천2", "color": "#ED8B00"},
}

# Wikidata 노선 라벨 → 노선 코드. 위에서부터 먼저 맞는 규칙을 쓴다.
RULES = [
    (r"인천 도시철도 1호선|인천 1호선", "인천1"),
    (r"인천 도시철도 2호선|인천 2호선", "인천2"),
    (r"수도권 광역급행철도 A|GTX-A", "GTX-A"),
    (r"신분당", "신분당"),
    (r"수인·분당|분당선", "분당"),
    (r"경의|중앙선|용산선", "경의중앙"),
    (r"경춘", "경춘"),
    (r"경강", "경강"),
    (r"서해", "서해"),
    (r"김포골드", "김포"),
    (r"우이신설", "우이"),
    (r"신림선", "신림"),
    (r"의정부 경전철", "의정부"),
    (r"용인 경전철|에버라인", "에버"),
    (r"인천국제공항철도|공항철도", "공항"),
    (r"하남선", "5"),
    (r"별내선", "8"),
    (r"일산선", "3"),
    (r"과천선|안산선", "4"),
    (r"경부선|경인선|경원선|경부고속철도|장항선|호남선|전라선|교외선", "1"),
    (r"([1-9])호선", None),  # 1~9호선: 그룹 1을 코드로 사용
]


def line_code(label: str):
    for pattern, code in RULES:
        m = re.search(pattern, label)
        if not m:
            continue
        if code:
            return code
        return m.group(1)
    return None


def normalize_name(raw: str) -> str:
    """'용산역 (수도권 전철)역' → '용산역', 'Q123966006역' → '' (버린다)."""
    name = raw.strip()
    name = re.sub(r"\s*\([^)]*\)", "", name)
    name = name.rstrip()
    if re.fullmatch(r"Q\d+역?", name):
        return ""
    if name.endswith("역역"):
        name = name[:-1]
    if not name.endswith("역"):
        name += "역"
    return name


def fetch() -> dict:
    if CACHE.exists():
        return json.loads(CACHE.read_text())
    # POST 대신 GET: ?query=... (Wikidata SPARQL 엔드포인트 공개 API)
    from urllib.parse import urlencode
    from urllib.request import Request, urlopen

    url = "https://query.wikidata.org/sparql?" + urlencode({"query": QUERY})
    req = Request(url, headers={
        "Accept": "application/sparql-results+json",
        "User-Agent": "HD2Lab-PKPilot0002/1.0 (static meeting-point app; contact: hyangdan2)",
    })
    with urlopen(req, timeout=120) as res:
        data = json.loads(res.read().decode("utf-8"))
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(data, ensure_ascii=False))
    return data


def main() -> int:
    data = fetch()
    stations: dict[str, dict] = {}
    for row in data["results"]["bindings"]:
        label = row["sLabel"]["value"]
        if row["sLabel"].get("xml:lang") not in (None, "ko"):
            continue
        lng, lat = row["coord"]["value"][len("Point("):-1].split()
        lat, lng = float(lat), float(lng)
        if not (BBOX["lat_min"] <= lat <= BBOX["lat_max"]):
            continue
        if not (BBOX["lng_min"] <= lng <= BBOX["lng_max"]):
            continue
        qid = row["s"]["value"].rsplit("/", 1)[-1]
        entry = stations.setdefault(qid, {"name": label, "lat": lat, "lng": lng, "lines": set()})
        line_label = row.get("lineLabel", {}).get("value")
        if line_label:
            code = line_code(line_label)
            if code in LINES:
                entry["lines"].add(code)

    merged: dict[str, dict] = {}
    for entry in stations.values():
        name = normalize_name(entry["name"])
        if not name:
            continue
        target = merged.get(name)
        if target is None:
            merged[name] = {"lat": entry["lat"], "lng": entry["lng"], "lines": set(entry["lines"])}
        else:
            target["lines"] |= entry["lines"]

    rows = []
    for name, entry in merged.items():
        rows.append([
            name,
            round(entry["lat"], 6),
            round(entry["lng"], 6),
            sorted(entry["lines"], key=lambda c: (list(LINES).index(c) if c in LINES else 99)),
        ])
    rows.sort(key=lambda r: r[0])

    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    js = (
        "// 수도권 지하철역 좌표 스냅샷 — tools/build_stations.py 로 생성 (데이터: Wikidata CC0)\n"
        "// 형식: [역명, 위도, 경도, [노선 코드...]]\n"
        f"export const STATIONS = {payload};\n\n"
        "export const LINES = " + json.dumps(LINES, ensure_ascii=False, indent=2) + ";\n"
    )
    OUT.write_text(js)
    print(f"wrote {OUT} ({len(rows)} stations, {OUT.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
