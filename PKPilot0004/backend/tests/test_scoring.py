from __future__ import annotations

from market_intel.domain import CORE_CONCLUSION, FACTOR_BY_ID
from market_intel.scoring import (
    axis_breakdown,
    confidence,
    drift_direction,
    drift_label,
    fundamental_check,
    investor_principles,
    mean_reversion_risk,
    non_fundamental_drift_score,
    score_payload,
    valuation_stretch,
    weighted_pressure,
)
from market_intel.signals import Evidence, FactorSignal

QUOTE_RICH = {
    "price": 209000,
    "high_52w": 380000,
    "low_52w": 93500,
    "ma60": 120000,
    "per": 30.0,
    "consensus_per": 12.0,
    "eps": 5000,
    "consensus_eps": 9000,
    "volume": 30000000,
    "avg_volume_20d": 5000000,
}


def signal(fid: int, strength: float) -> FactorSignal:
    return FactorSignal(factor_id=fid, strength=strength, evidence=[Evidence(kind="news", title="t")], sources=["news"])


def test_empty_signals_score_zero() -> None:
    axes = axis_breakdown([])
    assert non_fundamental_drift_score(axes) == 0.0
    assert drift_label(0)["label"] == "안정"


def test_axis_breakdown_places_factors_in_their_axis() -> None:
    rows = {r["axis_id"]: r for r in axis_breakdown([signal(4, 0.8), signal(9, 0.5)])}
    assert rows["AX04"]["score"] > 0
    assert rows["AX01"]["score"] > 0
    assert rows["AX02"]["score"] == 0
    assert rows["AX04"]["factors"][0]["name"] == "경영진 사법·도덕적 리스크"


def test_nfds_increases_with_more_signals() -> None:
    base = non_fundamental_drift_score(axis_breakdown([signal(10, 0.4)]))
    more = non_fundamental_drift_score(axis_breakdown([signal(10, 0.4), signal(4, 0.6)]))
    strongest = non_fundamental_drift_score(axis_breakdown([signal(10, 0.9), signal(4, 0.9)]))
    assert 0 < base < more < strongest <= 100


def test_nfds_gamma_lifts_single_axis_pressure() -> None:
    axes = axis_breakdown([signal(2, 0.9)])
    assert weighted_pressure(axes) < 0.2
    # 감마 0.6 보정으로 단일 축 신호도 '관찰' 구간까지 올라온다.
    assert 25 <= non_fundamental_drift_score(axes) <= 45
    assert drift_label(non_fundamental_drift_score(axes))["label"] == "관찰"


def test_drift_labels_thresholds() -> None:
    assert drift_label(90)["label"] == "과열"
    assert drift_label(70)["label"] == "과열"
    assert drift_label(69.9)["label"] == "경계"
    assert drift_label(30)["label"] == "관찰"
    assert drift_label(29.9)["label"] == "안정"


def test_direction_up_down_and_volatile() -> None:
    up = drift_direction([signal(9, 0.8), signal(5, 0.7)])
    down = drift_direction([signal(4, 0.9)])
    volatile = drift_direction([signal(9, 0.8), signal(4, 0.8)])
    neutral = drift_direction([])
    assert up["code"] == "UP"
    assert down["code"] == "DOWN"
    assert volatile["code"] == "VOLATILE"
    assert neutral["code"] == "NEUTRAL"


def test_valuation_stretch_uses_three_components() -> None:
    stretch = valuation_stretch(QUOTE_RICH)
    assert stretch["range_position"] is not None
    assert stretch["ma60_extension"] > 0
    assert stretch["valuation_premium"] > 0
    assert stretch["coverage"] == 1.0


def test_valuation_stretch_without_per_reports_note() -> None:
    stretch = valuation_stretch({"price": 100, "high_52w": 200, "low_52w": 50, "ma60": 90})
    assert stretch["valuation_premium"] is None
    assert any("PER" in note for note in stretch["notes"])


def test_mean_reversion_alert_on_stretched_price() -> None:
    stretch = valuation_stretch(QUOTE_RICH)
    hot = mean_reversion_risk(85, stretch)
    calm = mean_reversion_risk(5, valuation_stretch({"price": 100, "high_52w": 200, "low_52w": 95, "ma60": 120, "per": 8, "consensus_per": 9}))
    assert hot["level"] == "매우 높음"
    assert hot["alert"] is True
    assert calm["alert"] is False
    assert hot["score"] > calm["score"]


def test_mean_reversion_without_quote_is_flagged() -> None:
    mr = mean_reversion_risk(70, valuation_stretch(None))
    assert mr["coverage"] == 0.0
    assert mr["components"]["range_position"] is None
    assert any("시세" in n for n in mr["notes"])


def test_fundamental_check_flags_forward_earnings() -> None:
    check = fundamental_check({"per": 31, "consensus_per": 12, "eps": 100, "consensus_eps": 200})
    assert check["status"] == "ok"
    assert any("선반영" in flag for flag in check["flags"])
    assert any("컨센서스 EPS" in flag for flag in check["flags"])


def test_principles_follow_direction_and_include_conclusion() -> None:
    up = investor_principles([signal(9, 0.7)], {"code": "UP"}, {"message": "m"})
    down = investor_principles([signal(4, 0.8)], {"code": "DOWN"}, {"message": "m"})
    assert up["rows"][0]["tone"] == "up"
    assert down["rows"][0]["tone"] == "down"
    assert up["factor_actions"][0]["name"] == FACTOR_BY_ID[9]["name"]
    assert up["core_conclusion"] == CORE_CONCLUSION


def test_confidence_tracks_live_sources_and_coverage() -> None:
    live = [{"name": "a", "status": "live"}, {"name": "b", "status": "live"}, {"name": "c", "status": "live"}]
    mixed = [{"name": "a", "status": "live"}, {"name": "b", "status": "sample"}, {"name": "c", "status": "disabled"}]
    high = confidence(live, {"coverage": 1.0})
    low = confidence(mixed, {"coverage": 0.0})
    assert high["label"] == "높음"
    assert low["label"] == "낮음"
    assert high["score"] > low["score"]


def test_score_payload_shape() -> None:
    payload = score_payload(
        signals=[signal(2, 0.7), signal(3, 0.5)],
        quote=QUOTE_RICH,
        sources=[{"name": "naver_quote", "status": "live"}],
    )
    assert set(payload) == {"axes", "nfds", "mean_reversion", "valuation", "fundamental", "principles", "confidence"}
    assert len(payload["axes"]) == 4
    assert 0 <= payload["nfds"]["score"] <= 100
    assert payload["nfds"]["direction"]["code"] in {"UP", "DOWN", "VOLATILE", "NEUTRAL"}
