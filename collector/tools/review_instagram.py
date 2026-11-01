"""인스타그램 행사 후보(raw_posts.status='REVIEW') 주간 검토.

1) 내보내기: python tools/review_instagram.py --export
   - 이미 공개된 행사와 같은 것(시작일 같고 제목 한쪽이 다른 쪽을 포함)은 DUPLICATE 로 정리한다
   - 남은 후보를 collector/review/instagram_<오늘>.json 으로 쓴다. 항목마다 decision 을 채운다
       publish : 공개. 공식 채널을 찾았으면 official_url 에 넣는다(없으면 게시물 주소로 공개 —
                 이 앱은 공식 채널에 없는 소규모 행사를 알리는 것이 목적이다)
       reject  : 행사가 아니거나 경남 밖이거나 날짜를 알 수 없음
       (빈칸)  : 다음 주에 다시 본다
     title·category·region·venue·start·end·time·price 는 고쳐 써도 된다(포스터만 있는 글은 날짜를 채운다)
2) 반영: python tools/review_instagram.py --apply collector/review/instagram_<날짜>.json [--dry-run]
   - publish: 내용 반영 → 포스터 업로드 → 링크·중복 검사 후 events 에 직접 넣는다(이미 끝난 행사도 넣는다.
              publish_verified 는 끝난 행사를 EXPIRED 로 돌리므로 거기에 맡기지 않는다)
   - reject : status REJECTED
"""
import asyncio
import hashlib
import json
import os
import re
import sys
from datetime import date, datetime, timezone

import aiohttp

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402
from utils import check_link, process_and_upload_image  # noqa: E402
from naver_blog_scraper import _norm  # noqa: E402
import publish_verified as pv  # noqa: E402

ISO = re.compile(r"^20\d\d-\d\d-\d\d$")
EDITABLE = ("title", "category", "region", "venue", "start", "end", "time", "price")


def export(db):
    rows = db.supabase.table("raw_posts").select("id,source_url,content,collected_at").eq("status", "REVIEW").execute().data
    published = {}
    all_events = db.supabase.table("events").select("title,venue,event_date_start,event_date_end").execute().data
    for ev in all_events:
        published.setdefault(ev["event_date_start"], []).append(_norm(ev["title"]))

    def maybe_dup(title, venue, start):
        """그날 열리는 기존 행사 중 장소 낱말이나 제목 낱말(3자 이상)이 겹치는 것. 제목 표기가 달라 위에서 못 거른 중복 표시용"""
        if not start:
            return ""
        generic = {"2025", "2026", "2027", "축제", "페스티벌", "공연", "행사", "전시", "특별한", "김해", "창원", "진주", "통영"}
        toks = lambda s: {t for t in re.findall(r"[가-힣A-Za-z0-9]{2,}", s or "") if t not in generic and not t.isdigit()}
        tt, vt = {t for t in toks(title) if len(t) >= 3}, toks(venue) - {"공연장소", "장소", "일원", "일대"}
        for ev in (e for e in all_events if e["event_date_start"] <= start <= (e["event_date_end"] or e["event_date_start"])):
            if (vt and vt & toks(ev["venue"])) or (tt & {t for t in toks(ev["title"]) if len(t) >= 3}):
                return ev["title"]
        return ""
    items, dup = [], 0
    for r in rows:
        c, a = r["content"], r["content"].get("ai_suggestion") or {}
        n = _norm(c.get("title"))
        if a.get("date_start") and any(n in p or p in n for p in published.get(a["date_start"], []) if p):
            db.supabase.table("raw_posts").update({"status": "DUPLICATE"}).eq("id", r["id"]).execute()
            dup += 1
            continue
        items.append({
            "id": r["id"], "decision": "", "official_url": "",
            "title": c.get("title", ""), "category": a.get("category", ""), "region": a.get("region", ""),
            "venue": a.get("venue", ""), "start": a.get("date_start", ""), "end": a.get("date_end", ""),
            "time": a.get("time", ""), "price": a.get("price", ""),
            "account": a.get("account"), "role": a.get("role"), "posted_at": a.get("posted_at"),
            "image_only": a.get("image_only", False), "post_url": r["source_url"],
            "maybe_dup_of": maybe_dup(c.get("title"), a.get("venue"), a.get("date_start")),
            "search_hint": f"{c.get('title', '')} {a.get('venue', '')} {(a.get('date_start') or '')[:7]}".strip(),
            "caption": (c.get("description") or "")[:600],
        })
    items.sort(key=lambda x: (x["start"] or "9999", x["account"] or ""))
    os.makedirs("review", exist_ok=True)
    path = os.path.join("review", f"instagram_{date.today().isoformat()}.json")
    json.dump(items, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"검토 대기 {len(rows)}건 → 기존 행사와 중복 {dup}건 정리, 검토할 것 {len(items)}건 "
          f"(포스터만 {sum(1 for i in items if i['image_only'])}건, 중복 의심 {sum(1 for i in items if i['maybe_dup_of'])}건)")
    print(f"파일: {os.path.abspath(path)}")
    # 탐색에서 역할을 못 가른 계정(보류). 관리자 페이지에서 역할을 정해 whitelist 에 넣거나 버린다
    try:
        maybe = json.load(open(os.path.join(".cache", "insta_discover.json"), encoding="utf-8")).get("maybe", {})
    except (OSError, ValueError):
        maybe = {}
    if maybe:
        print(f"\n역할 미분류 계정 {len(maybe)}개 (확인 후 관리자 › 출처관리에서 추가):")
        for h, d in maybe.items():
            print(f"  https://www.instagram.com/{h}/  {d}")


async def apply(db, path, dry):
    items = json.load(open(path, encoding="utf-8"))
    pub_ids, rej = [], 0
    for it in items:
        d = (it.get("decision") or "").strip().lower()
        if d == "reject":
            rej += 1
            if not dry:
                db.supabase.table("raw_posts").update({"status": "REJECTED"}).eq("id", it["id"]).execute()
            continue
        if d != "publish":
            continue
        if not (ISO.match(it.get("start") or "") and ISO.match(it.get("end") or "")):
            print(f"⚠️ 날짜 없음 — 건너뜀: {it['title']}")
            continue
        row = db.supabase.table("raw_posts").select("content").eq("id", it["id"]).execute().data
        if not row:
            continue
        c = row[0]["content"]
        a = c.setdefault("ai_suggestion", {})
        c["title"] = it["title"]
        for k_in, k_out in (("category", "category"), ("region", "region"), ("venue", "venue"), ("start", "date_start"),
                            ("end", "date_end"), ("time", "time"), ("price", "price")):
            a[k_out] = it.get(k_in, "")
        a["date_parsed"] = True
        a["evidence"] = (f"@{it.get('account')} 게시물 {it['post_url']}" +
                         (f" · 공식 채널 {it['official_url']}" if it.get("official_url") else " · 공식 채널 없음(게시물을 출처로 공개)"))
        # COLLECTED 로 두면 정기 공개가 먼저 집어 가거나 EXPIRED 로 돌린다. 이 도구가 바로 넣으므로 REVIEW 를 유지한다
        upd = {"content": c, "status": "REVIEW", "source_url": it.get("official_url") or it["post_url"]}
        if not dry and a.get("poster_url"):
            key = "ig_" + hashlib.sha1(it["id"].encode()).hexdigest()[:12]
            _, p_url, _ = await process_and_upload_image(db.supabase, a["poster_url"], key)
            if p_url:
                upd["image_urls"] = [p_url]
        if not dry:
            db.supabase.table("raw_posts").update(upd).eq("id", it["id"]).execute()
        pub_ids.append(it["id"])
    print(f"공개 대상 {len(pub_ids)}건, 반려 {rej}건")
    if not pub_ids or dry:
        return
    await publish_only(pub_ids)


async def publish_only(ids):
    """검토에서 공개로 정한 raw_posts 를 events 에 직접 넣는다.
    publish_verified 는 이미 끝난 행사를 EXPIRED 로 돌리지만, 사람이 검토해 공개로 정한 것은 끝났어도 넣는다
    (피드는 끝난 지 한 달 안의 행사를 따로 보여준다). 링크 확인과 제목+시작일 중복 검사는 publish_verified 와 같다."""
    db = Database()
    published = {(pv.norm(e["title"]), e["event_date_start"]) for e in
                 db.supabase.table("events").select("title,event_date_start").execute().data}
    done = dup = fail = 0
    async with aiohttp.ClientSession() as session:
        for rid in ids:
            r = db.supabase.table("raw_posts").select("*").eq("id", rid).execute().data
            if not r:
                continue
            r = r[0]
            a = r["content"].get("ai_suggestion") or {}
            if (pv.norm(r["content"]["title"]), a.get("date_start")) in published:
                db.supabase.table("raw_posts").update({"status": "DUPLICATE"}).eq("id", rid).execute()
                dup += 1
                continue
            ok, status, _ = await check_link(session, r["source_url"])
            if not ok:
                print(f"❌ 링크 열리지 않음 ({status}): {r['content']['title']} {r['source_url']}")
                fail += 1
                continue
            price = a.get("price", "")
            desc = "\n".join(p for p in [(r["content"].get("description") or "").strip(),
                                          f"일시: {a['time']}" if a.get("time") else "",
                                          f"관람료: {price}" if price else ""] if p)
            event = {
                "title": r["content"]["title"], "description": desc[:4000],
                "category": a.get("category") or "행사", "region": a.get("region") or "경남", "venue": a.get("venue") or "",
                "event_date_start": a["date_start"], "event_date_end": a["date_end"],
                "price_info": price, "is_free": "무료" in price,
                "poster_image_url": (r.get("image_urls") or [None])[0],
                "source": r["source"], "original_url": r["source_url"], "status": "PUBLISHED",
                "published_at": datetime.now(timezone.utc).isoformat(), "raw_post_id": rid,
            }
            res = db.supabase.table("events").insert(event).execute()
            if not res.data:
                fail += 1
                continue
            db.supabase.table("raw_posts").update({"status": "PUBLISHED"}).eq("id", rid).execute()
            published.add((pv.norm(event["title"]), event["event_date_start"]))
            done += 1
            print(f"✅ {event['event_date_start']}~{event['event_date_end']} {event['region']} {event['title']}")
    print(f"공개 {done}건, 이미 공개돼 중복 {dup}건, 실패 {fail}건")


if __name__ == "__main__":
    db = Database()
    if "--export" in sys.argv:
        export(db)
    elif "--apply" in sys.argv:
        asyncio.run(apply(db, sys.argv[sys.argv.index("--apply") + 1], "--dry-run" in sys.argv))
    else:
        print(__doc__)
