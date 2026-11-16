from __future__ import annotations

from market_intel import domain


def test_domain_is_internally_consistent() -> None:
    assert domain.validate_domain() == []


def test_ten_factors_and_four_axes_mapping() -> None:
    expected = {
        "AX01": [2, 9],
        "AX02": [3, 8],
        "AX03": [1, 6, 7],
        "AX04": [4, 5, 10],
    }
    actual = {a["id"]: list(a["factor_ids"]) for a in domain.AXES}
    assert actual == expected
    assert len(domain.FACTORS) == 10
    assert sorted(f["id"] for f in domain.FACTORS) == list(range(1, 11))


def test_factor_names_match_brief() -> None:
    names = {f["id"]: f["name"] for f in domain.FACTORS}
    assert names[1] == "정치 및 선거 테마"
    assert names[2] == "행동주의 및 주주환원"
    assert names[3] == "주가지수 편입·리밸런싱"
    assert names[4] == "경영진 사법·도덕적 리스크"
    assert names[5] == "유명 인사·미디어 노출"
    assert names[6] == "지정학적 갈등·안보 위기"
    assert names[7] == "자연재해 및 전염병 확산"
    assert names[8] == "공매도 숏 스퀴즈"
    assert names[9] == "무상증자 및 액면분할"
    assert names[10] == "커뮤니티·SNS발 루머"


def test_brief_table_rows_and_direction_labels() -> None:
    labels = {f["id"]: f["direction_label"] for f in domain.FACTORS}
    assert labels[2] == "▲ 환원 / ▼ 분할"
    assert labels[3] == "▲ 편입 / ▼ 편출"
    assert labels[4] == "▼ 급락·폭락"
    assert labels[8] == "▲ 폭등 연출"
    assert labels[10] == "▲▼ 급등락 회귀"


def test_display_order_follows_brief_table() -> None:
    payload = domain.factors_payload()
    assert [row["id"] for row in payload["factors"]] == [2, 9, 3, 8, 1, 6, 7, 4, 5, 10]


def test_mechanism_and_conclusion_are_preserved() -> None:
    payload = domain.factors_payload()
    assert payload["mechanism"]["center"] == "단기 수급 불균형 및 비이성적 기대·공포 증폭"
    assert [o["id"] for o in payload["mechanism"]["outcomes"]] == ["UP", "DOWN", "REVERSION"]
    assert "평균 회귀" in payload["mechanism"]["outcomes"][2]["label"]
    assert "원래의 내재 가치로 회귀" in payload["core_conclusion"]
    assert len(payload["principles"]) == 2
    assert payload["principles"][0]["action"].startswith("재료 소멸 시")
    assert payload["principles"][1]["action"].startswith("단순 낙폭 과대")


def test_axis_weights_sum_to_one() -> None:
    assert abs(sum(a["weight"] for a in domain.AXES) - 1.0) < 1e-9


def test_broken_mapping_is_detected() -> None:
    broken = dict(domain.FACTOR_BY_ID[1])
    broken["axis_id"] = "AX04"
    original = domain.FACTOR_BY_ID[1]
    domain.FACTOR_BY_ID[1] = broken
    try:
        problems = domain.validate_domain()
    finally:
        domain.FACTOR_BY_ID[1] = original
    assert any("불일치" in p for p in problems)
