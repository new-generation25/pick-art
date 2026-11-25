"""검증을 통과한 raw_posts 를 events 로 발행한다(관리자 인박스 승인과 같은 결과).

사용: python tools/publish_verified.py 2026-11-01 2026-11-30 [--dry-run] [--ids <raw id,...>] [--curated <큐레이션 json>]
  --ids / --curated 를 주면 그 수집분만 발행한다(다른 수집분은 건드리지 않는다)
  --ids 에는 관리자 인박스 «공개 후보»에서 승인한 인스타 후보(status='REVIEW' + content.publish_approved_at)도
  넣을 수 있다(specs/003 R2). 승인 없는 REVIEW 는 --ids 에 있어도 건너뛴다. 검증이 실패한 승인 후보는
  REVIEW 로 두고 content.review_reason·publish_failed_at 을 남긴다(승인은 그대로라 다음 실행에서 다시 본다).
  끝난 것은 EXPIRED, 이미 공개된 것은 DUPLICATE 로 바꾸는 것은 다른 수집분과 같다.
검증 기준
  1. 날짜: date_start/date_end 가 YYYY-MM-DD 이고 기간이 [from, to] 와 겹친다
  2. 링크: source_url 이 지금 실제로 열린다(HTTP < 400)
  3. 중복: 제목(괄호·공백·[지역] 표기 제거)과 시작일이 같은 건은 하나만 발행한다.
     우선순위 KOPIS(가격·시간·예매처) > 기관 공식 게시판 > 큐레이션. 나머지는 raw_posts.status='DUPLICATE'
  4. 이미 공개된 행사(events, 숨긴 행 포함): 위 제목+시작일이 같거나, 2026-11-26 보강 — 느슨한 제목
     (대괄호 [지역]·연극/뮤지컬 접두·〈〉<> 기호·공백·연도 제거, ×→x)이 같거나 서로 포함 관계이고 시작일·지역이 같으면 중복으로 본다
     (예: KOPIS 「더 드레서 [진주]」 ↔ 기관 「연극 <더 드레서>」). 순회공연은 날짜·지역이 달라 걸리지 않는다.
발행한 raw_posts 는 status='PUBLISHED' 로 바꾼다. 결과 목록을 JSON으로 남긴다.
"""
import asyncio
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

import aiohttp

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402
from utils import check_link, process_and_upload_image  # noqa: E402

ISO = re.compile(r"^20\d\d-\d\d-\d\d$")
OUT_DIR = os.path.join("..", "docs")  # 결과 목록 JSON 자리(테스트는 임시 폴더로 바꾼다)


def norm(title: str) -> str:
    """중복 판정용 제목: [지역]·(괄호) 안을 빼고 한글·영문·숫자만 남긴다.
    출처마다 기호가 달라도(쉼표·×·⨉·＜＞·〈〉 등) 같은 제목으로 본다(2026-11-26 「콘서트누리, 플라워」 vs 「콘서트누리 ⨉ 플라워」)."""
    t = re.sub(r"\[[^\]]*\]|\([^)]*\)", "", title or "").lower()
    t = re.sub(r"[×⨉✕]", "x", t)
    t = re.sub(r"(?<=\s)x(?=\s)", " ", t)  # 「A x B」「A × B」처럼 띄어 쓴 x 는 기호로 본다
    return re.sub(r"[^0-9a-z가-힣]", "", t)


def loose(title: str) -> str:
    """이미 공개된 행사와 견줄 느슨한 제목: [지역]·연극/뮤지컬 접두·〈〉<> 기호·공백을 뺀다(norm 위에).
    덧붙여 연도(2026 등)를 빼고 ×를 x로 본다(11/26 중복 「한화클래식 2026: …」 「A × B」)."""
    t = re.sub(r"\[[^\]]*\]", " ", title or "").strip()
    t = re.sub(r"^(연극|뮤지컬)\s*", "", t)
    t = re.sub(r"(?<!\d)20\d\d(?!\d)", "", t).replace("×", "x")
    return norm(t)


def same_as_published(title: str, start: str, region: str, by_day) -> bool:
    """느슨한 제목이 같거나 서로 포함 관계 + 시작일·지역 같음.
    포함은 짧은 쪽이 3글자 이상일 때만 본다(「쇼」 같은 한두 글자가 남의 제목에 들어가 걸리지 않게)."""
    a = loose(title)
    for b in by_day.get((start, region), ()):
        if not a or not b:
            continue
        short, long_ = (a, b) if len(a) <= len(b) else (b, a)
        if short == long_ or (len(short) >= 3 and short in long_):
            return True
    return False


def rank(row) -> int:
    s = row["source"]
    return 0 if s == "KOPIS" else (2 if (row["content"].get("ai_suggestion") or {}).get("extracted_by") == "curated" else 1)


ONLY_IDS = set()
ONLY_URLS = set()


def is_approved_review(row) -> bool:
    """관리자가 «공개 후보»에서 승인한 인스타 후보(REVIEW + content.publish_approved_at)"""
    return row.get("status") == "REVIEW" and bool((row.get("content") or {}).get("publish_approved_at"))


def approved_review_ids(db) -> list:
    """승인된 공개 후보 id 목록(정기 실행이 ids 로 넘긴다). 1,000건씩 읽는다"""
    ids, start = [], 0
    while True:
        page = (db.supabase.table("raw_posts").select("id,status,content").eq("status", "REVIEW")
                .order("id").range(start, start + 999).execute().data or [])
        ids += [r["id"] for r in page if is_approved_review(r)]
        if len(page) < 1000:
            return ids
        start += 1000


def mark_review_failed(db, row, reason, now):
    """승인 후보가 검증에 걸림: REVIEW 로 두고 이유를 content 에 남긴다(다른 키는 그대로)"""
    c = json.loads(json.dumps(row.get("content") or {}))
    c["review_reason"] = f"publish_failed: {reason}"
    c["publish_failed_at"] = now
    db.supabase.table("raw_posts").update({"content": c}).eq("id", row["id"]).eq("status", "REVIEW").execute()


async def main(date_from, date_to, dry, ids=None):
    """ids 를 주면(정기 실행의 승인 후보 공개) 그 id 만 보고 승인된 REVIEW 도 받는다. 결과 파일 이름 끝에 _approved"""
    db = Database()
    only_ids = set(ids) if ids else ONLY_IDS
    if only_ids:  # --ids <raw_posts id,...>: 고른 수집분만 발행한다. 승인된 REVIEW 도 받는다
        rows, id_list = [], sorted(only_ids)
        for i in range(0, len(id_list), 100):
            rows += (db.supabase.table("raw_posts").select("*").in_("id", id_list[i:i + 100])
                     .in_("status", ["COLLECTED", "PENDING", "REVIEW"]).execute().data or [])
        rows = [r for r in rows if r["status"] != "REVIEW" or is_approved_review(r)]
    else:
        rows = db.supabase.table("raw_posts").select("*").in_("status", ["COLLECTED", "PENDING"]).execute().data
    if ONLY_URLS:  # --curated <json>: 그 큐레이션 파일로 넣은 수집분만 발행한다
        rows = [r for r in rows if r["source_url"] in ONLY_URLS]
    cands, skipped = [], {"날짜없음/형식오류": 0, "기간밖": 0, "기간지남": 0}
    # 오늘(한국 시간) 이전에 끝난 수집분은 '기간 지남'(EXPIRED)으로 돌려 인박스 검토 대기에서 뺀다.
    # 지우지 않으므로 같은 글을 다시 수집하지 않고 중복 판정에도 쓰인다. date_from 이 아니라 오늘 기준이다.
    today = datetime.now(timezone(timedelta(hours=9))).date().isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()
    expired_ids = []
    review_failed = []  # 승인 후보 중 검증에 걸린 것: {id, title, reason}

    def fail_review(r, reason):
        review_failed.append({"id": r["id"], "title": (r.get("content") or {}).get("title") or "", "reason": reason})
        if not dry:
            mark_review_failed(db, r, reason, now_iso)

    for r in rows:
        a = (r.get("content") or {}).get("ai_suggestion") or {}
        s, e = a.get("date_start", ""), a.get("date_end", "")
        if not (ISO.match(s or "") and ISO.match(e or "")):
            skipped["날짜없음/형식오류"] += 1
            if r["status"] == "REVIEW":
                fail_review(r, "날짜 없음/형식 오류(시작일·끝나는 날 YYYY-MM-DD 필요)")
            continue
        if e < today:
            skipped["기간지남"] += 1; expired_ids.append(r["id"]); continue
        if s > date_to or e < date_from:
            skipped["기간밖"] += 1
            if r["status"] == "REVIEW":
                fail_review(r, f"공개 범위({date_from}~{date_to}) 밖, 다음 실행에서 다시 봄")
            continue
        cands.append(r)

    # 이미 공개된 행사와 같은 것(제목+시작일)은 다시 공개하지 않는다 (정기 실행 때 다른 출처에서 같은 행사가 들어와도)
    # 1,000건씩 끝까지 읽는다(2026-11-26 events 1,170건 — 한 번에 읽으면 1,000건에서 잘려 중복을 놓친다)
    ev_rows, start = [], 0
    while True:
        page = (db.supabase.table("events").select("id,title,event_date_start,region").order("id")
                .range(start, start + 999).execute().data or [])
        ev_rows += page
        if len(page) < 1000:
            break
        start += 1000
    published = {(norm(e["title"]), e["event_date_start"]) for e in ev_rows}
    by_day = {}  # (시작일, 지역) → 느슨한 제목들 (2026-11-26: KOPIS 「제목 [지역]」 ↔ 기관 「연극 <제목>」 중복 15건)
    for e in ev_rows:
        by_day.setdefault((e["event_date_start"], e.get("region") or ""), []).append(loose(e["title"]))

    if expired_ids and not dry:
        for i in range(0, len(expired_ids), 100):
            db.supabase.table("raw_posts").update({"status": "EXPIRED"}).in_("id", expired_ids[i:i + 100]).execute()

    groups = {}
    for r in cands:
        a = r["content"]["ai_suggestion"]
        groups.setdefault((norm(r["content"]["title"]), a["date_start"]), []).append(r)

    report = {"published": [], "duplicates": [], "link_failed": [], "skipped": skipped}
    async with aiohttp.ClientSession() as session:
        for key, grp in groups.items():
            a0 = grp[0]["content"]["ai_suggestion"]
            loose_hit = key not in published and same_as_published(
                grp[0]["content"]["title"], a0["date_start"], a0.get("region") or "경남", by_day)
            if key in published or loose_hit:
                for r in grp:
                    report["duplicates"].append({"title": r["content"]["title"], "source": r["source"],
                                                 "kept": "이미 공개됨(제목 포함·시작일·지역)" if loose_hit else "이미 공개됨"})
                    if not dry:
                        db.supabase.table("raw_posts").update({"status": "DUPLICATE"}).eq("id", r["id"]).execute()
                continue
            grp.sort(key=rank)
            chosen = None
            link_bad = []
            for r in grp:
                ok, status, _ = await check_link(session, r["source_url"])
                if ok:
                    chosen = r; break
                report["link_failed"].append({"title": r["content"]["title"], "url": r["source_url"], "status": status})
                link_bad.append((r, status))
            if not chosen:
                for r, status in link_bad:  # 같은 행사의 다른 출처가 공개되면 그 줄은 아래에서 DUPLICATE 가 된다
                    if r["status"] == "REVIEW":
                        fail_review(r, f"원본 링크 열리지 않음({status})")
                continue
            for r in grp:
                if r is not chosen:
                    report["duplicates"].append({"title": r["content"]["title"], "source": r["source"], "kept": chosen["source"]})
                    if not dry:
                        db.supabase.table("raw_posts").update({"status": "DUPLICATE"}).eq("id", r["id"]).execute()
            a = chosen["content"]["ai_suggestion"]
            poster = (chosen.get("image_urls") or [None])[0] or a.get("poster_url")
            new_images = None
            if chosen["status"] == "REVIEW" and not chosen.get("image_urls"):
                # 인스타 포스터 주소(instagram.com/p/…/media)는 오래 가지 않으므로 저장소에 올린 것만 쓴다(review_instagram 과 같다)
                poster = None
                if a.get("poster_url") and not dry:
                    key = "ig_" + hashlib.sha1(chosen["id"].encode()).hexdigest()[:12]
                    _, p_url, _ = await process_and_upload_image(db.supabase, a["poster_url"], key)
                    if p_url:
                        poster, new_images = p_url, [p_url]
            price = a.get("price", "")
            desc_parts = [chosen["content"].get("description", "").strip()]
            for label, k in (("일시", "time"), ("관람료", "price"), ("관람연령", "age"), ("러닝타임", "runtime"), ("출연", "cast"), ("장르", "genre")):
                if a.get(k):
                    desc_parts.append(f"{label}: {a[k]}")
            event = {
                "title": chosen["content"]["title"],
                "description": "\n".join(p for p in desc_parts if p)[:4000],
                "category": a.get("category") or "행사",
                "region": a.get("region") or "경남",
                "venue": a.get("venue") or "",
                "event_date_start": a["date_start"],
                "event_date_end": a["date_end"],
                "price_info": price,
                "is_free": "무료" in price,
                "poster_image_url": poster,
                "source": chosen["source"],
                "original_url": chosen["source_url"],
                "status": "PUBLISHED",
                "published_at": datetime.now(timezone.utc).isoformat(),
                "raw_post_id": chosen["id"],
            }
            if not dry:
                res = db.supabase.table("events").insert(event).execute()
                if not res.data:
                    report["link_failed"].append({"title": event["title"], "url": "", "status": "insert failed"})
                    if chosen["status"] == "REVIEW":
                        fail_review(chosen, "행사 저장 실패")
                    continue
                upd = {"status": "PUBLISHED"}
                if new_images:
                    upd["image_urls"] = new_images
                db.supabase.table("raw_posts").update(upd).eq("id", chosen["id"]).execute()
            report["published"].append({"title": event["title"], "category": event["category"], "region": event["region"],
                                        "start": event["event_date_start"], "end": event["event_date_end"],
                                        "source": event["source"], "url": event["original_url"]})
            await asyncio.sleep(0.1)

    if review_failed:
        report["review_failed"] = review_failed
    tag = "_approved" if ids else ""
    out = os.path.join(OUT_DIR, f"publish_{date_from}_{date_to}{tag}{'_dryrun' if dry else ''}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    summary = (f"후보 {len(cands)}건 → 발행 {len(report['published'])}, 중복 {len(report['duplicates'])}, "
               f"링크실패 {len(report['link_failed'])}, 제외 {skipped}")
    if review_failed:
        summary += f", 승인 후보 검증 실패 {len(review_failed)}(REVIEW 유지)"
    print(summary)
    print(f"결과: {os.path.abspath(out)}")
    return summary


async def publish_approved(date_from, date_to, dry=False):
    """정기 실행용(specs/003 R2): 인박스에서 승인한 공개 후보만 골라 main(ids=…)으로 같은 검증을 거쳐 공개한다. 한 줄 요약"""
    ids = approved_review_ids(Database())
    if not ids:
        return "승인된 공개 후보 없음"
    return f"승인 {len(ids)}건 → " + await main(date_from, date_to, dry, ids=ids)


if __name__ == "__main__":
    if "--ids" in sys.argv:
        i = sys.argv.index("--ids")
        ONLY_IDS = set(sys.argv[i + 1].split(","))
        del sys.argv[i:i + 2]
    if "--curated" in sys.argv:
        i = sys.argv.index("--curated")
        ONLY_URLS = {e["url"] for e in json.load(open(sys.argv[i + 1], encoding="utf-8"))}
        del sys.argv[i:i + 2]
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    asyncio.run(main(args[0], args[1], "--dry-run" in sys.argv))
