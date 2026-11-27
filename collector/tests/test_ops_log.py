import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ops_log  # noqa: E402

RULES = ops_log.load_rules()


def run(run_at, **sources):
    """sources: 이름=(status, found[, expired]) → collector_runs 줄"""
    rows = []
    for name, v in sources.items():
        status, found = v[0], v[1]
        expired = v[2] if len(v) > 2 else False
        rows.append({"run_at": run_at, "source": name, "kind": ops_log.kind_of(name),
                     "status": status, "found": found, "new": 0, "dup": found, "fail": 0,
                     "expired_def": expired, "note": f"{name} note"})
    return rows


def test_parse_counts():
    assert ops_log.parse_counts("✅ 수집 완료: 발견 28건 (신규 1, 중복 27, 실패 0)") == {"found": 28, "new": 1, "dup": 27, "fail": 0}
    assert ops_log.parse_counts("✅ KOPIS 수집 완료: 경남 94 · 부산 100건 (신규 3, 중복 191, 실패 0, 지역제외 0)")["found"] == 194
    assert ops_log.parse_counts("✅ 블로그 행사 10건 (신규 0, 중복 10)") == {"found": 10, "new": 0, "dup": 10, "fail": 0}
    assert ops_log.parse_counts("❌ 사이트 오류: Cannot connect")["found"] is None


def test_to_rows_publish_and_expired():
    rows = ops_log.to_rows(
        [{"name": "거창문화재단", "status": "SUCCESS", "summary": "⚠️ 수집 완료: 발견 7건 (신규 0, 중복 7, 실패 0) / 정의 만료 의심 게시판 1"}],
        "2026-11-25T15:00:00+09:00", publish_line="• 자동 공개: 후보 5건 → 발행 5, 중복 0")
    assert rows[0]["expired_def"] is True and rows[0]["kind"] == "website"
    assert rows[1]["source"] == "자동 공개" and rows[1]["found"] == 5 and rows[1]["status"] == "SUCCESS"


def test_zero_found_needs_two_runs_and_kopis_is_bad():
    r1 = run("2026-11-25T08:20:00+09:00", KOPIS=("FAIL", 0), A=("SUCCESS", 3))
    a1 = ops_log.judge(r1, RULES)
    assert [a["rule"] for a in a1 if a["target"] == "KOPIS"] == ["source_fail"]
    r2 = run("2026-11-25T15:00:00+09:00", KOPIS=("FAIL", 0), A=("SUCCESS", 3)) + r1
    a2 = {(a["rule"], a["target"]): a for a in ops_log.judge(r2, RULES)}
    assert a2[("zero_found", "KOPIS")]["level"] == "bad"
    assert a2[("zero_found", "KOPIS")]["since"] == "2026-11-25T08:20:00+09:00"
    assert not any(t == "A" for _, t in a2)


def test_quiet_override():
    rows = run("2026-11-25T15:00:00+09:00", B=("SUCCESS", 0)) + run("2026-11-25T08:20:00+09:00", B=("SUCCESS", 0))
    assert any(a["rule"] == "zero_found" for a in ops_log.judge(rows, RULES))
    assert not ops_log.judge(rows, RULES, quiet={"B": 6})


def test_def_expired_instead_of_fail():
    rows = run("2026-11-25T15:00:00+09:00", C=("FAIL", 0, True))
    rules = [a["rule"] for a in ops_log.judge(rows, RULES)]
    assert "def_expired" in rules and "source_fail" not in rules


def test_publish_zero_three_runs():
    rows = []
    for t in ("2026-11-24T15:00:00+09:00", "2026-11-25T08:20:00+09:00", "2026-11-25T15:00:00+09:00"):
        rows = [{"run_at": t, "source": "자동 공개", "kind": "publish", "status": "SUCCESS", "found": 0,
                 "expired_def": False, "note": ""}] + rows
    assert [a["rule"] for a in ops_log.judge(rows, RULES)] == ["publish_zero"]
    assert ops_log.judge(rows[:2], RULES) == []


def test_source_missing_from_latest_run_not_judged():
    rows = run("2026-11-25T15:00:00+09:00", A=("SUCCESS", 3)) + run("2026-11-25T08:20:00+09:00", Old=("FAIL", None))
    assert ops_log.judge(rows, RULES) == []


def test_merge_open_keep_resolve():
    now1 = "2026-11-25T06:00:00+00:00"
    act = [{"rule": "source_fail", "target": "A", "level": "bad", "text": "A 실패", "since": "x"}]
    alerts, opened, resolved = ops_log.merge_alerts([], act, now1)
    assert len(opened) == 1 and not resolved
    # 같은 경고가 계속 켜져 있으면 다시 «켜짐»이 아니다
    alerts2, opened2, _ = ops_log.merge_alerts(alerts, act, "2026-11-25T07:00:00+00:00")
    assert not opened2 and alerts2[0]["since"] == "x"
    alerts3, _, resolved3 = ops_log.merge_alerts(alerts2, [], "2026-11-25T08:00:00+00:00")
    assert len(resolved3) == 1 and alerts3[0]["resolved_at"] == "2026-11-25T08:00:00+00:00"
    # 7일이 지난 풀린 경고는 빠진다
    alerts4, _, _ = ops_log.merge_alerts(alerts3, [], "2026-12-03T08:00:00+00:00")
    assert alerts4 == []


def test_keep_recent():
    rows = [{"run_at": f"2026-11-{d:02d}T08:20:00+09:00", "source": "A"} for d in range(1, 31)]
    kept = ops_log.keep_recent(rows, keep=3)
    assert [r["run_at"][:10] for r in kept] == ["2026-11-30", "2026-11-29", "2026-11-28"]


def test_rows_from_real_log():
    logs = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
    path = os.path.join(logs, "scheduled_20261125_1500.log")
    if not os.path.exists(path):
        return
    rows = ops_log.rows_from_log(path, {"김해시 블로그"})
    by = {r["source"]: r for r in rows}
    assert by["KOPIS"]["found"] == 0 and by["KOPIS"]["status"] == "FAIL"
    assert by["부산현대미술관"]["status"] == "FAIL" and by["부산현대미술관"]["found"] is None
    assert by["김해시 블로그"]["kind"] == "blog"
    assert by["자동 공개"]["found"] == 5
