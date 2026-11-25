"""인스타 활동 기록(docs/insta/*.json)에서 필요한 줄만 꺼내고, 한 줄씩 더하는 도구.

에이전트가 기록 파일을 통째로 읽지 않게 하려고 만들었다(파일 합계가 매일 커진다).
여러 에이전트가 같은 계정·행사를 두 번 처리하지 않도록 「맡아 두기(claim)」도 여기서 한다.
출력은 모두 한 줄 JSON(ensure_ascii=False)이다. 실패하면 {"ok": false, "error": ...} 와 종료 코드 1.

사용 (collector 폴더에서, PYTHONIOENCODING=utf-8):
  python tools/insta_state.py summary                     오늘 숫자·남은 후보·허락 대기
  python tools/insta_state.py candidates --n 12           안 쓴 ok 후보(오늘 다른 에이전트가 맡은 계정 제외)
  python tools/insta_state.py recent-texts --days 7       지난 n일 피카가 쓴 댓글·답글 문장(되풀이 방지)
  python tools/insta_state.py approved                    허락(yes)받고 아직 안 올린 행사
  python tools/insta_state.py posted-ids                  올린 event_id 목록
  python tools/insta_state.py post-done <게시물 주소>       이미 댓글·허락 댓글을 달았거나 소개한 게시물인지(댓글 전에 부른다)
  python tools/insta_state.py standing                    상시 동의 계정, 상시 동의를 아직 안 물은 허락 계정
  python tools/insta_state.py find-ask @계정               알림에 뜬 답글이 어느 허락 댓글 건인지(게시물 다시 안 열기)
  python tools/insta_state.py liked-recently @계정         지난 7일 그 계정에 답례 좋아요를 했는지
  python tools/insta_state.py has-account candidates @계정 목록에 이미 있는지(feedback·engaged·dm·candidates)
  python tools/insta_state.py claim account @계정 --by 참여  오늘 이 계정을 맡는다(다른 에이전트가 맡았으면 실패)
  python tools/insta_state.py claim event <event_id> --by 게시
  python tools/insta_state.py add engaged '<json>'        한 줄 더하기(posted·engaged·dm·feedback·candidates·stats)
  python tools/insta_state.py add-many feedback '[...]'   여러 줄 한 번에 더하기(문제 있는 줄만 빠짐)
  python tools/insta_state.py liked-many @a @b ...        여러 계정의 7일 안 답례 좋아요 여부
  python tools/insta_state.py last-check [--set "11/24 2차"]  지난 반응 처리 시각(알림에서 이 뒤 것만 처리)
  python tools/insta_state.py mark-used @계정             candidates 의 used 를 오늘로
  python tools/insta_state.py update dm --match '{"account":"@x","post_url":"..."}' --set '{"status":"yes"}'

데이터 폴더는 기본 docs/insta. 시험할 때는 환경변수 INSTA_DIR 로 사본 폴더를 가리킨다.
"""
import argparse
import json
import os
import re
import sys
import tempfile
import time
from contextlib import contextmanager
from datetime import date, datetime, timedelta

BASE = os.environ.get("INSTA_DIR") or os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "docs", "insta"))
FILES = {"posted": "posted.json", "engaged": "engaged.json", "dm": "dm.json",
         "feedback": "feedback.json", "candidates": "candidates.json", "stats": "stats.json",
         "claims": "claims.json"}
# 더할 때 반드시 있어야 하는 칸
REQUIRED = {
    "posted": ["event_id", "title", "region", "posted_at", "post_url", "scale"],
    "engaged": ["date", "type", "account"],
    "dm": ["date", "account", "post_url", "event", "text", "status"],
    "feedback": ["date", "kind", "account", "detail"],
    "candidates": ["account", "name", "found", "from", "region", "scale", "role", "status"],
    "stats": ["date"],
}
# 각 파일의 들여쓰기(기존 모양 유지)
INDENT = {"feedback": 2}


def today() -> str:
    return date.today().isoformat()


def out(obj, code=0):
    print(json.dumps(obj, ensure_ascii=False))
    sys.exit(code)


def fail(msg):
    out({"ok": False, "error": msg}, 1)


def path(name):
    return os.path.join(BASE, FILES[name])


def load(name):
    p = path(name)
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def save(name, rows):
    p = path(name)
    fd, tmp = tempfile.mkstemp(dir=BASE, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=INDENT.get(name, 1))
        f.write("\n")
    os.replace(tmp, p)


@contextmanager
def lock():
    """오전·오후 회차가 겹쳐도 한 번에 한 쪽만 쓰게 한다."""
    lp = os.path.join(BASE, ".state.lock")
    for _ in range(100):
        try:
            fd = os.open(lp, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            break
        except FileExistsError:
            if time.time() - os.path.getmtime(lp) > 120:  # 2분 넘게 남은 잠금은 죽은 것
                os.remove(lp)
                continue
            time.sleep(0.2)
    else:
        fail("잠금 파일을 얻지 못함: " + lp)
    try:
        yield
    finally:
        os.close(fd)
        os.remove(lp)


def norm(acc: str) -> str:
    acc = (acc or "").strip()
    return acc if acc.startswith("@") or not acc else "@" + acc


def day_of(r) -> str:
    return str(r.get("date") or r.get("posted_at") or "")[:10]


def claims_today():
    return [c for c in load("claims") if c.get("date") == today()]


def accounts_acted_today():
    """오늘 이미 댓글·허락 댓글을 단 계정(한 계정 하루 1개 규칙)."""
    t = today()
    acted = {norm(r["account"]) for r in load("engaged") if r.get("date") == t and r.get("type") == "comment"}
    acted |= {norm(r["account"]) for r in load("dm") if r.get("date") == t}
    return acted


# ---------- 읽기 ----------

def cmd_summary(a):
    t = today()
    eng = load("engaged")
    dm = load("dm")
    cand = load("candidates")
    posted = load("posted")
    cnt = lambda typ: sum(1 for r in eng if r.get("date") == t and r.get("type") == typ)
    out({
        "date": t,
        # 순회공연은 회차마다 줄이 있고 게시물은 하나다 → 게시물 주소로 센다
        "posted_today": len({r.get("post_url") for r in posted if day_of(r) == t}),
        "posted_today_small": len({r.get("post_url") for r in posted if day_of(r) == t and r.get("scale") == "소규모"}),
        "follow_today": cnt("follow"), "comment_today": cnt("comment"),
        "like_back_today": cnt("like_back"), "reply_today": cnt("reply"),
        "ask_today": sum(1 for r in dm if r.get("date") == t and r.get("channel") == "comment"),
        "candidates_ok_unused": sum(1 for r in cand if r.get("status") == "ok" and not r.get("used")),
        "approved_unposted": len(_approved(dm)),
        "asks_waiting": sum(1 for r in dm if r.get("channel") == "comment" and r.get("status") == "sent"),
        "claims_today": len(claims_today()),
    })


def cmd_candidates(a):
    taken = {norm(c["key"]) for c in claims_today() if c.get("kind") == "account"} | accounts_acted_today()
    rows = [r for r in load("candidates")
            if r.get("status") == "ok" and not r.get("used") and norm(r["account"]) not in taken]
    keep = ["account", "name", "region", "role", "scale", "last_post", "from"]
    out({"n": len(rows[:a.n]), "left_after": max(0, len(rows) - a.n),
         "rows": [{k: r.get(k) for k in keep} for r in rows[:a.n]]})


def cmd_recent_texts(a):
    since = (date.today() - timedelta(days=a.days)).isoformat()
    texts = [r["text"] for r in load("engaged")
             if r.get("text") and day_of(r) >= since and r.get("type") in ("comment", "reply")]
    out({"since": since, "texts": sorted(set(texts))})


def _approved(dm):
    posted_ids = {r.get("event_id") for r in load("posted")}
    rows = []
    for r in dm:
        if r.get("status") == "yes" and not r.get("posted_url"):
            rows.append(r)
    return [r for r in rows if r.get("event_id") not in posted_ids or not r.get("event_id")]


def cmd_approved(a):
    keep = ["date", "account", "name", "post_url", "event", "reply", "channel"]
    out({"rows": [{k: r.get(k) for k in keep} for r in _approved(load("dm"))]})


def cmd_standing(a):
    """상시 동의(앞으로 올릴 소식까지 허락) 계정과, 아직 상시 동의를 묻지 않은 옛 허락 계정."""
    dm = load("dm")
    yes = [r for r in dm if r.get("status") in ("yes", "posted")]
    standing = sorted({norm(r["account"]) for r in yes if r.get("standing")})
    to_ask = sorted({norm(r["account"]) for r in yes if not r.get("standing") and not r.get("standing_asked")} - set(standing))
    out({"standing": standing, "to_ask": to_ask})


def _short(u):
    m = re.search(r"/(?:p|reel)/([A-Za-z0-9_-]+)", u or "")
    return m.group(1) if m else (u or "").rstrip("/")


def cmd_post_done(a):
    """이 게시물에 이미 댓글·허락 댓글을 달았거나, 그 행사를 이미 소개했으면 done=true (댓글 전에 부른다)."""
    k = _short(a.url)
    hits = [f"댓글 {r.get('date')}" for r in load("engaged")
            if r.get("type") in ("comment", "reply") and _short(r.get("post_url")) == k]
    hits += [f"허락 댓글/DM {r.get('date')} {r.get('status')}" for r in load("dm") if _short(r.get("post_url")) == k]
    hits += [f"소개함 {r.get('posted_at', '')[:10]}" for r in load("dm") if r.get("posted_url") and _short(r.get("post_url")) == k]
    out({"post": k, "done": bool(hits), "why": hits})


def cmd_posted_ids(a):
    out({"ids": [r["event_id"] for r in load("posted") if r.get("event_id")]})


def cmd_find_ask(a):
    """알림에 뜬 답글이 어느 허락 댓글에 대한 것인지 찾는다(게시물을 다시 열지 않기 위해)."""
    acc = norm(a.account)
    keep = ["date", "account", "post_url", "event", "status"]
    rows = [r for r in load("dm") if norm(r.get("account")) == acc]
    out({"account": acc, "rows": [{k: r.get(k) for k in keep} for r in rows]})



def cmd_liked_recently(a):
    acc = norm(a.account)
    since = (date.today() - timedelta(days=7)).isoformat()
    hits = [r for r in load("engaged") if norm(r.get("account")) == acc
            and r.get("type") == "like_back" and day_of(r) >= since]
    out({"account": acc, "liked_within_7d": bool(hits), "last": day_of(hits[-1]) if hits else None})


def cmd_has_account(a):
    acc = norm(a.account)
    out({"account": acc, "in": a.file, "exists": any(norm(r.get("account")) == acc for r in load(a.file))})


# ---------- 쓰기 ----------

def cmd_claim(a):
    key = norm(a.key) if a.kind == "account" else a.key
    with lock():
        rows = load("claims")
        rows = [c for c in rows if c.get("date", "") >= (date.today() - timedelta(days=14)).isoformat()]
        for c in rows:
            if c.get("date") == today() and c.get("kind") == a.kind and c.get("key") == key:
                if c.get("by") == a.by:
                    out({"ok": True, "already": True, "key": key})
                fail(f"{key} 는 오늘 「{c.get('by')}」 가 맡았다")
        if a.kind == "account" and key in accounts_acted_today():
            fail(f"{key} 에는 오늘 이미 댓글·허락 댓글을 달았다")
        if a.kind == "event" and key in {r.get("event_id") for r in load("posted")}:
            fail(f"{key} 는 이미 올린 행사다")
        rows.append({"date": today(), "kind": a.kind, "key": key, "by": a.by,
                     "at": datetime.now().strftime("%H:%M")})
        save("claims", rows)
    out({"ok": True, "key": key})


def _check_new(file, rec, rows):
    """더할 한 줄을 검사하고 고친다. 문제가 있으면 이유 문자열, 없으면 None."""
    if not isinstance(rec, dict):
        return "한 줄(객체)이 아니다"
    miss = [k for k in REQUIRED[file] if rec.get(k) in (None, "")]
    if miss:
        return f"빠진 칸: {miss}"
    if "account" in rec:
        rec["account"] = norm(rec["account"])
    if file in ("engaged", "dm", "feedback") and not rec.get("at"):
        rec["at"] = datetime.now().astimezone().isoformat(timespec="seconds")  # 리포트에 실제 시각이 나오게
    if file == "posted" and not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", str(rec["event_id"])):
        return "event_id 가 피카 DB 행사 번호(UUID)가 아니다 — 먼저 DB에 넣고 그 번호로 올린다"
    if file == "posted" and any(r.get("event_id") == rec["event_id"] for r in rows):
        return "이미 posted.json 에 있는 event_id"
    if file == "candidates" and any(norm(r.get("account")) == rec["account"] for r in rows):
        return "이미 후보 목록에 있는 계정"
    if file == "feedback" and any(r.get("account") == rec["account"] and r.get("kind") == rec["kind"]
                                  and r.get("detail") == rec["detail"] for r in rows):
        return "이미 적힌 반응"
    return None


def cmd_add(a):
    try:
        rec = json.loads(a.record)
    except json.JSONDecodeError as e:
        fail(f"JSON 이 아니다: {e}")
    with lock():
        rows = load(a.file)
        if a.file == "stats" and isinstance(rec, dict):
            rows = [r for r in rows if r.get("date") != rec.get("date")]  # 같은 날짜는 고친다
        err = _check_new(a.file, rec, rows)
        if err:
            fail(err)
        rows.append(rec)
        if a.file == "stats":
            rows.sort(key=lambda r: r["date"])
        save(a.file, rows)
    out({"ok": True, "file": a.file, "count": len(rows)})


def cmd_add_many(a):
    """여러 줄을 한 번에 더한다(JSON 배열). 문제 있는 줄만 빼고 나머지는 더한다."""
    try:
        recs = json.loads(a.records)
    except json.JSONDecodeError as e:
        fail(f"JSON 이 아니다: {e}")
    if not isinstance(recs, list):
        fail("JSON 배열이어야 한다")
    added, skipped = 0, []
    with lock():
        rows = load(a.file)
        for i, rec in enumerate(recs):
            err = _check_new(a.file, rec, rows)
            if err:
                skipped.append({"i": i, "why": err}); continue
            rows.append(rec); added += 1
        save(a.file, rows)
    out({"ok": True, "file": a.file, "added": added, "skipped": skipped})


def cmd_liked_many(a):
    """여러 계정의 7일 안 답례 좋아요 여부를 한 번에."""
    since = (date.today() - timedelta(days=7)).isoformat()
    done = {norm(r.get("account")) for r in load("engaged") if r.get("type") == "like_back" and day_of(r) >= since}
    out({norm(x): norm(x) in done for x in a.accounts})


def cmd_last_check(a):
    """지난 반응 처리 시각. --set 이면 지금으로 고친다. 알림에서 이 시각 이후 것만 처리한다."""
    p = os.path.join(BASE, "last_check.json")
    if a.set:
        with lock():
            with open(p, "w", encoding="utf-8") as f:
                json.dump({"at": datetime.now().astimezone().isoformat(timespec="seconds"), "by": a.set}, f, ensure_ascii=False)
    out(json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {"at": None})


def cmd_mark_used(a):
    acc = norm(a.account)
    with lock():
        rows = load("candidates")
        hit = [r for r in rows if norm(r.get("account")) == acc]
        if not hit:
            fail(f"{acc} 는 후보 목록에 없다")
        for r in hit:
            r["used"] = today()
        save("candidates", rows)
    out({"ok": True, "account": acc})


def cmd_update(a):
    match = json.loads(a.match)
    sets = json.loads(a.set)
    if "account" in match:
        match["account"] = norm(match["account"])
    with lock():
        rows = load(a.file)
        hit = [r for r in rows if all((norm(r.get(k)) if k == "account" else r.get(k)) == v
                                      for k, v in match.items())]
        if len(hit) != 1:
            fail(f"맞는 줄이 {len(hit)}개다(1개여야 고친다)")
        hit[0].update(sets)
        save(a.file, rows)
    out({"ok": True, "file": a.file, "row": hit[0]})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("summary").set_defaults(f=cmd_summary)
    p = sub.add_parser("candidates"); p.add_argument("--n", type=int, default=12); p.set_defaults(f=cmd_candidates)
    p = sub.add_parser("recent-texts"); p.add_argument("--days", type=int, default=7); p.set_defaults(f=cmd_recent_texts)
    sub.add_parser("approved").set_defaults(f=cmd_approved)
    sub.add_parser("posted-ids").set_defaults(f=cmd_posted_ids)
    sub.add_parser("standing").set_defaults(f=cmd_standing)
    p = sub.add_parser("post-done"); p.add_argument("url"); p.set_defaults(f=cmd_post_done)
    p = sub.add_parser("find-ask"); p.add_argument("account"); p.set_defaults(f=cmd_find_ask)
    p = sub.add_parser("liked-recently"); p.add_argument("account"); p.set_defaults(f=cmd_liked_recently)
    p = sub.add_parser("liked-many"); p.add_argument("accounts", nargs="+"); p.set_defaults(f=cmd_liked_many)
    p = sub.add_parser("add-many"); p.add_argument("file", choices=list(REQUIRED)); p.add_argument("records")
    p.set_defaults(f=cmd_add_many)
    p = sub.add_parser("last-check"); p.add_argument("--set", help="처리한 회차 이름(예: 11/24 2차)"); p.set_defaults(f=cmd_last_check)
    p = sub.add_parser("has-account"); p.add_argument("file", choices=["candidates", "engaged", "dm", "feedback"])
    p.add_argument("account"); p.set_defaults(f=cmd_has_account)
    p = sub.add_parser("claim"); p.add_argument("kind", choices=["account", "event"]); p.add_argument("key")
    p.add_argument("--by", required=True); p.set_defaults(f=cmd_claim)
    p = sub.add_parser("add"); p.add_argument("file", choices=list(REQUIRED)); p.add_argument("record")
    p.set_defaults(f=cmd_add)
    p = sub.add_parser("mark-used"); p.add_argument("account"); p.set_defaults(f=cmd_mark_used)
    p = sub.add_parser("update"); p.add_argument("file", choices=["dm", "engaged", "candidates", "posted"])
    p.add_argument("--match", required=True); p.add_argument("--set", required=True); p.set_defaults(f=cmd_update)
    a = ap.parse_args()
    if not os.path.isdir(BASE):
        fail("데이터 폴더 없음: " + BASE)
    a.f(a)


if __name__ == "__main__":
    main()
