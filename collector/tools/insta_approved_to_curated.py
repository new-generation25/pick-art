"""허락받아 인스타에 올린 소규모 행사(facts id 가 dm- 로 시작)를 피카 앱 DB에 넣을 큐레이션 JSON 으로 만든다.

사용 (pick-art 폴더에서): python collector/tools/insta_approved_to_curated.py <out.json> [--since YYYY-MM-DD]
- 사실은 게시 때 쓴 facts(docs/insta/<날짜>/facts/*.json)에서만 가져온다(게시물과 같은 값).
- 끝난 행사(_end < 오늘)는 넣지 않는다. 날짜가 facts 에 없으면 dm.json event 의 「YYYY.M.D~M.D」를 읽고, 그래도 없으면 뺀다.
- 그다음: python collector/tools/add_curated.py <out.json>  →  python collector/tools/publish_verified.py <from> <to>
"""
import glob, json, os, re, sys, urllib.parse, urllib.request
from datetime import date

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "insta")


def dates_from_event(ev):
    m = re.search(r"(20\d\d)\.(\d{1,2})\.(\d{1,2})(?:\s*~\s*(?:(20\d\d)\.)?(\d{1,2})\.(\d{1,2}))?", ev or "")
    if not m:
        return None, None
    y, mo, d = int(m[1]), int(m[2]), int(m[3])
    s = date(y, mo, d)
    if m[5]:
        ey = int(m[4]) if m[4] else (y + 1 if int(m[5]) < mo else y)
        e = date(ey, int(m[5]), int(m[6]))
    else:
        e = s
    return s.isoformat(), e.isoformat()


def in_app(title, start):
    """피카 앱(events)에 같은 행사(〈〉 안 제목 포함 + 같은 시작일)가 이미 있으면 그 제목을 돌려준다."""
    env = dict(l.strip().split("=", 1) for l in open(os.path.join(BASE, "..", "..", "frontend", ".env.local"), encoding="utf-8")
               if "=" in l and not l.startswith("#"))
    url = next(v for k, v in env.items() if k.endswith("SUPABASE_URL")).strip('"')
    key = next(v for k, v in env.items() if "ANON" in k).strip('"')
    m = re.search(r"[〈<《]([^〉>》]+)[〉>》]", title)
    core = (m.group(1) if m else title).strip()
    q = f"{url}/rest/v1/events?select=title&event_date_start=eq.{start}&title=ilike.{urllib.parse.quote('*' + core + '*')}"
    req = urllib.request.Request(q, headers={"apikey": key, "Authorization": "Bearer " + key})
    hit = json.load(urllib.request.urlopen(req))
    return hit[0]["title"] if hit else None


def main():
    out = sys.argv[1]
    today = date.today().isoformat()
    dm = json.load(open(os.path.join(BASE, "dm.json"), encoding="utf-8"))
    by_url = {r.get("posted_url"): r for r in dm if r.get("posted_url")}
    posted = {r["event_id"]: r for r in json.load(open(os.path.join(BASE, "posted.json"), encoding="utf-8"))}
    rows, skipped = [], []
    for f in sorted(glob.glob(os.path.join(BASE, "*", "facts", "*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        fid = str(d.get("id", ""))
        if not fid.startswith("dm-") or fid not in posted:
            continue
        p = posted[fid]
        rec = by_url.get(p["post_url"]) or next(
            (r for r in dm if r.get("account") in (d.get("mentions") or []) and r.get("status") in ("yes", "posted")), {})
        start, end = d.get("_start"), d.get("_end")
        if not (start and end):
            start, end = dates_from_event(rec.get("event"))
        if not (start and end):
            skipped.append((fid, "날짜 없음")); continue
        if end < today:
            skipped.append((fid, f"끝남 {end}")); continue
        dup = in_app(d["title"], start)
        if dup:
            skipped.append((fid, f"앱에 이미 있음: {dup}")); continue
        kicker = (d.get("kicker") or "").split("·")
        region = d.get("_region") or kicker[0].strip()
        cat = "전시" if "전시" in (d.get("_cat") or d.get("kicker", "")) else "공연"
        val = lambda k: "" if d.get(k) in (None, "-") else d.get(k)
        rows.append({
            "title": d["title"], "category": cat, "region": region, "venue": val("venue"),
            "start": start, "end": end, "url": d.get("source_url"), "image": d.get("poster"),
            "time": val("time"), "price": val("price"),
            "description": re.sub(r"<[^>]+>", "", " ".join(d.get("what") or [])),
            "source": "인스타그램",
            "evidence": f"당사자 허락 {rec.get('account', '')}: {str(rec.get('reply', ''))[:120]} / 피카 게시물 {p['post_url']}",
        })
    json.dump(rows, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({"out": out, "rows": len(rows), "skipped": skipped}, ensure_ascii=False))


if __name__ == "__main__":
    main()
