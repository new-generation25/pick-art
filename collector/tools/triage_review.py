"""인스타 후보(raw_posts.status='REVIEW') 정리: 끝난 것·이미 공개된 것은 상태를 바꾸고, 남은 것에는 무더기를 단다.

계약: specs/003-ops-automation/contracts/review-triage.md
규칙(위에서부터 처음 맞는 것)
  1. 끝나는 날(없으면 시작일) < 오늘(KST)             → status EXPIRED      review_reason ended
  2. 공개된 행사와 같음(시작일 같고 제목 한쪽이 다른 쪽을 포함,
     review_instagram.py --export 와 같은 판정)        → status DUPLICATE    review_reason published_same
  3. role artist·group                                 → bucket consent      small_needs_consent
     단, 출처 계정이 상시 동의(whitelist.score_detail 「상시동의:」 꼬리, 철회 계정 제외)이고 날짜가 있으면
                                                        → bucket candidate    standing_consent (review_note «상시 동의 @계정»)
     (2026-11-26 사용자 «앞으로의 정보제공 항목에 동의 체크해놔». 이미 small_needs_consent 로 동의 필요에 간 줄도 옮긴다)
  4. role official + 날짜 + 장소                        → bucket candidate    official_complete
  5. 그 밖                                             → bucket human        informant · no_date · image_only · no_venue
  이미 review_bucket 이 있는 줄은 1·2만 다시 본다(사람이 바꾼 무더기를 덮어쓰지 않는다). 지우지 않는다.

사용 (collector 폴더에서. 마지막 줄이 한 줄 요약)
  python tools/triage_review.py --dry-run          바꾸지 않고 logs/triage/triage_<날짜>.json 에 줄마다 {id,title,rule,result}
  python tools/triage_review.py --apply            적용. 바꾼 줄을 logs/triage/applied_<날짜시각>.json 에 남긴다
  python tools/triage_review.py --undo <목록 파일>  그 적용에서 바꾼 줄을 이전 상태·무더기로 되돌린다(그사이 바뀐 줄은 건너뜀)
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from naver_blog_scraper import _norm  # noqa: E402  review_instagram.py 의 중복 판정이 쓰는 제목 정리

KST = timezone(timedelta(hours=9))
ISO = re.compile(r"^20\d\d-\d\d-\d\d$")
LOG_DIR = os.path.join(HERE, "logs", "triage")
PAGE = 1000
# 장소 칸에 장소 대신 들어간 빈 이름표(추출이 칸 이름만 가져온 것)는 장소 없음으로 본다
VENUE_PLACEHOLDERS = {"공연장소", "장소", "행사장소", "전시장소", "미정", "장소미정", "추후공지", "추후안내"}
LABEL = {"EXPIRED": "만료", "DUPLICATE": "중복", "consent": "동의 필요", "candidate": "공개 후보", "human": "사람 판단"}


# ---------- DB 읽기·쓰기 (테스트에서는 같은 메서드를 가진 가짜로 바꾼다) ----------

class Store:
    def __init__(self, db):
        self.sb = db.supabase

    def _all(self, q):
        rows, start = [], 0
        while True:
            page = q.range(start, start + PAGE - 1).execute().data or []
            rows += page
            if len(page) < PAGE:
                return rows
            start += PAGE

    def review_rows(self):
        return self._all(self.sb.table("raw_posts").select("id,status,content").eq("status", "REVIEW").order("id"))

    def events(self):
        return self._all(self.sb.table("events").select("id,title,event_date_start").order("id"))

    def standing_accounts(self):
        """상시 동의 계정(@계정 소문자). whitelist.consent='standing'(없으면 score_detail 「상시동의:」 꼬리)인 인스타 출처
        − 철회 계정(whitelist.consent='withdrawn' 은 위에서 빠진다, docs/insta/dm.json withdrawn)"""
        out = set()
        for w in self._all(self.sb.table("whitelist").select("value,score_detail,consent").order("id")):
            consent = w.get("consent") or "none"
            # 동의 칸(specs/019 A5)이 기준이다. 칸이 «없음»인데 예전 글자 표시가 있으면 그것도 상시 동의로 본다
            if consent == "standing" or (consent == "none" and "상시동의:" in (w.get("score_detail") or "")):
                m = re.search(r"instagram\.com/([A-Za-z0-9._]+)", w.get("value") or "", re.I)
                if m:
                    out.add("@" + m.group(1).lower())
        dm_path = os.path.join(HERE, "..", "docs", "insta", "dm.json")
        if os.path.exists(dm_path):
            for r in json.load(open(dm_path, encoding="utf-8")):
                if r.get("withdrawn"):
                    out.discard(acc_key(r.get("account")))
        return out

    def get(self, rid):
        d = self.sb.table("raw_posts").select("id,status,content").eq("id", rid).execute().data
        return d[0] if d else None

    def update(self, rid, expect_status, status, content):
        """expect_status 인 줄만 바꾼다(그사이 다른 세션이 상태를 바꿨으면 건드리지 않는다). 바뀌었으면 True."""
        res = (self.sb.table("raw_posts").update({"status": status, "content": content})
               .eq("id", rid).eq("status", expect_status).execute())
        return bool(res.data)


# ---------- 판정 ----------

def iso(v):
    return v if isinstance(v, str) and ISO.match(v) else ""


def truthy(v):
    return v is True or (isinstance(v, str) and v.strip().lower() in ("true", "1", "yes"))


def published_index(events):
    """시작일 → 정리한 제목들. review_instagram.export 의 published 와 같은 모양"""
    by_day = {}
    for ev in events:
        if ev.get("event_date_start"):
            by_day.setdefault(ev["event_date_start"], []).append((_norm(ev.get("title")), ev.get("title") or ""))
    return by_day


def same_as_published(title, start, by_day):
    """review_instagram.export 의 판정: 시작일이 같고 정리한 제목 한쪽이 다른 쪽을 포함.
    다른 점 하나: 이 줄의 제목이 비면(정리 후 빈 글자) 무엇에나 포함되므로 중복으로 보지 않는다.
    같으면 맞은 행사 제목, 아니면 ''"""
    n = _norm(title)
    if not start or not n:
        return ""
    for p, raw in by_day.get(start, ()):
        if p and (n in p or p in n):
            return raw or p
    return ""


def acc_key(v):
    """계정 비교용: @ 붙이고 소문자"""
    v = (v or "").strip().lower()
    return v if not v or v.startswith("@") else "@" + v


def classify(row, today, by_day, standing=frozenset()):
    """한 줄 판정 → dict(rule, result, status, bucket, dup_of). result 가 None 이면 바꾸지 않는다."""
    c = row.get("content") or {}
    a = c.get("ai_suggestion") or {}
    start, end = iso(a.get("date_start")), iso(a.get("date_end"))
    last = end or start
    if last and last < today:
        return {"rule": "ended", "result": "EXPIRED", "status": "EXPIRED", "bucket": None}
    dup = same_as_published(c.get("title"), start, by_day)
    if dup:
        return {"rule": "published_same", "result": "DUPLICATE", "status": "DUPLICATE", "bucket": None, "dup_of": dup}
    account = acc_key(a.get("account"))
    moved_by_rule = c.get("review_bucket") == "consent" and c.get("review_reason") == "small_needs_consent"
    if c.get("review_bucket") and not (moved_by_rule and account in standing and start):
        # 이미 무더기가 있으면(사람이 바꿨을 수 있음) 그대로 둔다. 규칙이 «동의 필요»로 보냈는데 상시 동의 계정이면 다시 본다
        return {"rule": "kept", "result": None, "status": "REVIEW", "bucket": c["review_bucket"]}
    role = (a.get("role") or "").strip().lower()
    venue = (a.get("venue") or "").strip()
    has_venue = bool(venue) and venue.replace(" ", "") not in VENUE_PLACEHOLDERS
    if role in ("artist", "group") and account in standing and start:
        return {"rule": "standing_consent", "result": "candidate", "status": "REVIEW", "bucket": "candidate",
                "note": f"상시 동의 {account}"}
    if role in ("artist", "group"):
        rule, bucket = "small_needs_consent", "consent"
    elif role == "official" and start and has_venue:
        rule, bucket = "official_complete", "candidate"
    else:
        bucket = "human"
        if role == "informant":
            rule = "informant"
        elif not start:
            rule = "no_date"
        elif truthy(a.get("image_only")):
            rule = "image_only"
        elif role == "official":
            rule = "no_venue"  # 계약 표에 없는 경우: 기관 계정 + 날짜 있음 + 장소 없음
        else:
            rule = "no_role"   # 계약 표에 없는 경우: 역할을 모르는 계정
    return {"rule": rule, "result": bucket, "status": "REVIEW", "bucket": bucket}


def plan(rows, events, today, standing=frozenset()):
    by_day = published_index(events)
    out = []
    for r in rows:
        d = classify(r, today, by_day, standing)
        d.update(id=r["id"], title=(r.get("content") or {}).get("title") or "", row=r)
        out.append(d)
    return out


# ---------- 요약 ----------

def summary(decisions):
    n = {k: 0 for k in LABEL}
    left = 0
    for d in decisions:
        if d["status"] in ("EXPIRED", "DUPLICATE"):
            n[d["status"]] += 1
        else:
            left += 1
            if d["bucket"] in n:
                n[d["bucket"]] += 1
    return (f"✅ REVIEW 정리: 만료 {n['EXPIRED']} · 중복 {n['DUPLICATE']} · 동의 필요 {n['consent']} · "
            f"공개 후보 {n['candidate']} · 사람 판단 {n['human']} (남은 REVIEW {left})")


def counts_by_rule(decisions):
    out = {}
    for d in decisions:
        out[d["rule"]] = out.get(d["rule"], 0) + 1
    return out


def dump_lines(path, items):
    """JSON 배열이되 한 줄에 한 항목(운영자가 줄 단위로 읽고 grep 할 수 있게)"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("[\n")
        f.write(",\n".join(json.dumps(i, ensure_ascii=False) for i in items))
        f.write("\n]\n")


# ---------- 실행 ----------

def dry_run(store, today, log_dir=LOG_DIR):
    decisions = plan(store.review_rows(), store.events(), today, getattr(store, "standing_accounts", lambda: set())())
    items = []
    for d in decisions:
        it = {"id": d["id"], "title": d["title"], "rule": d["rule"], "result": d["result"] or "kept"}
        if d.get("dup_of"):
            it["dup_of"] = d["dup_of"]
        items.append(it)
    path = os.path.join(log_dir, f"triage_{today}.json")
    dump_lines(path, items)
    return decisions, path


def new_content(row, d, now):
    c = json.loads(json.dumps(row.get("content") or {}))  # 깊은 복사
    c["review_reason"] = d["rule"]
    if d.get("note"):
        c["review_note"] = d["note"]
    if d["bucket"]:
        c["review_bucket"] = d["bucket"]
        c["review_bucket_at"] = now
    return c


def apply(store, today, now=None, log_dir=LOG_DIR):
    now = now or datetime.now(KST)
    decisions = plan(store.review_rows(), store.events(), today, getattr(store, "standing_accounts", lambda: set())())
    path = os.path.join(log_dir, f"applied_{now.strftime('%Y-%m-%d_%H%M%S')}.json")
    done, failed = [], 0
    try:
        for d in decisions:
            if d["result"] is None:
                continue
            row = d["row"]
            c0 = row.get("content") or {}
            c1 = new_content(row, d, now.isoformat())
            if store.update(d["id"], "REVIEW", d["status"], c1):
                # new_bucket 은 실제로 남은 값: EXPIRED·DUPLICATE 로 바꾼 줄은 원래 무더기를 건드리지 않는다
                done.append({"id": d["id"], "prev_status": row.get("status") or "REVIEW",
                             "prev_bucket": c0.get("review_bucket"), "new_status": d["status"],
                             "new_bucket": c1.get("review_bucket"), "prev_reason": c0.get("review_reason"),
                             "new_reason": d["rule"], "prev_note": c0.get("review_note"),
                             "prev_bucket_at": c0.get("review_bucket_at")})
            else:
                failed += 1
                d["status"], d["bucket"] = "REVIEW", c0.get("review_bucket")  # 요약에는 바뀌지 않은 대로
    finally:
        if done:
            dump_lines(path, done)  # 중간에 멈춰도 바꾼 줄까지는 되돌릴 수 있게 항상 남긴다
    return decisions, (path if done else ""), failed


def undo(store, path):
    with open(path, encoding="utf-8") as f:
        items = json.load(f)
    back = skipped = gone = 0
    for it in items:
        cur = store.get(it["id"])
        if not cur:
            gone += 1
            continue
        c = json.loads(json.dumps(cur.get("content") or {}))
        if cur.get("status") != it["new_status"] or c.get("review_bucket") != it.get("new_bucket") \
                or ("new_reason" in it and c.get("review_reason") != it["new_reason"]):
            skipped += 1  # 그사이 사람이나 다른 도구가 바꾼 줄
            continue
        for key, prev in (("review_bucket", it.get("prev_bucket")), ("review_reason", it.get("prev_reason")),
                          ("review_note", it.get("prev_note"))):
            if prev is None:
                c.pop(key, None)
            else:
                c[key] = prev
        if it.get("prev_bucket") is None:
            c.pop("review_bucket_at", None)
        elif it.get("prev_bucket_at"):
            c["review_bucket_at"] = it["prev_bucket_at"]
        if store.update(it["id"], it["new_status"], it["prev_status"], c):
            back += 1
        else:
            skipped += 1
    return back, skipped, gone


def main(argv):
    today = datetime.now(KST).date().isoformat()
    if "--undo" in argv:
        i = argv.index("--undo")
        if i + 1 >= len(argv):
            print("❌ --undo 뒤에 applied_*.json 경로가 필요합니다")
            return 2
        from database import Database
        back, skipped, gone = undo(Store(Database()), argv[i + 1])
        print(f"✅ REVIEW 정리 되돌림: {back}건 복원 · 그사이 바뀌어 건너뜀 {skipped}건 · 없어진 줄 {gone}건")
        return 0
    if "--apply" not in argv and "--dry-run" not in argv:
        print(__doc__)
        return 2
    from database import Database
    store = Store(Database())
    if "--apply" in argv:
        decisions, path, failed = apply(store, today)
        print(f"규칙별: {json.dumps(counts_by_rule(decisions), ensure_ascii=False)}")
        if failed:
            print(f"⚠️ 그사이 상태가 바뀌어 건너뜀 {failed}건")
        print(f"되돌리기 목록: {path or '(바꾼 줄 없음)'}")
    else:
        decisions, path = dry_run(store, today)
        print(f"규칙별: {json.dumps(counts_by_rule(decisions), ensure_ascii=False)}")
        print(f"dry-run 표: {path}  (DB 는 바꾸지 않음)")
    print(summary(decisions))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
