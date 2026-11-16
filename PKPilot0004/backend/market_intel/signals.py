"""수집 데이터 → 10선 요인 신호 변환 (태깅).

뉴스 헤드라인·공시 제목·시세 지표를 domain.py 의 키워드 사전과 맞춰
요인별 근거(evidence)와 강도(strength 0~1)를 만든다. 강도는 이후
`scoring.py` 의 Non-Fundamental Drift Score 계산에 그대로 쓰인다.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from .domain import FACTOR_BY_ID, FACTORS
from .connectors.opendart import recency_weight

# 출처별 신뢰 가중치: 공시 원문 > 뉴스 > 시세 파생 지표
SOURCE_WEIGHT = {"disclosure": 0.85, "news": 0.70, "market": 0.55}


@dataclass
class Evidence:
    kind: str
    title: str
    source: str = ""
    date: str = ""
    url: str = ""
    match: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "title": self.title,
            "source": self.source,
            "date": self.date,
            "url": self.url,
            "match": list(self.match),
        }


@dataclass
class FactorSignal:
    factor_id: int
    strength: float
    evidence: list[Evidence] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    note: str = ""

    @property
    def factor(self) -> dict:
        return FACTOR_BY_ID[self.factor_id]

    def as_dict(self) -> dict[str, Any]:
        f = self.factor
        return {
            "factor_id": self.factor_id,
            "name": f["name"],
            "axis_id": f["axis_id"],
            "direction": f["direction"],
            "direction_label": f["direction_label"],
            "strength": round(self.strength, 4),
            "score": round(self.strength * f["weight"] * 100, 1),
            "sources": list(self.sources),
            "evidence": [e.as_dict() for e in self.evidence],
            "note": self.note,
        }


def _parse_dt(value: str) -> datetime | None:
    if not value:
        return None
    text = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        for fmt in ("%Y-%m-%d", "%Y%m%d"):
            try:
                dt = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def news_recency(published: str, now: datetime, half_life_days: float = 3.0) -> float:
    dt = _parse_dt(published)
    if dt is None:
        return 0.4
    age = max(0.0, (now - dt).total_seconds() / 86400)
    return float(0.5 ** (age / half_life_days))


def tag_articles(articles: list[dict], *, now: datetime | None = None) -> dict[int, tuple[float, list[Evidence]]]:
    """기사 목록을 요인별 (가중 적중량, 근거)으로 분류한다."""
    now = now or datetime.now(timezone.utc)
    result: dict[int, tuple[float, list[Evidence]]] = {}
    for article in articles:
        title = article.get("title") or ""
        summary = article.get("summary") or ""
        weight = news_recency(article.get("published", ""), now)
        for factor in FACTORS:
            matched = [kw for kw in factor["keywords"] if kw and kw in title]
            weak = [kw for kw in factor["keywords"] if kw and kw not in matched and kw in summary]
            if not matched and not weak:
                continue
            score = weight * (1.0 * len(matched) + 0.35 * len(weak))
            total, evidence = result.get(factor["id"], (0.0, []))
            evidence.append(
                Evidence(
                    kind="news",
                    title=title,
                    source=article.get("source", ""),
                    date=article.get("published", ""),
                    url=article.get("link", ""),
                    match=(matched + weak)[:6],
                )
            )
            result[factor["id"]] = (total + score, evidence)
    return result


def tag_disclosures(disclosures: list[dict], *, now: datetime | None = None) -> dict[int, tuple[float, list[Evidence]]]:
    now = now or datetime.now(timezone.utc)
    result: dict[int, tuple[float, list[Evidence]]] = {}
    for row in disclosures:
        report = row.get("report_nm") or ""
        if not report:
            continue
        weight = recency_weight(row.get("rcept_dt", ""), now=now, half_life_days=10.0)
        for factor in FACTORS:
            matched = [t for t in factor["disclosure_terms"] if t and t in report]
            if not matched:
                continue
            total, evidence = result.get(factor["id"], (0.0, []))
            evidence.append(
                Evidence(
                    kind="disclosure",
                    title=report,
                    source=row.get("corp_name", "") or row.get("flr_nm", ""),
                    date=row.get("rcept_dt", ""),
                    url=row.get("url", ""),
                    match=matched,
                )
            )
            result[factor["id"]] = (total + weight, evidence)
    return result


def _log_strength(weighted: float, saturation: float = 3.0) -> float:
    if weighted <= 0:
        return 0.0
    return min(1.0, math.log1p(weighted) / math.log1p(saturation))


def market_signals(quote: dict | None, *, note_short_interest: bool = True) -> dict[int, tuple[float, list[Evidence], str]]:
    """시세 지표에서 파생되는 요인 신호(3·8번). 키가 필요 없는 값만 쓴다."""
    if not quote:
        return {}
    price = quote.get("price")
    volume = quote.get("volume")
    avg_volume = quote.get("avg_volume_20d")
    signals: dict[int, tuple[float, list[Evidence], str]] = {}
    ratio = (volume / avg_volume) if volume and avg_volume else None

    if ratio is not None and ratio >= 1.5:
        strength = min(1.0, (ratio - 1.0) / 2.0)
        signals[3] = (
            strength,
            [
                Evidence(
                    kind="market",
                    title=f"거래량 평균 대비 {ratio:.1f}배 (기계적 매매·리밸런싱 수급 점검)",
                    source=quote.get("source", ""),
                    date=quote.get("traded_at", ""),
                    url=quote.get("source_url", ""),
                    match=["거래량 급증"],
                )
            ],
            "거래량 급증은 지수 리밸런싱·패시브 자금 유입의 대리 지표입니다.",
        )

    individual = quote.get("individual_net")
    foreign = quote.get("foreign_net")
    if ratio is not None and ratio >= 2.0 and individual and foreign is not None and individual > 0 >= foreign:
        strength = min(1.0, 0.45 + (ratio - 2.0) / 4.0)
        signals[8] = (
            strength,
            [
                Evidence(
                    kind="market",
                    title=f"개인 순매수 +{individual:,.0f}주 / 외국인 {foreign:+,.0f}주, 거래량 {ratio:.1f}배",
                    source=quote.get("source", ""),
                    date=quote.get("traded_at", ""),
                    url=quote.get("source_url", ""),
                    match=["수급 역전"],
                )
            ],
            "공매도 잔고 데이터는 무료 실시간 API가 없어 수급 역전으로 대신 추정했습니다."
            if note_short_interest
            else "",
        )
    if price and quote.get("high_52w") and quote.get("low_52w"):
        span = quote["high_52w"] - quote["low_52w"]
        pos = (price - quote["low_52w"]) / span if span else 0.5
        if pos >= 0.9 and ratio is not None and ratio >= 1.2:
            strength = min(1.0, 0.35 + (pos - 0.9) * 3)
            entry = signals.get(9, (0.0, [], ""))
            signals[9] = (
                max(entry[0], strength),
                entry[1]
                + [
                    Evidence(
                        kind="market",
                        title=f"52주 최고가 대비 {pos * 100:.0f}% 구간, 거래량 {ratio:.1f}배",
                        source=quote.get("source", ""),
                        date=quote.get("traded_at", ""),
                        url=quote.get("source_url", ""),
                        match=["고점 근접"],
                    )
                ],
                "고점 근접 + 거래량 증가는 주식 수 이벤트(무상증자·액면분할) 기대와 함께 나타날 수 있습니다.",
            )
    return signals


def build_signals(
    *,
    articles: list[dict] | None = None,
    disclosures: list[dict] | None = None,
    quote: dict | None = None,
    now: datetime | None = None,
    min_strength: float = 0.12,
) -> list[FactorSignal]:
    """세 소스를 요인별로 병합해 강한 순서의 신호 목록을 만든다."""
    now = now or datetime.now(timezone.utc)
    news = tag_articles(articles or [], now=now)
    dart = tag_disclosures(disclosures or [], now=now)
    market = market_signals(quote)

    factor_ids = set(news) | set(dart) | set(market)
    signals: list[FactorSignal] = []
    for fid in sorted(factor_ids):
        parts: list[tuple[str, float, list[Evidence]]] = []
        if fid in news:
            parts.append(("news", _log_strength(news[fid][0]), news[fid][1]))
        if fid in dart:
            parts.append(("disclosure", _log_strength(dart[fid][0], saturation=1.5), dart[fid][1]))
        if fid in market:
            parts.append(("market", market[fid][0], market[fid][1]))

        # 확률적 OR: 여러 출처가 같은 요인을 가리키면 강도가 올라간다.
        combined = 1.0
        for kind, strength, _ in parts:
            combined *= 1.0 - min(0.99, strength * SOURCE_WEIGHT[kind])
        strength = round(1.0 - combined, 4)
        if strength < min_strength:
            continue
        evidence: list[Evidence] = []
        for _, _, rows in parts:
            evidence.extend(rows)
        evidence.sort(key=lambda e: e.date, reverse=True)
        note = market[fid][2] if fid in market else ""
        signals.append(
            FactorSignal(
                factor_id=fid,
                strength=strength,
                evidence=evidence[:6],
                sources=[p[0] for p in parts],
                note=note,
            )
        )
    signals.sort(key=lambda s: s.strength * s.factor["weight"], reverse=True)
    return signals


def stale_alert(published: str, *, now: datetime | None = None, days: int = 3) -> bool:
    dt = _parse_dt(published)
    if dt is None:
        return True
    now = now or datetime.now(timezone.utc)
    return (now - dt) > timedelta(days=days)
