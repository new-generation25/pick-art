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
from genre import classify, rules  # noqa: E402
import re  # noqa: E402

# 출처의 «전시 세부» 기본값 (문화정보 수집 세션 요청 2026-11-26, 사용자 승인): whitelist.score_detail 끝의 « · 전시세부:<갈래>(<근거>)»
# 전시이고 행사별 규칙으로 세부를 못 정한 행사에만 쓴다. «여러 갈래»·«검토 필요»·«기타»는 기본값으로 쓰지 않는다.
_TAIL = re.compile(r"전시세부:\s*(.+?)\s*\(")
_IG = re.compile(r"instagram\.com/([A-Za-z0-9._]+)/", re.I)


def source_defaults(sb):
    allowed = set(rules()["categories"]["전시"]["subs"]) - {"기타"}
    by_handle, by_name, off = {}, {}, 0
    while True:
        d = sb.table("whitelist").select("name,value,score_detail").range(off, off + 999).execute().data
        for w in d:
            tails = _TAIL.findall(w.get("score_detail") or "")
            sub = tails[-1].strip() if tails else None
            if sub not in allowed:
                continue
            m = _IG.search(w.get("value") or "")
            if m:
                by_handle[m.group(1).lower()] = (sub, "@" + m.group(1))
            by_name[(w.get("name") or "").strip()] = (sub, w.get("name"))
        if len(d) < 1000:
            return by_handle, by_name
        off += 1000


def raw_accounts(sb, ids):
    out = {}
    for i in range(0, len(ids), 100):
        for r in sb.table("raw_posts").select("id,source_url,content").in_("id", ids[i:i + 100]).execute().data:
            a = (r.get("content") or {}).get("ai_suggestion") or {}
            h = a.get("account") or ((_IG.search(r.get("source_url") or "") or [None, None])[1] if _IG.search(r.get("source_url") or "") else None)
            if h and h.lower() != "p":
                out[r["id"]] = h.lower().lstrip("@")
    return out

COLS = "id,title,category,description,status,source,raw_post_id,subcategory,subcategory_by,subcategory_pending,subcategory_evidence"


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

    by_handle, by_name = source_defaults(sb)
    accounts = raw_accounts(sb, [r["raw_post_id"] for r in rows if r.get("raw_post_id") and r.get("category") == "전시" and r.get("subcategory_by") != "admin"])
    stats = collections.defaultdict(collections.Counter)
    changes, sample_pool, pend = [], [], []
    for r in rows:
        # 운영자 값과, 다른 세션이 원문을 읽고 정한 값(evidence 「… Claude 판정: …」)은 덮어쓰지 않는다
        if r.get("subcategory_by") == "admin" or "Claude 판정" in (r.get("subcategory_evidence") or ""):
            stats[r["category"]]["운영자"] += 1
            continue
        cat, sub, by, ev, pending = classify(r)
        if cat == "전시" and not sub:
            hit = by_handle.get(accounts.get(r.get("raw_post_id"), "")) or by_name.get((r.get("source") or "").strip())
            if hit:
                sub, by, pending = hit[0], "rule", False
                ev = f"출처 기본값 {hit[1]} 전시세부:{hit[0]}"[:200]
                stats[cat]["출처"] += 1
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
    by_cat = " · ".join(f"{k} 확정{c['KOPIS'] + c['규칙'] + c['운영자']}/대기{c['대기']}" + (f"(출처 기본값 {c['출처']})" if c['출처'] else "") for k, c in sorted(stats.items(), key=lambda kv: -sum(kv[1].values())))
    print(f"세부 갈래{'(적용)' if a.apply else '(미리보기)'}: {total}건 중 확정 {decided}건({decided * 100 // max(total, 1)}%), "
          f"바뀜 {len(changes)}건 · {by_cat}")


if __name__ == "__main__":
    main()
