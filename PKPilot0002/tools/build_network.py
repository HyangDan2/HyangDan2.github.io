#!/usr/bin/env python3
"""전국 교통망 스냅샷을 만든다 — js/stations.js · js/driving_spots.js

    python3 tools/build_network.py            # 캐시가 있으면 재사용
    python3 tools/build_network.py --refresh  # 원본부터 다시 받는다

데이터 출처
- 도시철도역 좌표·노선: Wikidata (CC0) SPARQL — `?s wdt:P31/wdt:P279* wd:Q928830`
- 고속도로 IC·휴게소: OpenStreetMap Overpass API (ODbL) —
  `highway=motorway_junction`, `highway=services|rest_area`
- 고속도로 노선명: OSM 고속국도 route relation 의 선형(way) 기하
- KTX/SRT 정차역·주요 버스터미널: tools/data/rail_hubs.json (좌표 직접 확인)

만들어지는 형식
- stations.js: `STATIONS = [[이름, 위도, 경도, [노선코드…], {메타}], …]` + `LINES`
- driving_spots.js: `DRIVING_SPOTS = [[이름, 위도, 경도, [], {메타}], …]` + `ROADS`
"""
from __future__ import annotations

import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # PKPilot0002/
CACHE = ROOT / "tools" / ".cache"
DATA = ROOT / "tools" / "data"
STATIONS_OUT = ROOT / "js" / "stations.js"
DRIVING_OUT = ROOT / "js" / "driving_spots.js"

UA = "HD2Lab-PKPilot0002/2.0 (static meeting-point web app; contact: hyangdan2)"
KOREA_BBOX = {"lat_min": 34.4, "lat_max": 38.75, "lng_min": 125.5, "lng_max": 131.1}

# ---------------------------------------------------------------- 노선 메타
LINES = {
    # 수도권
    "1": {"name": "1호선", "color": "#0052A4", "group": "metro"},
    "2": {"name": "2호선", "color": "#00A84D", "group": "metro"},
    "3": {"name": "3호선", "color": "#EF7C1C", "group": "metro"},
    "4": {"name": "4호선", "color": "#00A5DE", "group": "metro"},
    "5": {"name": "5호선", "color": "#996CAC", "group": "metro"},
    "6": {"name": "6호선", "color": "#CD7C2F", "group": "metro"},
    "7": {"name": "7호선", "color": "#747F00", "group": "metro"},
    "8": {"name": "8호선", "color": "#E6186C", "group": "metro"},
    "9": {"name": "9호선", "color": "#BDB092", "group": "metro"},
    "GTX-A": {"name": "GTX-A", "color": "#9A6292", "group": "metro"},
    "경의중앙": {"name": "경의중앙", "color": "#77C4A3", "group": "metro"},
    "분당": {"name": "수인분당", "color": "#F5A200", "group": "metro"},
    "신분당": {"name": "신분당", "color": "#D4003B", "group": "metro"},
    "경춘": {"name": "경춘", "color": "#0C8E72", "group": "metro"},
    "경강": {"name": "경강", "color": "#0054A6", "group": "metro"},
    "서해": {"name": "서해", "color": "#81A914", "group": "metro"},
    "김포": {"name": "김포골드", "color": "#A17800", "group": "metro"},
    "우이": {"name": "우이신설", "color": "#B7C452", "group": "metro"},
    "신림": {"name": "신림", "color": "#6789CA", "group": "metro"},
    "의정부": {"name": "의정부", "color": "#FDA600", "group": "metro"},
    "에버": {"name": "에버라인", "color": "#56AD2D", "group": "metro"},
    "공항": {"name": "공항철도", "color": "#0090D2", "group": "metro"},
    "인천1": {"name": "인천1", "color": "#7CA8D5", "group": "metro"},
    "인천2": {"name": "인천2", "color": "#ED8B00", "group": "metro"},
    # 부·울·경
    "부산1": {"name": "부산1", "color": "#F06A00", "group": "metro"},
    "부산2": {"name": "부산2", "color": "#81BF48", "group": "metro"},
    "부산3": {"name": "부산3", "color": "#BB8C00", "group": "metro"},
    "부산4": {"name": "부산4", "color": "#217DCB", "group": "metro"},
    "김해경전": {"name": "김해경전", "color": "#8451A0", "group": "metro"},
    "양산": {"name": "양산", "color": "#A2272A", "group": "metro"},
    "동해": {"name": "동해선", "color": "#0066B3", "group": "metro"},
    # 대구·경북
    "대구1": {"name": "대구1", "color": "#D93F5C", "group": "metro"},
    "대구2": {"name": "대구2", "color": "#00AA80", "group": "metro"},
    "대구3": {"name": "대구3", "color": "#FFB100", "group": "metro"},
    "대구광역": {"name": "대구광역", "color": "#5A6B7B", "group": "metro"},
    # 대전·충청
    "대전1": {"name": "대전1", "color": "#007448", "group": "metro"},
    # 광주·전남
    "광주1": {"name": "광주1", "color": "#009088", "group": "metro"},
    # 간선 철도
    "KTX": {"name": "KTX", "color": "#005EB8", "group": "rail"},
    "SRT": {"name": "SRT", "color": "#6E2C91", "group": "rail"},
    "ITX": {"name": "ITX", "color": "#1F6FB2", "group": "rail"},
    # 버스
    "BUS": {"name": "고속버스", "color": "#3B7A57", "group": "bus"},
}

# 수도권 전철로 묶이는 코레일 노선 — 수도권 밖에서는 쓰지 않는다.
CAPITAL_BBOX = {"lat_min": 36.7, "lat_max": 38.3, "lng_min": 126.2, "lng_max": 128.1}

LINE_RULES = [
    (r"인천 도시철도 1호선|인천 1호선", "인천1"),
    (r"인천 도시철도 2호선|인천 2호선", "인천2"),
    (r"수도권 광역급행철도 A|GTX-A", "GTX-A"),
    (r"신분당", "신분당"),
    (r"수인·분당|수인분당|분당선|수인선", "분당"),
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
    (r"부산 도시철도 1호선|부산 1호선", "부산1"),
    (r"부산 도시철도 2호선|부산 2호선", "부산2"),
    (r"부산 도시철도 3호선|부산 3호선", "부산3"),
    (r"부산 도시철도 4호선|부산 4호선", "부산4"),
    (r"부산-김해 경전철|부산김해경전철", "김해경전"),
    (r"양산 도시철도", "양산"),
    (r"동해선|동해남부선", "동해"),
    (r"부전선", "부산1"),
    (r"대구 도시철도 1호선|대구 1호선", "대구1"),
    (r"대구 도시철도 2호선|대구 2호선", "대구2"),
    (r"대구 도시철도 3호선|대구 3호선", "대구3"),
    (r"대구권 광역철도", "대구광역"),
    (r"대전 도시철도 1호선|대전 1호선", "대전1"),
    (r"광주 도시철도 1호선|광주 1호선", "광주1"),
    (r"광주 도시철도 2호선|광주 2호선", "광주1"),
    (r"([1-9])호선", None),                       # 1~9호선: 그룹 1
]

CAPITAL_RULES = [
    (r"경부선|경인선|경원선|경부고속철도|장항선|호남선|전라선|교외선", "1"),
]

# 이름이 겹치는 역을 구분할 때 쓰는 도시 기준점
CITY_ANCHORS = [
    ("서울", 37.5665, 126.9780), ("인천", 37.4560, 126.7052), ("수원", 37.2636, 127.0286),
    ("부산", 35.1796, 129.0756), ("대구", 35.8714, 128.6014), ("대전", 36.3504, 127.3845),
    ("광주", 35.1595, 126.8526), ("울산", 35.5384, 129.3114), ("창원", 35.2281, 128.6811),
    ("청주", 36.6424, 127.4890), ("천안", 36.8151, 127.1139), ("전주", 35.8242, 127.1480),
]

# ---------------------------------------------------------------- utilities


def haversine_km(a_lat, a_lng, b_lat, b_lng):
    r = 6371.0088
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = p2 - p1
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def in_korea(lat, lng):
    return (KOREA_BBOX["lat_min"] <= lat <= KOREA_BBOX["lat_max"]
            and KOREA_BBOX["lng_min"] <= lng <= KOREA_BBOX["lng_max"])


def in_capital(lat, lng):
    return (CAPITAL_BBOX["lat_min"] <= lat <= CAPITAL_BBOX["lat_max"]
            and CAPITAL_BBOX["lng_min"] <= lng <= CAPITAL_BBOX["lng_max"])


def city_of(lat, lng):
    best = min(CITY_ANCHORS, key=lambda c: haversine_km(lat, lng, c[1], c[2]))
    return best[0]


def http_json(url: str, body: dict | None = None, timeout: int = 240):
    data = urllib.parse.urlencode(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={
        "Accept": "application/json",
        "User-Agent": UA,
    })
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def cached(name: str, fetcher, refresh: bool):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if path.exists() and not refresh:
        return json.loads(path.read_text())
    for attempt in range(3):
        try:
            data = fetcher()
            path.write_text(json.dumps(data, ensure_ascii=False))
            return data
        except Exception as exc:  # 네트워크 일시 장애는 재시도
            if attempt == 2:
                raise
            print(f"  … {name} 재시도 ({exc})", file=sys.stderr)
            time.sleep(4 * (attempt + 1))
    raise RuntimeError("unreachable")


# ---------------------------------------------------------------- Wikidata


def fetch_metro():
    query = """
SELECT ?s ?sLabel ?coord ?lineLabel WHERE {
  ?s wdt:P31/wdt:P279* wd:Q928830 .
  ?s wdt:P625 ?coord .
  ?s wdt:P17 wd:Q884 .
  OPTIONAL { ?s wdt:P81 ?line . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
}
"""
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": query})
    return http_json(url, timeout=240)


# ---------------------------------------------------------------- OSM

OVERPass = "https://overpass-api.de/api/interpreter"


def fetch_driving_osm():
    query = """
[out:json][timeout:180];
(
  node["highway"="motorway_junction"](33.0,124.0,39.2,132.0);
  node["highway"="services"](33.0,124.0,39.2,132.0);
  way["highway"="services"](33.0,124.0,39.2,132.0);
  node["highway"="rest_area"](33.0,124.0,39.2,132.0);
  way["highway"="rest_area"](33.0,124.0,39.2,132.0);
);
out center tags;
"""
    return http_json(OVERPass, {"data": query}, timeout=300)


def fetch_motorway_ways():
    """이름이 붙은 고속도로 본선 way — IC·휴게소에 도로명을 붙이는 기준선."""
    query = """
[out:json][timeout:240];
way["highway"="motorway"]["name"](34.4,125.5,38.7,131.0);
out tags geom;
"""
    return http_json(OVERPass, {"data": query}, timeout=280)


ROAD_PALETTE = [
    "#3f6fb5", "#2e8b7a", "#7a5cc0", "#b8563a", "#4f7f4f",
    "#8a6d3b", "#5b7c99", "#a0557f", "#3f8b6e", "#6f6f8f",
]


def road_color(name: str) -> str:
    return ROAD_PALETTE[sum(ord(ch) for ch in name) % len(ROAD_PALETTE)]


def build_segments(ways):
    """(도로명, 선분) 목록 — IC/휴게소에서 가장 가까운 고속도로를 찾는 데 쓴다."""
    segments = []
    for element in ways.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name", "")
        if not name or "고속도로" not in name:
            continue
        points = element.get("geometry") or []
        for a, b in zip(points, points[1:]):
            segments.append((name, a["lat"], a["lon"], b["lat"], b["lon"]))
    return segments


class SegmentIndex:
    """0.02° 격자로 선분을 나눠 가장 가까운 고속도로를 빠르게 찾는다."""

    CELL = 0.02

    def __init__(self, segments):
        self.grid = {}
        for seg in segments:
            road, a_lat, a_lng, b_lat, b_lng = seg
            lat0, lat1 = sorted((a_lat, b_lat))
            lng0, lng1 = sorted((a_lng, b_lng))
            for cy in range(int(lat0 // self.CELL), int(lat1 // self.CELL) + 1):
                for cx in range(int(lng0 // self.CELL), int(lng1 // self.CELL) + 1):
                    self.grid.setdefault((cy, cx), []).append(seg)

    def nearest(self, lat, lng, max_m=400):
        best_road = None
        best_d = max_m / 111000.0
        cy, cx = int(lat // self.CELL), int(lng // self.CELL)
        for gy in range(cy - 2, cy + 3):
            for gx in range(cx - 2, cx + 3):
                for road, a_lat, a_lng, b_lat, b_lng in self.grid.get((gy, gx), ()):
                    d = point_segment_deg(lat, lng, a_lat, a_lng, b_lat, b_lng)
                    if d < best_d:
                        best_d = d
                        best_road = road
        return best_road


def point_segment_deg(px, py, ax, ay, bx, by):
    """점↔선분 거리(위도 1도 = 1 단위로 근사)."""
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


# ---------------------------------------------------------------- 역


def normalize_name(raw: str) -> str:
    name = re.sub(r"\s*\([^)]*\)", "", str(raw)).strip()
    if re.fullmatch(r"Q\d+역?", name):
        return ""
    if name.endswith("역역"):
        name = name[:-1]
    if not name.endswith("역"):
        name += "역"
    return name


def line_code(label: str, lat: float, lng: float):
    for pattern, code in LINE_RULES:
        m = re.search(pattern, label)
        if not m:
            continue
        return code if code else m.group(1)
    if in_capital(lat, lng):
        for pattern, code in CAPITAL_RULES:
            if re.search(pattern, label):
                return code
    return None


def build_stations(metro_data, rail_hubs):
    groups = {}  # 이름 → [{lat, lng, lines:set(), city}]

    def place(name, lat, lng):
        if not in_korea(lat, lng):
            return None
        bucket = groups.setdefault(name, [])
        for entry in bucket:
            if haversine_km(lat, lng, entry["lat"], entry["lng"]) < 2.5:
                return entry
        entry = {"lat": lat, "lng": lng, "lines": set(), "city": city_of(lat, lng)}
        bucket.append(entry)
        return entry

    for row in metro_data["results"]["bindings"]:
        label = row["sLabel"]["value"]
        if row["sLabel"].get("xml:lang") not in (None, "ko"):
            continue
        lng, lat = (float(v) for v in row["coord"]["value"][len("Point("):-1].split())
        name = normalize_name(label)
        if not name:
            continue
        entry = place(name, lat, lng)
        if entry is None:
            continue
        line_label = row.get("lineLabel", {}).get("value")
        if line_label:
            code = line_code(line_label, lat, lng)
            if code in LINES:
                entry["lines"].add(code)

    # 노선 정보가 비어 있는 역(광주 16곳 등)은 도시로 보정한다
    region_default = {"광주": "광주1", "대전": "대전1", "부산": "부산1", "대구": "대구1"}
    for bucket in groups.values():
        for entry in bucket:
            if not entry["lines"] and entry["city"] in region_default:
                entry["lines"].add(region_default[entry["city"]])

    # KTX·SRT 정차역과 버스터미널
    for name, info in rail_hubs.get("rail", {}).items():
        entry = place(normalize_name(name) if not name.endswith("역") else name, info["lat"], info["lng"])
        if entry is None:
            continue
        entry["lines"].update(info.get("lines", ["KTX"]))
        entry["hub"] = True
    for name, info in rail_hubs.get("terminals", {}).items():
        entry = place(name, info["lat"], info["lng"])
        if entry is None:
            continue
        entry["lines"].add("BUS")
        entry["hub"] = True

    # 이름이 겹치는 역은 도시를 붙여 구분한다 (서울 쪽은 원래 이름을 그대로 둔다)
    rows = []
    for name, bucket in groups.items():
        plain = bucket[0]
        if len(bucket) > 1:
            preferred = [e for e in bucket if e["city"] == "서울"] or \
                        [e for e in bucket if e["city"] in ("서울", "인천", "수원")]
            if preferred:
                plain = preferred[0]
        for entry in bucket:
            display = name if entry is plain else f"{name} ({entry['city']})"
            meta = {}
            if entry.get("hub"):
                meta["hub"] = True
            rows.append([display, round(entry["lat"], 6), round(entry["lng"], 6),
                         sort_lines(entry["lines"]), meta])

    rows.sort(key=lambda r: r[0])
    return rows


def sort_lines(codes):
    order = list(LINES)
    return sorted(codes, key=lambda c: order.index(c) if c in LINES else 99)


# ---------------------------------------------------------------- 자차 거점

DIRECTION_RE = re.compile(r"[가-힣]{0,4}(방향|방면)")


def clean_rest_name(raw: str) -> str:
    name = re.sub(r"\([^)]*\)", " ", raw)
    name = DIRECTION_RE.sub(" ", name)
    name = re.sub(r"\s+", " ", name).strip()
    tokens = name.split(" ")
    if len(tokens) >= 2 and tokens[-1] == "휴게소":
        name = f"{tokens[-2]}{tokens[-1]}"
    elif len(tokens) >= 2 and tokens[-1].endswith("휴게소") and len(tokens[-1]) <= 3:
        name = f"{tokens[-2]}{tokens[-1]}"
    return name


def build_driving(osm_data, ways, parking_hubs):
    segments = build_segments(ways)
    index = SegmentIndex(segments)
    print(f"  고속도로 선분 {len(segments)}개")
    elements = osm_data["elements"]

    ics = {}
    rest = {}
    for element in elements:
        tags = element.get("tags", {})
        kind = tags.get("highway")
        lat = element.get("lat") or (element.get("center") or {}).get("lat")
        lng = element.get("lon") or (element.get("center") or {}).get("lon")
        if lat is None or lng is None or not in_korea(lat, lng):
            continue
        name = (tags.get("name") or "").strip()
        if not name:
            continue

        if kind == "motorway_junction":
            if "분기점" in name or name.endswith("JC") or "휴게소" in name:
                continue
            base = name
            for suffix in ("IC", "나들목", "출입구"):
                if base.endswith(suffix):
                    base = base[: -len(suffix)].strip()
            if not base or re.fullmatch(r"[\dA-Za-z ]+", base):
                continue
            road = index.nearest(lat, lng)
            if not road:
                continue
            bucket = ics.setdefault(base, [])
            merged = next((e for e in bucket
                           if haversine_km(lat, lng, e["lat"], e["lng"]) < 3), None)
            if merged is None:
                bucket.append({"name": f"{base}IC", "lat": lat, "lng": lng, "road": road})
            else:
                merged["lat"] = (merged["lat"] + lat) / 2
                merged["lng"] = (merged["lng"] + lng) / 2

        elif kind in ("services", "rest_area"):
            if "휴게소" not in name and "만남의광장" not in name:
                continue
            clean = clean_rest_name(name)
            if "휴게소" not in clean and "만남의광장" not in clean:
                continue
            road = index.nearest(lat, lng)
            if not road:
                continue
            bucket = rest.setdefault(clean, [])
            merged = None
            for entry in bucket:
                if haversine_km(lat, lng, entry["lat"], entry["lng"]) < 6:
                    merged = entry
                    break
            if merged is None:
                bucket.append({"name": clean, "lat": lat, "lng": lng, "road": road,
                               "count": 1, "lat_sum": lat, "lng_sum": lng})
                continue
            # 상·하행 휴게소는 같은 이름으로 두 번 나온다 — 평균 위치로 합친다
            merged["count"] += 1
            merged["lat_sum"] += lat
            merged["lng_sum"] += lng
            merged["lat"] = merged["lat_sum"] / merged["count"]
            merged["lng"] = merged["lng_sum"] / merged["count"]
            merged["both"] = merged["count"] > 1

    rows = []
    for base, bucket in ics.items():
        for entry in bucket:
            name = entry["name"] if len(bucket) == 1 else f"{entry['name']} ({city_of(entry['lat'], entry['lng'])})"
            rows.append([name, round(entry["lat"], 6), round(entry["lng"], 6), [],
                         {"kind": "ic", "road": entry["road"], "parking": True}])
    for bucket in rest.values():
        for entry in bucket:
            meta = {"kind": "rest", "road": entry["road"], "parking": True}
            if entry.get("both"):
                meta["both"] = True
            rows.append([entry["name"], round(entry["lat"], 6), round(entry["lng"], 6), [], meta])
    for name, info in parking_hubs.items():
        rows.append([name, info["lat"], info["lng"], [],
                     {"kind": "parking", "road": info.get("road", ""), "parking": True}])

    rows.sort(key=lambda r: (r[0], r[1]))
    return finalize_driving(rows)


def finalize_driving(rows):
    """이름이 같은 휴게소·IC를 정리한다.
    - 이름만 있는 '휴게소' 같은 항목은 버린다.
    - 같은 이름·같은 도로는 한 곳만 남긴다.
    - 같은 이름이 다른 도로에 있으면 도로명을 붙여 구분한다.
    """
    by_name = {}
    for row in rows:
        name = row[0]
        if name in ("휴게소", "만남의광장"):
            continue
        by_name.setdefault(name, []).append(row)

    out = []
    for name, group in by_name.items():
        per_road = {}
        for row in group:
            per_road.setdefault(row[4].get("road", ""), row)
        if len(group) == 1:
            out.append(group[0])
            continue
        for road, row in per_road.items():
            if road:
                out.append([f"{name} · {road}"] + row[1:])
            else:
                out.append(row)
    out.sort(key=lambda r: (r[0], r[1]))
    return out


# ---------------------------------------------------------------- 출력


def write_js():
    station_rows = json.loads((DATA / "stations.json").read_text())
    driving_rows = json.loads((DATA / "driving_spots.json").read_text())

    payload = json.dumps(station_rows, ensure_ascii=False, separators=(",", ":"))
    STATIONS_OUT.write_text(
        "// 전국 도시철도·KTX·SRT·버스터미널 좌표 스냅샷 — tools/build_network.py 로 생성\n"
        "// 데이터: Wikidata (CC0) + tools/data/rail_hubs.json\n"
        "// 형식: [이름, 위도, 경도, [노선 코드…], {메타}]\n"
        f"export const STATIONS = {payload};\n\n"
        "export const LINES = " + json.dumps(LINES, ensure_ascii=False, indent=2) + ";\n"
    )

    roads = {}
    for row in driving_rows:
        road = row[4].get("road", "")
        if road:
            roads[road] = road_color(road)

    payload = json.dumps(driving_rows, ensure_ascii=False, separators=(",", ":"))
    DRIVING_OUT.write_text(
        "// 전국 고속도로 IC·휴게소·대형 주차 거점 스냅샷 — tools/build_network.py 로 생성\n"
        "// 데이터: OpenStreetMap (ODbL) + tools/data/parking_hubs.json\n"
        "// 형식: [이름, 위도, 경도, [], {종류, 도로명, 주차}]\n"
        f"export const DRIVING_SPOTS = {payload};\n\n"
        "export const ROADS = " + json.dumps(roads, ensure_ascii=False, indent=1) + ";\n"
    )


def main() -> int:
    refresh = "--refresh" in sys.argv
    print("· 도시철도역 (Wikidata)")
    metro = cached("wikidata_metro.json", fetch_metro, refresh)
    print("· 고속도로 IC·휴게소 (OpenStreetMap)")
    osm = cached("overpass_driving.json", fetch_driving_osm, refresh)
    print("· 고속도로 본선 (OpenStreetMap)")
    ways = cached("expressway_ways.json", fetch_motorway_ways, refresh)

    rail_hubs = json.loads((DATA / "rail_hubs.json").read_text())
    parking_hubs = json.loads((DATA / "parking_hubs.json").read_text())

    stations = build_stations(metro, rail_hubs)
    print(f"  역 {len(stations)}곳")
    (DATA / "stations.json").write_text(json.dumps(stations, ensure_ascii=False, indent=0))

    driving = build_driving(osm, ways, parking_hubs)
    kinds = {}
    for row in driving:
        kinds[row[4]["kind"]] = kinds.get(row[4]["kind"], 0) + 1
    print(f"  자차 거점 {len(driving)}곳 {kinds}")
    (DATA / "driving_spots.json").write_text(json.dumps(driving, ensure_ascii=False, indent=0))

    write_js()
    print(f"wrote {STATIONS_OUT.name} ({STATIONS_OUT.stat().st_size / 1024:.1f} KB), "
          f"{DRIVING_OUT.name} ({DRIVING_OUT.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
