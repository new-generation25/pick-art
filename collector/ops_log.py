"""정기 수집 실행 기록과 이상 판정 (specs/003-ops-automation R1)

정기 실행이 끝날 때 main.py 가 부른다.
  1. 출처별 결과(이름·상태·요약 글)를 숫자 줄로 바꾼다. 숫자는 요약 글에서 읽는다
     (「발견 N건 (신규 a, 중복 b, 실패 c)」 — 스크래퍼가 이미 쓰는 문구, 로그와 같은 출처)
  2. ops_snapshots 의 collector_runs 에 붙이고 최근 60회만 남긴다
  3. rules/alerts.json 규칙으로 경고를 판정해 collector_alerts 를 고친다(켜짐·풀림)
  4. 텔레그램에 보낼 글을 돌려준다: 경고가 켜지거나 풀렸을 때, 그리고 그날 오후 첫 실행의 하루 요약

JSON 모양: specs/003-ops-automation/contracts/ops-snapshots.md, 규칙: contracts/alert-rules.md

손으로 쓰기 (collector 폴더에서)
  python ops_log.py --backfill            지난 logs/scheduled_*.log 로 collector_runs 채우기(이미 있는 run_at 은 건너뜀)
  python ops_log.py --test-fail KOPIS     시험: 이름이 *_test 인 스냅숏에서 KOPIS 0건 2회 → 정상 1회를 흉내 내고
                                          켜짐·풀림을 출력한다. --send 를 붙이면 텔레그램에 [시험] 머리로 보낸다
"""
import glob
import html
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
KEEP_RUNS = 60
DASHBOARD = "https://picka.news/admin"
HERE = os.path.dirname(os.path.abspath(__file__))
RULES_PATH = os.path.join(HERE, "rules", "alerts.json")
PUBLISH_SOURCE = "자동 공개"

COUNT_RE = re.compile(r"발견 (\d+)건 \(신규 (\d+), 중복 (\d+), 실패 (\d+)")
KOPIS_RE = re.compile(r"경남 (\d+) · 부산 (\d+)건 \(신규 (\d+), 중복 (\d+), 실패 (\d+)")
BLOG_RE = re.compile(r"블로그 행사 (\d+)건 \(신규 (\d+), 중복 (\d+)\)")
PUBLISH_RE = re.compile(r"발행 (\d+)")


# ---------- 1. 결과 → 숫자 줄 ----------

def parse_counts(summary):
    """요약 글에서 found/new/dup/fail. 읽을 수 없으면 모두 None"""
    s = summary or ""
    m = KOPIS_RE.search(s)
    if m:
        a, b, new, dup, fail = map(int, m.groups())
        return {"found": a + b, "new": new, "dup": dup, "fail": fail}
    m = COUNT_RE.search(s)
    if m:
        found, new, dup, fail = map(int, m.groups())
        return {"found": found, "new": new, "dup": dup, "fail": fail}
    m = BLOG_RE.search(s)
    if m:
        found, new, dup = map(int, m.groups())
        return {"found": found, "new": new, "dup": dup, "fail": 0}
    return {"found": None, "new": None, "dup": None, "fail": None}


def kind_of(name, blog_names=()):
    if name == "KOPIS":
        return "kopis"
    if name == PUBLISH_SOURCE:
        return "publish"
    if name.endswith(".py"):
        return "tool"
    if name in blog_names:
        return "blog"
    return "website"


def to_rows(results, run_at, blog_names=(), publish_line=None):
    """main.py 의 results([{name, status, summary}]) → collector_runs 줄. 자동 공개 줄을 끝에 더한다"""
    rows = []
    for r in results:
        summary = (r.get("summary") or "").strip()
        row = {"run_at": run_at, "source": r["name"], "kind": kind_of(r["name"], blog_names),
               "status": r.get("status") or "FAIL", **parse_counts(summary),
               "expired_def": "정의 만료 의심" in summary, "note": summary[:200]}
        rows.append(row)
    if publish_line is not None:
        m = PUBLISH_RE.search(publish_line)
        ok = m is not None and "실패" not in publish_line.split("→")[0]
        rows.append({"run_at": run_at, "source": PUBLISH_SOURCE, "kind": "publish",
                     "status": "SUCCESS" if ok else ("SKIP" if "꺼짐" in publish_line else "FAIL"),
                     "found": int(m.group(1)) if m else None, "new": None, "dup": None, "fail": None,
                     "expired_def": False, "note": publish_line.strip("• ")[:200]})
    return rows


def keep_recent(rows, keep=KEEP_RUNS):
    """run_at 내림차순, 최근 keep 회만"""
    runs = sorted({r["run_at"] for r in rows}, reverse=True)[:keep]
    keep_set = set(runs)
    order = {ra: i for i, ra in enumerate(runs)}
    kept = [r for r in rows if r["run_at"] in keep_set]
    # 같은 실행 안에서는 들어온 순서를 지킨다(안정 정렬)
    return sorted(kept, key=lambda r: order[r["run_at"]])


# ---------- 2. 판정 ----------

def load_rules(path=RULES_PATH):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _label(run_at):
    try:
        t = datetime.fromisoformat(run_at).astimezone(KST)
        return f"{t.month}/{t.day} {t:%H:%M}"
    except ValueError:
        return run_at


def judge(rows, rules, quiet=None):
    """지금 켜져 있어야 할 경고 [{rule, target, level, text, since}]. rows 는 collector_runs 전체"""
    quiet = quiet or {}
    runs = sorted({r["run_at"] for r in rows}, reverse=True)
    if not runs:
        return []
    latest = runs[0]
    by_source = {}
    for ra in runs:  # 최신 실행부터
        for r in rows:
            if r["run_at"] == ra:
                by_source.setdefault(r["source"], []).append(r)
    alerts = []

    def streak(hist, cond):
        n = 0
        for r in hist:
            if not cond(r):
                break
            n += 1
        return n

    for source, hist in by_source.items():
        last = hist[0]
        if last["run_at"] != latest:
            continue  # 이번 실행에 없던 출처(화이트리스트에서 빠짐 등)는 판정하지 않는다
        kind = last["kind"]
        note = (last.get("note") or "").lstrip("❌⚠️✅ ")[:120]

        if last.get("expired_def") and kind in rules["def_expired"].get("kinds", [kind]):
            rule = rules["def_expired"]
            alerts.append({"rule": "def_expired", "target": source, "level": rule["level"],
                           "text": rule["text"].format(source=source), "since": last["run_at"]})
        elif last["status"] == "FAIL" and kind != "publish":
            rule = rules["source_fail"]
            alerts.append({"rule": "source_fail", "target": source, "level": rule["level"],
                           "text": rule["text"].format(source=source, note=note), "since": last["run_at"]})

        zf = rules["zero_found"]
        if kind in zf.get("kinds", []):
            need = zf["runs"]
            level = zf["level"]
            if source == "KOPIS" and "kopis_override" in rules:
                need = rules["kopis_override"].get("zero_found_runs", need)
                level = rules["kopis_override"].get("level", level)
            need = quiet.get(source, need)
            n = streak(hist, lambda r: r.get("found") == 0)
            if n >= need:
                since = hist[n - 1]["run_at"]
                alerts.append({"rule": "zero_found", "target": source, "level": level,
                               "text": zf["text"].format(source=source, n=n, since=_label(since)), "since": since})

        if kind == "publish":
            pz = rules["publish_zero"]
            n = streak(hist, lambda r: r.get("found") == 0)
            if n >= pz["runs"]:
                since = hist[n - 1]["run_at"]
                alerts.append({"rule": "publish_zero", "target": source, "level": pz["level"],
                               "text": pz["text"].format(n=n, since=_label(since)), "since": since})
    return alerts


def merge_alerts(prev, active, now, keep_days=7):
    """이전 경고 목록 + 지금 판정 → (새 목록, 켜진 것, 풀린 것). 같은 (rule, target)이 켜져 있으면 다시 만들지 않는다"""
    open_prev = {(a["rule"], a["target"]): a for a in prev if not a.get("resolved_at")}
    active_keys = {(a["rule"], a["target"]) for a in active}
    out, opened, resolved = [], [], []
    for a in active:
        key = (a["rule"], a["target"])
        if key in open_prev:
            kept = dict(open_prev[key])
            kept.update({"level": a["level"], "text": a["text"]})  # since 는 처음 켜진 때를 지킨다
            out.append(kept)
        else:
            row = {**a, "resolved_at": None}
            out.append(row)
            opened.append(row)
    cutoff = (datetime.fromisoformat(now) - timedelta(days=keep_days)).isoformat()
    for key, a in open_prev.items():
        if key not in active_keys:
            row = {**a, "resolved_at": now}
            out.append(row)
            resolved.append(row)
    for a in prev:
        if a.get("resolved_at") and a["resolved_at"] >= cutoff:
            out.append(a)
    rank = {"bad": 0, "warn": 1}
    out.sort(key=lambda a: (a.get("resolved_at") is not None, rank.get(a["level"], 2), a["target"]))
    return out, opened, resolved


# ---------- 3. 텔레그램 글 ----------

def alert_message(opened, resolved, limit=5, prefix=""):
    if not opened and not resolved:
        return None
    lines = [f"{prefix}⚠️ 피카 수집 경고"]
    # 텔레그램은 HTML 모드로 보낸다(notifier.py): 사이트 오류 글의 < > & 를 그대로 두면 전송이 실패한다
    items = [f"켜짐 · {html.escape(a['text'])}" for a in opened] + [f"풀림 · {html.escape(a['text'])}" for a in resolved]
    lines += items[:limit]
    if len(items) > limit:
        lines.append(f"외 {len(items) - limit}건 — 대시보드 {DASHBOARD}")
    else:
        lines.append(DASHBOARD)
    return "\n".join(lines)


def is_daily_summary_run(rows, run_at):
    """그날(KST) 12시 이후 첫 실행이면 True — 15:00 실행이 하루 요약을 보낸다(놓친 날은 그다음 오후 실행)"""
    t = datetime.fromisoformat(run_at).astimezone(KST)
    if t.hour < 12:
        return False
    for ra in {r["run_at"] for r in rows}:
        if ra == run_at:
            continue
        o = datetime.fromisoformat(ra).astimezone(KST)
        if o.date() == t.date() and o.hour >= 12 and o < t:
            return False
    return True


def daily_message(run_rows, open_alerts):
    sources = [r for r in run_rows if r["kind"] != "publish"]
    failed = [r for r in sources if r["status"] == "FAIL"]
    pub = next((r for r in run_rows if r["kind"] == "publish"), None)
    published = pub.get("found") if pub else None
    return "\n".join([
        "📊 피카 수집 하루 요약",
        f"출처 {len(sources)}곳 · 실패 {len(failed)}곳 · 새 공개 {published if published is not None else '-'}건",
        f"켜진 경고 {len(open_alerts)}건",
        DASHBOARD,
    ])


# ---------- 4. 저장 ----------

def _read(db, name):
    got = db.supabase.table("ops_snapshots").select("data").eq("name", name).execute().data or []
    return (got[0]["data"] if got else None) or {}


def _write(db, name, data, now):
    db.supabase.table("ops_snapshots").upsert({"name": name, "data": data, "updated_at": now},
                                              on_conflict="name").execute()
    got = db.supabase.table("ops_snapshots").select("updated_at").eq("name", name).execute().data or []
    return bool(got) and got[0]["updated_at"][:19] == now[:19]


def record(db, new_rows, quiet=None, suffix="", now=None):
    """collector_runs 에 붙이고 판정해 collector_alerts 를 고친다. 결과 dict"""
    now = now or datetime.now(timezone.utc).isoformat()
    rules = load_rules()
    runs_name, alerts_name = f"collector_runs{suffix}", f"collector_alerts{suffix}"
    prev_rows = _read(db, runs_name).get("rows", [])
    run_ats = {r["run_at"] for r in new_rows}
    rows = keep_recent([r for r in new_rows] + [r for r in prev_rows if r["run_at"] not in run_ats])
    active = judge(rows, rules, quiet)
    alerts, opened, resolved = merge_alerts(_read(db, alerts_name).get("rows", []), active, now)
    ok_runs = _write(db, runs_name, {"rows": rows, "meta": [
        {"label": "보존", "value": f"최근 {KEEP_RUNS}회"},
        {"label": "원본", "value": "collector/logs/scheduled_*.log"}]}, now)
    ok_alerts = _write(db, alerts_name, {"rows": alerts, "meta": [
        {"label": "규칙", "value": "collector/rules/alerts.json"}]}, now)
    open_alerts = [a for a in alerts if not a.get("resolved_at")]
    return {"ok": ok_runs and ok_alerts, "rows": rows, "opened": opened, "resolved": resolved,
            "open": open_alerts, "runs": len({r["run_at"] for r in rows})}


def record_steps(db, run_at, step_lines, head="", keep=14, now=None):
    """routine_steps 스냅숏: 회차마다 단계별 한 줄(«• 이름: 내용»)을 남기고 최근 keep 회만 둔다 (specs/019 A6)"""
    now = now or datetime.now(timezone.utc).isoformat()
    steps = []
    for line in step_lines:
        line = (line or "").strip()
        if line.startswith("• "):
            line = line[2:]
        if not line:
            continue
        name, sep, text = line.partition(": ")
        steps.append({"name": name if sep else "", "text": text if sep else line})
    prev = _read(db, "routine_steps").get("rows", [])
    rows = ([{"run_at": run_at, "head": head, "steps": steps}] + [r for r in prev if r.get("run_at") != run_at])[:keep]
    return _write(db, "routine_steps", {"rows": rows, "meta": [{"label": "보존", "value": f"최근 {keep}회"}]}, now)


def summary_line(res):
    mark = "✅" if res["ok"] else "❌"
    return (f"{mark} 실행 기록 {res['runs']}회 보존 · 켜진 경고 {len(res['open'])}건"
            f" (새로 {len(res['opened'])}, 풀림 {len(res['resolved'])})")


# ---------- 손으로 쓰기 ----------

LOG_LINE = re.compile(r"^• (.+?): (.*)$")


def rows_from_log(path, blog_names=()):
    """logs/scheduled_YYYYMMDD_HHmm.log → 그 실행의 줄(정기 크롤링 완료 뒤 「• 이름: 요약」)"""
    m = re.search(r"scheduled_(\d{8})_(\d{4})\.log$", path)
    if not m:
        return []
    t = datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M").replace(tzinfo=KST)
    run_at = t.isoformat()
    text = open(path, encoding="utf-8-sig", errors="replace").read()
    if "정기 크롤링 완료" not in text:
        return []
    block = text.split("정기 크롤링 완료", 1)[1]
    results, publish_line = [], None
    for line in block.splitlines():
        lm = LOG_LINE.match(line.strip())
        if not lm:
            continue
        name, summary = lm.groups()
        if name == "자동 공개":
            publish_line = "• 자동 공개: " + summary
            continue
        if name in ("장소 좌표", "인스타 기록 백업", "대시보드 스냅숏", "인스타 게시 반영", "AI 추출") or "건너뜀" in line:
            continue
        status = "FAIL" if summary.startswith("❌") else "SUCCESS"
        results.append({"name": name, "status": status, "summary": summary})
    return to_rows(results, run_at, blog_names, publish_line)


def _blog_names():
    return {"김해시 블로그"}


def backfill(db):
    files = sorted(glob.glob(os.path.join(HERE, "logs", "scheduled_*.log")))
    rows = []
    for f in files:
        rows += rows_from_log(f, _blog_names())
    if not rows:
        print("❌ 읽을 수 있는 로그가 없습니다")
        return 1
    res = record(db, rows)
    print(f"로그 {len(files)}개에서 {len({r['run_at'] for r in rows})}회 · {len(rows)}줄")
    for a in res["open"]:
        print(f"  [{a['level']}] {a['text']}")
    print(summary_line(res))
    return 0 if res["ok"] else 1


def test_fail(db, source, send):
    import asyncio
    src = _read(db, "collector_runs").get("rows", [])
    if not src:
        print("❌ collector_runs 가 비어 있습니다. 먼저 --backfill")
        return 1
    latest = max(r["run_at"] for r in src)
    base = [dict(r) for r in src if r["run_at"] == latest]
    if not any(r["source"] == source for r in base):
        print(f"❌ 마지막 실행에 {source} 줄이 없습니다")
        return 1
    healthy = {"status": "SUCCESS", "found": 10, "new": 0, "dup": 10, "fail": 0,
               "expired_def": False, "note": f"✅ [시험] {source} 정상"}
    broken_row = {"status": "FAIL", "found": 0, "new": 0, "dup": 0, "fail": 0,
                  "expired_def": False, "note": f"❌ [시험] {source} 0건"}
    start = datetime.fromisoformat(latest) + timedelta(hours=1)

    def fake_run(i, broken):
        run_at = (start + timedelta(hours=i)).isoformat()
        return [{**r, "run_at": run_at, **((broken_row if broken else healthy) if r["source"] == source else {})}
                for r in base]

    # 시험 스냅숏(*_test)은 «마지막 실행 + 대상 출처 정상» 한 회로 시작한다. 진짜 기록은 건드리지 않는다
    seed_now = datetime.now(timezone.utc).isoformat()
    _write(db, "collector_runs_test", {"rows": fake_run(0, False), "meta": []}, seed_now)
    _write(db, "collector_alerts_test", {"rows": [], "meta": []}, seed_now)
    msgs = []
    for i, broken in enumerate((True, True, False), 1):
        rows = fake_run(i, broken)
        res = record(db, rows, suffix="_test", now=(datetime.now(timezone.utc) + timedelta(seconds=i)).isoformat())
        mine = lambda xs: [a["text"] for a in xs if a["target"] == source]
        print(f"{i}회째({'고장' if broken else '정상'}): 켜짐 {mine(res['opened'])} · 풀림 {mine(res['resolved'])}")
        msg = alert_message([a for a in res["opened"] if a["target"] == source],
                            [a for a in res["resolved"] if a["target"] == source], prefix="[시험] ")
        if msg:
            msgs.append(msg)
    if send:
        from notifier import TelegramNotifier
        n = TelegramNotifier()

        async def go():
            for m in msgs:
                await n.send_message(m)
        asyncio.run(go())
        print(f"텔레그램 {len(msgs)}통 보냄" if n.enabled else "텔레그램 설정 없음 — 보내지 않음")
    else:
        print(f"텔레그램으로 보낼 글 {len(msgs)}통 (--send 없음, 보내지 않음)")
    return 0


if __name__ == "__main__":
    os.chdir(HERE)
    sys.path.insert(0, HERE)
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    from database import Database
    if "--backfill" in sys.argv:
        sys.exit(backfill(Database()))
    if "--test-fail" in sys.argv:
        sys.exit(test_fail(Database(), sys.argv[sys.argv.index("--test-fail") + 1], "--send" in sys.argv))
    print(__doc__)
