"""공개 후 중복 점검 (2026-11-26, 사용자 «중복데이터가 없도록 검수절차 더 보완»).

공개 검증(publish_verified)은 새로 공개할 행만 이미 공개된 행과 견준다. 공개 순서가 엇갈리면(두 출처가 같은 회차에
들어오거나, 지역 표기가 달라 못 알아본 경우) 같은 행사가 둘 다 공개된다(11/26 김해 「더 드레서」, 함안 「라 트라비아타」).
이 도구는 PUBLISHED 행 전체를 (시작일, 지역)으로 묶어 서로 비교하고, 같은 행사면 남길 순위(dedupe.keep_rank: KOPIS 먼저)가
낮은 쪽을 백업한 뒤 숨긴다(status='HIDDEN', tools/hide_events.py 와 같은 값). 묶음 축제와 일자별 공연은 중복으로 보지 않는다.

쓰기는 collector/.env.local 의 service 키. 백업: collector/logs/dedupe/hidden_<시각>.json (되돌리기: hide_events.py restore --backup …)
사용(collector 폴더에서, 마지막 줄이 한 줄 요약):
  python tools/dedupe_published.py            미리보기(의심 쌍과 숨길 쪽)
  python tools/dedupe_published.py --apply    숨기기
"""
import argparse
import itertools
import json
import os
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402
from dedupe import keep_rank, same_event  # noqa: E402

COLS = "id,title,source,region,venue,event_date_start,event_date_end,status,original_url,created_at"


def published(sb):
    out, off = [], 0
    while True:
        d = sb.table("events").select(COLS).eq("status", "PUBLISHED").order("id").range(off, off + 999).execute().data
        out += d
        if len(d) < 1000:
            return out
        off += 1000


def find_dupes(rows):
    """→ [(남길 행, 숨길 행)]. 한 묶음 안에서 같은 행사끼리 모아 가장 순위 높은 하나만 남긴다"""
    groups = {}
    for r in rows:
        groups.setdefault((r.get("event_date_start"), r.get("region")), []).append(r)
    pairs, hidden = [], set()
    for grp in groups.values():
        if len(grp) < 2:
            continue
        grp = sorted(grp, key=lambda r: (keep_rank(r), r.get("created_at") or ""))
        for a, b in itertools.combinations(grp, 2):
            if a["id"] in hidden or b["id"] in hidden:
                continue
            if same_event(a, b):
                pairs.append((a, b))  # a 가 순위가 높다(정렬 순서)
                hidden.add(b["id"])
    return pairs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    sb = Database().supabase
    rows = published(sb)
    pairs = find_dupes(rows)
    for keep, drop in pairs:
        print(f"  중복: 남김 [{keep['source']}] {keep['title'][:40]} ← 숨김 [{drop['source']}] {drop['title'][:40]} "
              f"({drop['event_date_start']} {drop.get('region')})")
    if a.apply and pairs:
        os.makedirs(os.path.join("logs", "dedupe"), exist_ok=True)
        path = os.path.join("logs", "dedupe", f"hidden_{datetime.now().strftime('%Y-%m-%d_%H%M%S')}.json")
        backup = {"at": datetime.now().astimezone().isoformat(timespec="seconds"),
                  "why": "공개 후 중복 점검(tools/dedupe_published.py)", "new_status": "HIDDEN",
                  "rows": [d for _, d in pairs], "kept": [{"id": k["id"], "title": k["title"]} for k, _ in pairs]}
        with open(path, "w", encoding="utf-8") as f:
            json.dump(backup, f, ensure_ascii=False, indent=1)
        for _, d in pairs:
            sb.table("events").update({"status": "HIDDEN"}).eq("id", d["id"]).execute()
        print(f"  백업: {path}")
    print(f"공개 후 중복 점검{'(적용)' if a.apply else '(미리보기)'}: 공개 {len(rows)}건 중 중복 {len(pairs)}쌍"
          f"{' → 숨김 ' + str(len(pairs)) + '건' if a.apply and pairs else ''}")


if __name__ == "__main__":
    main()
