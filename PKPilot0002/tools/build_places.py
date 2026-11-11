#!/usr/bin/env python3
"""모임 거점 주변 맛집·카페 POI 스냅샷을 만든다 — js/places.js

    python3 tools/build_places.py                 # 캐시가 있으면 재사용
    python3 tools/build_places.py --refresh       # 원본부터 다시 받는다
    python3 tools/build_places.py --hub gangnam   # 한 거점만 받는다 (캐시 채우기)

데이터 출처
- OpenStreetMap Overpass API (ODbL) — `amenity=restaurant|cafe|fast_food|bakery|ice_cream`,
  `shop=bakery|coffee|dessert|ice_cream`, `amenity=parking`
- 거점 좌표: tools/data/hubs.json (Wikidata 역 좌표 · Nominatim 확인값)

규칙
- 이름이 있는 POI만 쓴다 (이름 없는 도형은 목록에서 뺀다).
- 허브 반경(기본 800m) 안, 같은 이름·60m 이내 중복은 태그가 많은 쪽만 남긴다.
- 직선거리 → 도보 보정 1.25배, 4.5km/h(75m/분) 기준 도보 분.
- 포장·야외석·주차 가능 여부는 OSM 태그와 150m 내 주차장으로 판정한다.
- 리뷰·평점은 OSM에 없다 → 앱은 네이버·카카오 지도 리뷰 링크로 넘긴다.

만들어지는 형식
- js/places.js: `HUBS`(거점) + `PLACES`(`{ id, hubId, hubName, name, kind, category, lat, lng,
  distMeters, walkMinutes, tags, naverUrl, kakaoUrl, osmUrl }`) + `PLACES_META`
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent           # PKPilot0002/
CACHE = ROOT / "tools" / ".cache"
DATA = ROOT / "tools" / "data"
HUBS_FILE = DATA / "hubs.json"
PLACES_JSON = DATA / "places.json"
PLACES_OUT = ROOT / "js" / "places.js"

UA = "HD2Lab-PKPilot0002/3.0 (static meeting-point web app; contact: hyangdan2)"
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

EARTH_RADIUS_KM = 6371.0088

# 한 거점에서 가져올 최대 개수 — 도보 거리 순으로 자른다.
MAX_RESTAURANTS = 36
MAX_CAFES = 28
PARKING_SEARCH_M = 150

# OSM cuisine → 앱 카테고리
CUISINE_CATEGORY = {
    "korean": "한식", "soup": "한식", "stew": "한식", "rice": "한식", "noodle": "한식",
    "noodles": "한식", "gukbap": "한식", "bibimbap": "한식",
    "barbecue": "고기", "bbq": "고기", "gogi": "고기", "samgyeopsal": "고기",
    "korean_barbecue": "고기", "grill": "고기",
    "japanese": "일식", "sushi": "일식", "ramen": "일식", "udon": "일식",
    "donburi": "일식", "izakaya": "일식", "tempura": "일식", "sashimi": "일식",
    "chinese": "중식", "dim_sum": "중식", "taiwanese": "중식",
    "italian": "양식", "pizza": "양식", "pasta": "양식", "western": "양식",
    "american": "양식", "french": "양식", "burger": "양식", "steak": "양식",
    "mexican": "양식", "brunch": "양식", "sandwich": "양식", "salad": "양식",
    "vietnamese": "아시아", "thai": "아시아", "indian": "아시아", "asian": "아시아",
    "pho": "아시아", "nepalese": "아시아", "malaysian": "아시아",
    "chicken": "치킨", "fried_chicken": "치킨",
    "seafood": "해산물", "fish": "해산물",
    "bunsik": "분식", "snack": "분식", "tteokbokki": "분식", "korean_fried_chicken": "치킨",
    "dessert": "디저트", "ice_cream": "디저트", "cake": "디저트", "bingsu": "디저트",
    "bakery": "베이커리", "bread": "베이커리",
    "coffee_shop": "카페", "cafe": "카페", "coffee": "카페", "tea": "카페",
    "bubble_tea": "카페", "juice": "카페",
}

CATEGORY_ORDER = ["한식", "고기", "일식", "중식", "양식", "아시아", "치킨", "분식", "해산물", "음식점"]

CHAIN_NAMES = [
    "스타벅스", "투썸", "이디야", "메가커피", "메가엠지씨", "컴포즈커피", "빽다방", "폴바셋",
    "파리바게뜨", "뚜레쥬르", "던킨", "배스킨라빈스", "크리스피크림",
    "맥도날드", "롯데리아", "버거킹", "KFC", "서브웨이", "쉐이크쉑", "노브랜드버거",
    "김밥천국", "본죽", "한솥", "명륜진사갈비", "홍콩반점", "역전우동", "미스터피자", "도미노피자",
]

# 이름에만 있고 cuisine 태그가 없는 식당의 카테고리를 이름으로 보정한다.
# (앞쪽 규칙이 이긴다 — '횟집'이 '집'보다 먼저 걸리도록 순서를 둔다.)
NAME_CATEGORY = [
    ("해산물", ["횟집", "물회", "해물", "해산물", "조개", "게장", "아귀", "장어", "굴구이", "회센타", "회센터"]),
    ("고기", ["삼겹", "목살", "갈비", "곱창", "막창", "족발", "보쌈", "숯불", "양꼬치", "정육", "화로", "구이", "바베큐", "bbq", "스테이크"]),
    ("치킨", ["치킨", "닭갈비", "통닭", "후라이드", "양념치킨", "찜닭"]),
    ("일식", ["초밥", "스시", "사시미", "라멘", "우동", "소바", "돈까스", "돈가스", "이자카야", "규동", "가츠", "일식", "텐동"]),
    ("중식", ["반점", "짬뽕", "탕수육", "마라", "훠궈", "딤섬", "중화", "중국"]),
    ("양식", ["피자", "파스타", "버거", "샌드위치", "브런치", "리조또", "타코", "그라탕", "오므라이스"]),
    ("아시아", ["쌀국수", "베트남", "태국", "팟타이", "반미", "커리", "인도", "포차"]),
    ("분식", ["김밥", "떡볶이", "순대", "분식", "만두", "튀김", "라면"]),
    ("한식", ["국밥", "찌개", "전골", "국수", "칼국수", "냉면", "비빔밥", "설렁탕", "곰탕", "삼계탕", "감자탕", "육개장", "백반", "한정식", "불고기", "순두부", "김치", "된장", "죽", "한식", "식당", "밥집"]),
]

DESSERT_HINTS = ["디저트", "케이크", "빙수", "도넛", "와플", "마카롱", "쿠키", "타르트", "젤라또", "아이스크림", "초콜릿", "찻집", "티하우스"]
BAKERY_HINTS = ["베이커리", "제과", "빵", "bakery", "베이크"]

# 식당·카페가 아닌 시설이 restaurant/cafe 로 잘못 올라온 경우를 걸러낸다.
NON_FOOD_HINTS = [
    "웨딩홀", "장례", "편의점", "약국", "은행", "노래방", "pc방", "부동산", "공인중개",
    "헬스", "요가", "미용실", "네일", "사우나", "교회", "학원", "병원", "의원",
    "지하쇼핑센터", "쇼핑센터", "푸드코트", "주차장", "호프", "주점", "술집", "맥주창고",
]
NON_FOOD_EXACT = ["롯데백화점", "현대백화점", "신세계백화점", "이마트", "코스트코", "롯데마트", "홈플러스"]


# ---------------------------------------------------------------- 유틸

def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * 1000 * math.asin(min(1.0, math.sqrt(h)))


def walk_minutes(distance_m: float) -> int:
    """직선거리 → 도보 분. 길을 따라 걷는 보정 1.25배, 4.5km/h(75m/분)."""
    return max(1, round(distance_m * 1.25 / 75))


def slug(text: str) -> str:
    base = re.sub(r"[^0-9a-z가-힣]+", "-", str(text).lower()).strip("-")
    return base[:40] or "place"


def norm_name(name: str) -> str:
    return re.sub(r"[\s()·.,'\"-]+", "", name).lower()


def quokka_query(lat: float, lng: float, radius: int) -> str:
    r = int(radius)
    kinds = '^(restaurant|cafe|fast_food|bakery|ice_cream)$'
    shops = '^(bakery|coffee|dessert|ice_cream)$'
    return f"""[out:json][timeout:180];
(
  node["amenity"~"{kinds}"]["name"](around:{r},{lat},{lng});
  way["amenity"~"{kinds}"]["name"](around:{r},{lat},{lng});
  node["shop"~"{shops}"]["name"](around:{r},{lat},{lng});
  way["shop"~"{shops}"]["name"](around:{r},{lat},{lng});
  node["amenity"="parking"](around:{r + PARKING_SEARCH_M},{lat},{lng});
  way["amenity"="parking"](around:{r + PARKING_SEARCH_M},{lat},{lng});
);
out center tags;"""


def http_json(endpoint: str, query: str, timeout: int = 200):
    body = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(endpoint, data=body, headers={
        "Accept": "application/json",
        "User-Agent": UA,
    })
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def batch_query(hubs: list[dict], radius: int) -> str:
    """여러 거점을 한 번에 받는다 — Overpass 요청 수를 줄여 속도 제한을 피한다."""
    r = int(radius)
    kinds = '^(restaurant|cafe|fast_food|bakery|ice_cream)$'
    shops = '^(bakery|coffee|dessert|ice_cream)$'
    statements = []
    for hub in hubs:
        lat, lng = hub["lat"], hub["lng"]
        statements.append(f'  node["amenity"~"{kinds}"]["name"](around:{r},{lat},{lng});')
        statements.append(f'  way["amenity"~"{kinds}"]["name"](around:{r},{lat},{lng});')
        statements.append(f'  node["shop"~"{shops}"]["name"](around:{r},{lat},{lng});')
        statements.append(f'  way["shop"~"{shops}"]["name"](around:{r},{lat},{lng});')
        statements.append(f'  node["amenity"="parking"](around:{r + PARKING_SEARCH_M},{lat},{lng});')
        statements.append(f'  way["amenity"="parking"](around:{r + PARKING_SEARCH_M},{lat},{lng});')
    return "[out:json][timeout:600];\n(\n" + "\n".join(statements) + "\n);\nout center tags;"


def split_batch(payload: dict, hubs: list[dict], radius: int) -> dict[str, dict]:
    """받은 요소를 가장 가까운 거점의 캐시로 나눈다."""
    buckets: dict[str, list] = {hub["id"]: [] for hub in hubs}
    for element in payload.get("elements", []):
        point = element_lat_lng(element)
        if not point:
            continue
        tags = element.get("tags") or {}
        is_parking = tags.get("amenity") == "parking"
        limit = radius + (PARKING_SEARCH_M if is_parking else 0)
        best = None
        best_distance = float("inf")
        for hub in hubs:
            distance = haversine_m(hub["lat"], hub["lng"], point[0], point[1])
            if distance <= limit and distance < best_distance:
                best, best_distance = hub, distance
        if best:
            buckets[best["id"]].append(element)
    return {hub_id: {"elements": elements} for hub_id, elements in buckets.items()}


def fetch_hub(hub: dict, radius: int) -> dict:
    query = quokka_query(hub["lat"], hub["lng"], radius)
    last_error: Exception | None = None
    for attempt in range(4):
        endpoint = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            return http_json(endpoint, query)
        except Exception as exc:  # 서버 혼잡·게이트웨이 오류는 다른 서버로 재시도
            last_error = exc
            print(f"  … {hub['id']} 재시도 {attempt + 1} ({endpoint.split('/')[2]}: {exc})", file=sys.stderr)
            time.sleep(6 * (attempt + 1))
    raise RuntimeError(f"{hub['id']} 수집 실패: {last_error}")


def load_cached(hub_id: str, refresh: bool):
    path = CACHE / f"places_{hub_id}.json"
    if path.exists() and not refresh:
        return json.loads(path.read_text())
    return None


def save_cache(hub_id: str, payload: dict):
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / f"places_{hub_id}.json").write_text(json.dumps(payload, ensure_ascii=False))


# ---------------------------------------------------------------- POI 변환

def element_lat_lng(element: dict):
    if "lat" in element and "lon" in element:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center") or {}
    if "lat" in center and "lon" in center:
        return float(center["lat"]), float(center["lon"])
    return None


def category_of(tags: dict) -> tuple[str, str]:
    """(kind, category) — kind: restaurant | cafe"""
    amenity = tags.get("amenity", "")
    shop = tags.get("shop", "")
    cuisines = [c.strip().lower() for c in re.split(r"[;,]", tags.get("cuisine", "")) if c.strip()]

    categories = [CUISINE_CATEGORY[c] for c in cuisines if c in CUISINE_CATEGORY]
    dessertish = any(c in ("디저트", "베이커리") for c in categories)

    if amenity == "cafe" or (shop in ("coffee", "dessert", "ice_cream") and amenity != "restaurant"):
        kind = "cafe"
        if "베이커리" in categories:
            return kind, "베이커리"
        if dessertish:
            return kind, "디저트"
        return kind, "카페"
    if amenity == "bakery" or shop == "bakery":
        return "cafe", "베이커리"
    if amenity == "ice_cream":
        return "cafe", "디저트"
    if amenity in ("restaurant", "fast_food"):
        for wanted in CATEGORY_ORDER:
            if wanted in categories:
                return "restaurant", wanted
        if dessertish:
            return "restaurant", "디저트"
        return "restaurant", ("패스트푸드" if amenity == "fast_food" else "음식점")
    return "cafe", "카페"


def refine_category(name: str, kind: str, category: str) -> str:
    """cuisine 태그가 없어 '음식점'/'카페'로 남은 곳을 이름으로 보정한다."""
    lowered = name.lower()
    if kind == "cafe":
        if category in ("카페", "디저트", "베이커리"):
            if any(h in lowered for h in BAKERY_HINTS):
                return "베이커리"
            if any(h in lowered for h in DESSERT_HINTS):
                return "디저트"
        return category
    if category not in ("음식점", "패스트푸드"):
        return category
    if any(h in lowered for h in DESSERT_HINTS):
        return "디저트"
    if any(h in lowered for h in BAKERY_HINTS):
        return "베이커리"
    for wanted, hints in NAME_CATEGORY:
        if any(hint in lowered for hint in hints):
            return wanted
    return category


def is_non_food(name: str) -> bool:
    lowered = name.lower().replace(" ", "")
    if lowered in NON_FOOD_EXACT:
        return True
    return any(hint in lowered for hint in NON_FOOD_HINTS)


def place_tags(tags: dict, category: str, parking_near: bool) -> list[str]:
    out: list[str] = []
    if tags.get("outdoor_seating") == "yes":
        out.append("야외석")
    if tags.get("takeaway") in ("yes", "only"):
        out.append("포장")
    if parking_near or tags.get("parking") in ("yes", "lane", "garage"):
        out.append("주차")
    if tags.get("wheelchair") == "yes":
        out.append("무장애")
    if category == "디저트":
        out.append("디저트")
    if category == "베이커리":
        out.append("베이커리")
    if tags.get("opening_hours"):
        out.append("영업시간")
    name = tags.get("name", "")
    if any(chain.lower() in name.lower() for chain in CHAIN_NAMES):
        out.insert(0, "체인")
    seen = set()
    return [t for t in out if not (t in seen or seen.add(t))]


def build_hub_places(hub: dict, payload: dict, radius: int) -> list[dict]:
    restaurants: list[dict] = []
    cafes: list[dict] = []
    parking: list[tuple[float, float]] = []

    for element in payload.get("elements", []):
        tags = element.get("tags") or {}
        point = element_lat_lng(element)
        if not point:
            continue
        lat, lng = point
        if tags.get("amenity") == "parking":
            parking.append((lat, lng))
            continue
        name = (tags.get("name") or "").strip()
        if not name or is_non_food(name):
            continue

        kind, category = category_of(tags)
        category = refine_category(name, kind, category)
        distance = haversine_m(hub["lat"], hub["lng"], lat, lng)
        if distance > radius:
            continue
        parking_near = any(
            haversine_m(lat, lng, plat, plng) <= PARKING_SEARCH_M for plat, plng in parking
        )
        item = {
            "name": name,
            "kind": kind,
            "category": category,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "distance": distance,
            "tags": place_tags(tags, category, parking_near),
            "cuisine": tags.get("cuisine", ""),
            "hours": tags.get("opening_hours", ""),
            "address": " ".join(
                v for v in (tags.get("addr_district"), tags.get("addr_street"), tags.get("addr_housenumber")) if v
            ),
            "website": tags.get("website") or tags.get("contact:website") or "",
            "osmId": f"{element.get('type')}/{element.get('id')}",
            "tagCount": len(tags),
            "hasCuisine": bool(tags.get("cuisine")),
        }
        (cafes if kind == "cafe" else restaurants).append(item)

    def dedupe(items: list[dict]) -> list[dict]:
        ordered = sorted(items, key=lambda item: (-item["tagCount"], item["distance"]))
        kept: list[dict] = []
        for item in ordered:
            a = norm_name(item["name"])
            twin = next(
                (k for k in kept
                 if haversine_m(k["lat"], k["lng"], item["lat"], item["lng"]) < 60 and (
                     norm_name(k["name"]) == a
                     or (min(len(a), len(norm_name(k["name"]))) >= 3
                         and (a in norm_name(k["name"]) or norm_name(k["name"]) in a))
                 )),
                None,
            )
            if twin is None:
                kept.append(item)
        return kept

    def ranked(items: list[dict]) -> list[dict]:
        # 가까운 순이 기본. 태그가 거의 없는(이름만 있는) 항목은 살짝 뒤로 미룬다.
        return sorted(
            items,
            key=lambda item: (
                item["distance"] + (0 if item["hasCuisine"] else 25) + (0 if item["hours"] else 10),
                item["distance"],
                item["name"],
            ),
        )

    selected = ranked(dedupe(restaurants))[:MAX_RESTAURANTS] + ranked(dedupe(cafes))[:MAX_CAFES]
    for item in selected:
        item["distMeters"] = int(round(item["distance"]))
        item["walkMinutes"] = walk_minutes(item["distance"])
        del item["distance"]
    return selected


# ---------------------------------------------------------------- 번들

def bundle(hubs: list[dict], places: list[dict]) -> str:
    hub_rows = []
    for hub in hubs:
        own = [p for p in places if p["hubId"] == hub["id"]]
        hub_rows.append({
            "id": hub["id"],
            "name": hub["name"],
            "label": hub["label"],
            "city": hub["city"],
            "lat": hub["lat"],
            "lng": hub["lng"],
            "spots": hub.get("spots", []),
            "restaurantCount": sum(1 for p in own if p["kind"] == "restaurant"),
            "cafeCount": sum(1 for p in own if p["kind"] == "cafe"),
        })

    categories = sorted({p["category"] for p in places})
    lines = [
        "/* ==================================================================",
        "   HD2Lab | Midpoint (PKPilot0002)",
        "   places.js — 모임 거점 주변 맛집·카페 POI (자동 생성)",
        "   생성: python3 tools/build_places.py  ·  원본: tools/data/places.json",
        "   출처: OpenStreetMap contributors (ODbL) — 이름·좌표·영업 태그",
        "   리뷰·평점은 담지 않는다. 앱은 네이버·카카오 지도 링크로 넘긴다.",
        "   ================================================================== */",
        "",
        "export const PLACES_META = " + json.dumps({
            "generated": time.strftime("%Y-%m-%d"),
            "source": "OpenStreetMap contributors (ODbL)",
            "license": "ODbL-1.0",
            "radiusMeters": RADIUS_DEFAULT,
            "places": len(places),
            "hubs": len(hubs),
            "categories": categories,
        }, ensure_ascii=False, indent=2) + ";",
        "",
        "export const HUBS = [",
    ]
    for row in hub_rows:
        lines.append("  " + json.dumps(row, ensure_ascii=False) + ",")
    lines.append("];")
    lines.append("")
    lines.append("export const PLACES = [")
    for place in places:
        row = {k: place[k] for k in (
            "id", "hubId", "hubName", "name", "kind", "category", "lat", "lng",
            "distMeters", "walkMinutes", "tags", "naverUrl", "kakaoUrl", "osmUrl",
        )}
        if place.get("hours"):
            row["hours"] = place["hours"]
        if place.get("address"):
            row["address"] = place["address"]
        lines.append("  " + json.dumps(row, ensure_ascii=False) + ",")
    lines.append("];")
    lines.append("")
    return "\n".join(lines)


def search_links(name: str, hub_name: str) -> tuple[str, str]:
    query = f"{hub_name} {name}"
    return (
        "https://map.naver.com/p/search/" + urllib.parse.quote(query),
        "https://map.kakao.com/link/search/" + urllib.parse.quote(query),
    )


RADIUS_DEFAULT = 800


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true", help="Overpass에서 다시 받는다")
    parser.add_argument("--hub", action="append", help="이 거점만 수집한다")
    parser.add_argument("--emit-only", action="store_true", help="캐시만으로 js/places.js를 다시 만든다")
    parser.add_argument("--all", action="store_true", help="모든 거점을 한 번의 요청으로 받는다")
    args = parser.parse_args()

    config = json.loads(HUBS_FILE.read_text())
    radius = int(config.get("radiusM", RADIUS_DEFAULT))
    hubs = config["hubs"]
    if args.hub:
        wanted = set(args.hub)
        hubs = [h for h in hubs if h["id"] in wanted]

    places: list[dict] = []
    if args.all and not args.emit_only:
        pending = [hub for hub in hubs if load_cached(hub["id"], args.refresh) is None]
        if pending:
            print(f"· 거점 {len(pending)}곳을 한 번에 수집 중…")
            payload = None
            last_error = None
            for attempt in range(3):
                endpoint = ENDPOINTS[attempt % len(ENDPOINTS)]
                try:
                    payload = http_json(endpoint, batch_query(pending, radius), timeout=280)
                    break
                except Exception as exc:
                    last_error = exc
                    print(f"  … 일괄 수집 재시도 {attempt + 1} ({endpoint.split('/')[2]}: {exc})", file=sys.stderr)
                    time.sleep(8 * (attempt + 1))
            if payload is None:
                print(f"일괄 수집 실패: {last_error}", file=sys.stderr)
            else:
                print(f"  받은 요소 {len(payload.get('elements', []))}개")
                for hub_id, chunk in split_batch(payload, pending, radius).items():
                    save_cache(hub_id, chunk)
    for hub in hubs:
        payload = load_cached(hub["id"], args.refresh)
        if payload is None and not args.emit_only:
            print(f"· {hub['name']} 수집 중…")
            payload = fetch_hub(hub, radius)
            save_cache(hub["id"], payload)
            time.sleep(3)
        if payload is None:
            print(f"  (캐시 없음: {hub['id']})", file=sys.stderr)
            continue
        items = build_hub_places(hub, payload, radius)
        for item in items:
            naver, kakao = search_links(item["name"], hub["name"])
            item.update({
                "id": f"{hub['id']}-{slug(item['name'])}-{item['osmId'].split('/')[-1]}",
                "hubId": hub["id"],
                "hubName": hub["name"],
                "naverUrl": naver,
                "kakaoUrl": kakao,
                "osmUrl": f"https://www.openstreetmap.org/{item['osmId']}",
            })
        places.extend(items)
        restaurants = sum(1 for i in items if i["kind"] == "restaurant")
        print(f"  {hub['name']}: 맛집 {restaurants} · 카페 {len(items) - restaurants}")

    if args.hub and not args.emit_only:
        print("부분 수집 완료 — 전체 번들은 --emit-only 로 만드세요.")
        return 0

    # 허브 순서는 hubs.json 그대로
    order = {hub["id"]: i for i, hub in enumerate(config["hubs"])}
    places.sort(key=lambda p: (order.get(p["hubId"], 999), p["kind"] != "restaurant", p["distMeters"]))

    for place in places:
        place.pop("tagCount", None)
        place.pop("hasCuisine", None)
        place.pop("cuisine", None)
        place.pop("website", None)
        if place.get("hours") and len(place["hours"]) > 80:
            place["hours"] = place["hours"][:80]

    DATA.mkdir(parents=True, exist_ok=True)
    PLACES_JSON.write_text(json.dumps(places, ensure_ascii=False, indent=1))
    PLACES_OUT.write_text(bundle(config["hubs"], places))
    total_r = sum(1 for p in places if p["kind"] == "restaurant")
    print(f"\n{len(config['hubs'])}개 거점 · 맛집 {total_r} · 카페 {len(places) - total_r} → {PLACES_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
