"""Non-Fundamental Drift Score · 평균 회귀 리스크 계산 (초안 휴리스틱).

핵심 아이디어: 10선 요인 신호는 "가격을 움직이는 힘"이고, 밸류에이션·가격 위치는
"되돌아올 거리"다. 두 값을 분리해 계산한 뒤 곱셈적이 아닌 가중합으로 합쳐
과열 점수(단기)와 평균 회귀 경보(중기)를 각각 제공한다.

모든 계수는 초안 기준값이며 `HANDOFF_ANTIGRAVITY.md` 4절에 근거와 함께 적혀 있다.
"""
from __future__ import annotations

import math
from typing import Any

from .domain import AXES, CORE_CONCLUSION, DISCLAIMER, FACTOR_BY_ID, INVESTOR_PRINCIPLES
from .signals import FactorSignal

NFDS_GAMMA = 0.6

DRIFT_LABELS = (
    (70.0, "과열", "재료 소멸 시 차익실현 매물 출회 가능성이 큰 구간입니다."),
    (50.0, "경계", "수급·기대가 가격을 앞서고 있습니다. 재료의 지속성을 확인해야 합니다."),
    (30.0, "관찰", "일부 비재무 요인이 작동하지만 가격 영향은 제한적입니다."),
    (0.0, "안정", "비재무 요인 신호가 약합니다."),
)

MR_LEVELS = (
    (75.0, "매우 높음", True, "이벤트 종료 시 되돌림 폭이 클 수 있는 구간입니다."),
    (55.0, "높음", True, "평균 회귀 경보: 상승 재료의 수명과 실적 뒷받침을 함께 확인해야 합니다."),
    (35.0, "보통", False, "되돌림 가능성은 있으나 아직 경보 수준은 아닙니다."),
    (0.0, "낮음", False, "가격이 본질 가치 범위 안에 있는 것으로 계산됩니다."),
)

FACTOR_ACTIONS = {
    2: "주주환원은 발표와 이행이 다릅니다. 자사주 소각 시점·수량 공시를 확인하고, 발표만으로 가격이 먼저 반영됐는지 봅니다.",
    9: "무상증자·액면분할은 시가총액을 늘리지 않습니다. 권리락 이후 가격 조정을 급등으로 오독하지 않습니다.",
    3: "지수 편입·편출은 발효일과 패시브 매매 마감일이 정해져 있습니다. 발효 후 수급은 되돌아오는 경우가 많습니다.",
    8: "공매도 잔고비율과 대차 상환 물량을 확인하기 전에는 숏 스퀴즈로 단정하지 않습니다.",
    1: "정치 테마는 공약의 실제 예산·법안 반영 여부와 무관하게 먼저 움직입니다. 실행 근거를 따로 확인합니다.",
    6: "같은 사건이 수혜 업종(방산·보안)과 피해 업종을 동시에 만듭니다. 우리 종목이 어느 쪽인지 먼저 구분합니다.",
    7: "재난 규모·복구 기간·기업의 실제 노출도를 확인합니다. 테마 확산과 매출 영향은 다릅니다.",
    4: "거래정지·소송 진행은 공시로 확인합니다. 평판 악화와 이익 창출력 훼손은 같은 사건에서도 다르게 나타납니다.",
    5: "노출의 지속성과 실제 매출 연결 여부를 확인합니다. 대부분의 노출 효과는 며칠 안에 소멸합니다.",
    10: "미확인 정보는 조회공시 답변으로 확인합니다. 사실무근 공시가 나오면 급등분이 그대로 반납될 수 있습니다.",
}


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _tanh_norm(value: float, scale: float) -> float:
    return _clamp(0.5 + 0.5 * math.tanh(value / scale))


def axis_breakdown(signals: list[FactorSignal]) -> list[dict[str, Any]]:
    """축별 점수. 요인 신호가 여러 개면 확률적 OR 로 합산한다."""
    by_axis: dict[str, list[dict[str, Any]]] = {a["id"]: [] for a in AXES}
    for signal in signals:
        factor = FACTOR_BY_ID[signal.factor_id]
        by_axis[factor["axis_id"]].append(
            {
                "factor_id": factor["id"],
                "name": factor["name"],
                "strength": round(signal.strength, 4),
                "contribution": round(signal.strength * factor["weight"], 4),
            }
        )
    rows = []
    for axis in AXES:
        parts = sorted(by_axis[axis["id"]], key=lambda x: x["contribution"], reverse=True)
        remaining = 1.0
        for part in parts:
            remaining *= 1.0 - min(0.99, part["strength"] * FACTOR_BY_ID[part["factor_id"]]["weight"])
        score = 1.0 - remaining
        rows.append(
            {
                "axis_id": axis["id"],
                "name": axis["name"],
                "score": round(score, 4),
                "score_100": round(score * 100, 1),
                "weight": axis["weight"],
                "factors": parts,
            }
        )
    return rows


def weighted_pressure(axes: list[dict[str, Any]]) -> float:
    """축 가중 평균 압력(0~1). 4개 축이 모두 강할수록 1에 가까워진다."""
    return round(_clamp(sum(row["score"] * row["weight"] for row in axes)), 4)


def non_fundamental_drift_score(axes: list[dict[str, Any]]) -> float:
    """NFDS = 100 × (축 가중 압력)^0.6.

    감마 0.6 보정: 한 축만 강하게 작동해도 점수가 0 근처에 머무는 것을 막고,
    동시에 4축이 모두 1에 가까운 극단값은 압축한다(초안 휴리스틱).
    """
    return round(weighted_pressure(axes) ** NFDS_GAMMA * 100, 1)


def drift_label(score: float) -> dict[str, Any]:
    for threshold, label, message in DRIFT_LABELS:
        if score >= threshold:
            return {"label": label, "threshold": threshold, "message": message}
    return {"label": "안정", "threshold": 0, "message": ""}


def drift_direction(signals: list[FactorSignal]) -> dict[str, Any]:
    up_terms = {"up"}
    down_terms = {"down"}
    up = down = 0.0
    for signal in signals:
        direction = FACTOR_BY_ID[signal.factor_id]["direction"]
        magnitude = signal.strength * FACTOR_BY_ID[signal.factor_id]["weight"]
        if direction == "up":
            up += magnitude
        elif direction == "down":
            down += magnitude
        elif direction == "reversal":
            up += magnitude * 0.6
            down += magnitude * 0.6
        else:  # both / split: 방향을 확정하지 않고 양쪽에 절반씩 기록
            up += magnitude * 0.5
            down += magnitude * 0.5
    total = up + down
    if total < 0.05:
        return {"code": "NEUTRAL", "label": "중립", "up": 0.0, "down": 0.0}
    share = max(up, down) / total
    if share < 0.6:
        return {"code": "VOLATILE", "label": "▲▼ 양방향 변동성", "up": round(up, 3), "down": round(down, 3)}
    if up > down:
        return {"code": "UP", "label": "▲ 단기 급등 우위", "up": round(up, 3), "down": round(down, 3)}
    return {"code": "DOWN", "label": "▼ 단기 급락 우위", "up": round(up, 3), "down": round(down, 3)}


def valuation_stretch(quote: dict | None) -> dict[str, Any]:
    """가격 위치와 밸류에이션 선반영도. 값이 없으면 그 항목은 제외하고 기록한다."""
    result: dict[str, Any] = {
        "range_position": None,
        "ma60_extension": None,
        "valuation_premium": None,
        "components": [],
        "coverage": 0.0,
        "notes": [],
    }
    if not quote:
        result["notes"].append("시세 데이터 없음")
        return result

    price = quote.get("price")
    high, low = quote.get("high_52w"), quote.get("low_52w")
    if price and high and low and high > low:
        result["range_position"] = round(_clamp((price - low) / (high - low)), 4)
        result["components"].append(("range_position", result["range_position"]))

    ma60 = quote.get("ma60")
    if price and ma60:
        result["ma60_extension"] = round(price / ma60 - 1.0, 4)
        result["components"].append(("ma60_extension", _tanh_norm(result["ma60_extension"], 0.20)))

    per, fwd = quote.get("per"), quote.get("consensus_per")
    if per and fwd and fwd > 0:
        result["valuation_premium"] = round(per / fwd - 1.0, 4)
        result["components"].append(("valuation_premium", _tanh_norm(result["valuation_premium"], 0.30)))
    else:
        result["notes"].append("후행/선행 PER 비교 불가(밸류에이션 항목 제외)")

    if result["components"]:
        result["coverage"] = round(len(result["components"]) / 3, 2)
    return result


def mean_reversion_risk(drift_score: float, stretch: dict[str, Any]) -> dict[str, Any]:
    """평균 회귀 리스크 0~100. 가격 위치 40% + 이격 30% + 밸류에이션 30%, 이후 과열 점수와 합산."""
    weight_map = {"range_position": 0.40, "ma60_extension": 0.30, "valuation_premium": 0.30}
    available = [(name, value) for name, value in stretch.get("components", [])]
    if available:
        weight_sum = sum(weight_map[name] for name, _ in available)
        base = sum(weight_map[name] * value for name, value in available) / weight_sum
        base_score = base * 100
    else:
        base_score = 0.0
    combined = round(_clamp(0.55 * (base_score / 100) + 0.45 * (drift_score / 100)) * 100, 1)
    for threshold, level, alert, message in MR_LEVELS:
        if combined >= threshold:
            break
    return {
        "score": combined,
        "level": level,
        "alert": alert,
        "message": message,
        "price_position_score": round(base_score, 1),
        "coverage": stretch.get("coverage", 0.0),
        "components": {
            "range_position": stretch.get("range_position"),
            "ma60_extension": stretch.get("ma60_extension"),
            "valuation_premium": stretch.get("valuation_premium"),
        },
        "notes": list(stretch.get("notes", [])),
    }


def fundamental_check(quote: dict | None) -> dict[str, Any]:
    if not quote:
        return {"status": "unknown", "message": "실적 데이터 없음", "flags": []}
    flags: list[str] = []
    per, fwd = quote.get("per"), quote.get("consensus_per")
    eps, fwd_eps = quote.get("eps"), quote.get("consensus_eps")
    if per and fwd and per > fwd * 1.2:
        flags.append("후행 PER이 선행 PER보다 높습니다(이익 개선 기대 선반영).")
    if per and fwd and per < fwd * 0.8:
        flags.append("후행 PER이 선행 PER보다 낮습니다(이익 감소 전망 반영).")
    if eps and fwd_eps and fwd_eps > eps:
        flags.append(f"컨센서스 EPS {fwd_eps:,.0f}원이 직전 EPS {eps:,.0f}원보다 높습니다.")
    if not flags:
        flags.append("이익 추정치와 PER 괴리가 크지 않습니다.")
    return {
        "status": "ok",
        "message": "이익 창출력 대비 가격 수준을 PER/EPS로만 비교한 초안 판정입니다.",
        "flags": flags,
    }


def investor_principles(signals: list[FactorSignal], direction: dict[str, Any], mr: dict[str, Any]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    code = direction.get("code")
    for principle in INVESTOR_PRINCIPLES:
        if principle["tone"] == "up" and code in {"UP", "VOLATILE"}:
            rows.append(dict(principle))
        if principle["tone"] == "down" and code in {"DOWN", "VOLATILE"}:
            rows.append(dict(principle))
    if not rows:
        rows.append(dict(INVESTOR_PRINCIPLES[0]))
    actions = []
    for signal in signals[:5]:
        action = FACTOR_ACTIONS.get(signal.factor_id)
        if action:
            actions.append({"factor_id": signal.factor_id, "name": FACTOR_BY_ID[signal.factor_id]["name"], "action": action})
    return {"rows": rows, "factor_actions": actions, "mean_reversion": mr["message"], "core_conclusion": CORE_CONCLUSION, "disclaimer": DISCLAIMER}


def confidence(sources: list[dict[str, Any]], stretch: dict[str, Any]) -> dict[str, Any]:
    live = [s for s in sources if s.get("status") == "live"]
    total = len(sources) or 1
    ratio = len(live) / total
    score = round(_clamp(0.6 * ratio + 0.4 * stretch.get("coverage", 0.0)) * 100)
    label = "높음" if score >= 70 else "보통" if score >= 40 else "낮음"
    return {
        "score": score,
        "label": label,
        "live_sources": len(live),
        "total_sources": total,
        "note": "실데이터 연결 수와 밸류에이션 지표 확보율로 계산한 초안 신뢰도입니다.",
    }


def score_payload(
    *,
    signals: list[FactorSignal],
    quote: dict | None,
    sources: list[dict[str, Any]],
) -> dict[str, Any]:
    axes = axis_breakdown(signals)
    nfds = non_fundamental_drift_score(axes)
    stretch = valuation_stretch(quote)
    mr = mean_reversion_risk(nfds, stretch)
    direction = drift_direction(signals)
    return {
        "axes": axes,
        "nfds": {
            "score": nfds,
            "weighted": round(weighted_pressure(axes) * 100, 1),
            "label": drift_label(nfds)["label"],
            "message": drift_label(nfds)["message"],
            "direction": direction,
        },
        "mean_reversion": mr,
        "valuation": stretch,
        "fundamental": fundamental_check(quote),
        "principles": investor_principles(signals, direction, mr),
        "confidence": confidence(sources, stretch),
    }
