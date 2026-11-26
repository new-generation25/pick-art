"""공개·검토 행사의 세부 갈래를 판정해 events.subcategory* 에 적는다 (specs/015).

운영자가 정한 값(subcategory_by='admin')은 건드리지 않는다. 상영회로 옮겨야 하는 공연·전시는 category 도 «행사»로 바꾼다.
쓰기는 collector/.env.local 의 service 키로 한다. 키는 출력하지 않는다.
사용(collector 폴더에서, 마지막 줄이 한 줄 요약):
  python tools/classify_genre.py              미리보기(대분류별 확정·대기 수)
  python tools/classify_genre.py --apply      적용
  python tools/classify_genre.py --sample 30  규칙 확정 표본(제목 · 세부 · 근거)
  python tools/classify_genre.py --pending    판정 대기 목록
"""
import argparse
import collections
import os
import random
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402
from genre import classify  # noqa: E402

COLS = "id,title,category,description,status,subcategory,subcategory_by,subcategory_pending,subcategory_evidence"


def all_rows(sb):
    out, off = [], 0
    while True:
        d = (sb.table("events").select(COLS).in_("status", ["PUBLISHED", "REVIEW"])
             .order("id").range(off, off + 999).execute().data)
        out += d
        if len(d) < 1000:
            return out
        off += 1000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--sample", type=int, default=0)
    ap.add_argument("--pending", action="store_true")
    a = ap.parse_args()
    sb = Database().supabase
    rows = all_rows(sb)

    stats = collections.defaultdict(collections.Counter)
    changes, sample_pool, pend = [], [], []
    for r in rows:
        if r.get("subcategory_by") == "admin":
            stats[r["category"]]["운영자"] += 1
            continue
        cat, sub, by, ev, pending = classify(r)
        stats[cat]["대기" if pending else ("KOPIS" if by == "kopis" else ("규칙" if sub else "세부 없음"))] += 1
        if by == "rule":
            sample_pool.append((r["title"], cat, sub, ev))
        if pending:
            pend.append((r["title"], cat, ev))
        new = {"category": cat, "subcategory": sub, "subcategory_by": by, "subcategory_pending": pending, "subcategory_evidence": ev or None}
        old = {k: r.get(k) for k in new}
        if new != old:
            changes.append((r["id"], new))

    if a.sample:
        random.seed(15)
        for t, cat, sub, ev in random.sample(sample_pool, min(a.sample, len(sample_pool))):
            print(f"{cat} › {sub} | {t[:50]} | {ev}")
    if a.pending:
        for t, cat, ev in pend:
            print(f"{cat} | {t[:50]} | {ev}")

    if a.apply:
        for i, (eid, new) in enumerate(changes):
            sb.table("events").update(new).eq("id", eid).execute()
    total = sum(sum(c.values()) for c in stats.values())
    decided = sum(c["KOPIS"] + c["규칙"] + c["운영자"] for c in stats.values())
    by_cat = " · ".join(f"{k} 확정{c['KOPIS'] + c['규칙'] + c['운영자']}/대기{c['대기']}" for k, c in sorted(stats.items(), key=lambda kv: -sum(kv[1].values())))
    print(f"세부 갈래{'(적용)' if a.apply else '(미리보기)'}: {total}건 중 확정 {decided}건({decided * 100 // max(total, 1)}%), "
          f"바뀜 {len(changes)}건 · {by_cat}")


if __name__ == "__main__":
    main()
