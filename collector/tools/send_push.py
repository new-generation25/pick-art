"""휴대폰 알림 보내기 (specs/018, 2026-11-27 운영자 «이메일 구독 칸 빼, 푸시 알림이 갈 수 있도록해»).

정기 실행(main.py)이 매 회차 부른다. 세 가지를 보낸다(회원이 내 정보에서 끌 수 있다):
  favorite_eve : 찜한 행사가 내일 시작하면 «내일 ○○» (행사마다 한 번)
  weekend      : 금요일 오후 회차(낮 12시 뒤), 내 지역(설정)의 이번 주말 행사 수와 대표 몇 개 (주마다 한 번)
  venue_new    : 찜한 장소에 새로 공개된 행사 (행사마다 한 번, 한 사람에게 한 회차에 한 통으로 묶음)
같은 알림은 push_sent 에 남겨 두 번 보내지 않는다. 기기가 알림을 막아 404/410 이 오면 그 구독을 지운다.
밤 9시~아침 8시(한국)에는 보내지 않는다.

쓰기는 collector/.env.local 의 service 키, 보내기는 VAPID_PRIVATE_KEY(같은 파일, git 밖).
사용(collector 폴더에서, 마지막 줄이 한 줄 요약):
  python tools/send_push.py                 보내기
  python tools/send_push.py --dry-run       무엇을 누구에게 보낼지만 출력
  python tools/send_push.py --test <회원id> 그 회원의 모든 기기에 시험 알림 1통
  python tools/send_push.py --force-weekend 금요일이 아니어도 주말 요약을 만든다(시험용, --dry-run 과 같이)
"""
import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402

KST = timezone(timedelta(hours=9))
SITE = "https://picka.news"
REGION_SLUGS = {
    "창원": "changwon", "김해": "gimhae", "진주": "jinju", "통영": "tongyeong", "거제": "geoje", "양산": "yangsan",
    "밀양": "miryang", "사천": "sacheon", "함안": "haman", "고성": "goseong", "합천": "hapcheon", "거창": "geochang",
    "함양": "hamyang", "창녕": "changnyeong", "의령": "uiryeong", "남해": "namhae", "하동": "hadong", "산청": "sancheong",
    "부산": "busan",
}


def now_kst():
    return datetime.now(KST)


def all_rows(q):
    out, off = [], 0
    while True:
        d = q.range(off, off + 999).execute().data
        out += d
        if len(d) < 1000:
            return out
        off += 1000


def short(t, n=28):
    t = (t or "").strip()
    return t if len(t) <= n else t[: n - 1] + "…"


def weekend_range(today):
    """이번 주 토·일 (금요일이면 내일·모레)"""
    sat = today + timedelta(days=(5 - today.weekday()) % 7)
    return sat, sat + timedelta(days=1)


def plan(sb, today, force_weekend=False, afternoon=True):
    """→ [(user_id, kind, refs[], payload)]. afternoon: 낮 12시 뒤 회차인지(주말 요약은 금요일 오후 회차에만, specs/018)"""
    profiles = {p["id"]: p for p in all_rows(sb.table("profiles").select("id,region,push_favorites,push_weekend,push_venues"))}
    subs_users = {s["user_id"] for s in all_rows(sb.table("push_subscriptions").select("user_id"))}
    sent = {(r["user_id"], r["kind"], r["ref"]) for r in all_rows(sb.table("push_sent").select("user_id,kind,ref"))}
    out = []
    users = [u for u in subs_users if u in profiles]

    # 1) 찜한 행사 전날
    tomorrow = (today + timedelta(days=1)).isoformat()
    favs = all_rows(sb.table("favorites").select("user_id,event_id,events(id,title,venue,region,event_date_start,status)"))
    for f in favs:
        e = f.get("events") or {}
        u = f["user_id"]
        if u not in users or not profiles[u].get("push_favorites", True):
            continue
        if e.get("status") != "PUBLISHED" or e.get("event_date_start") != tomorrow:
            continue
        if (u, "favorite_eve", e["id"]) in sent:
            continue
        out.append((u, "favorite_eve", [e["id"]], {
            "title": f"내일 «{short(e['title'])}»",
            "body": f"{e.get('venue') or e.get('region') or ''} · 찜한 행사가 내일 시작해요".strip(" ·"),
            "url": f"/events/{e['id']}", "tag": f"fav-{e['id']}",
        }))

    # 2) 금요일 오후 회차의 주말 요약 (내 지역, 지역을 안 정했으면 보내지 않는다).
    #    11/27 첫 금요일에 08:20 회차가 보내 명세(오후 3시 회차)와 달랐다 → 낮 12시 뒤 회차로 맞춤
    if (today.weekday() == 4 and afternoon) or force_weekend:
        sat, sun = weekend_range(today)
        ref = today.isoformat()
        cache = {}
        for u in users:
            p = profiles[u]
            region = p.get("region")
            if not p.get("push_weekend", True) or region not in REGION_SLUGS or (u, "weekend", ref) in sent:
                continue
            if region not in cache:
                rows = all_rows(sb.table("events").select("id,title,event_date_start,event_date_end")
                                .eq("status", "PUBLISHED").eq("region", region)
                                .lte("event_date_start", sun.isoformat()).gte("event_date_end", sat.isoformat()))
                # 상시·장기(30일 넘게 하는 것)는 빼고 이번 주말에 맞춘 행사 먼저
                def days(r):
                    try:
                        return (datetime.fromisoformat(r["event_date_end"]) - datetime.fromisoformat(r["event_date_start"])).days
                    except Exception:
                        return 999
                rows = [r for r in rows if days(r) <= 30]
                rows.sort(key=lambda r: (days(r), r["event_date_start"]))
                cache[region] = rows
            rows = cache[region]
            if not rows:
                continue
            out.append((u, "weekend", [ref], {
                "title": f"이번 주말 {region} 행사 {len(rows)}건",
                "body": " · ".join(short(r["title"], 18) for r in rows[:3]),
                "url": f"/region/{REGION_SLUGS[region]}?date=week", "tag": f"weekend-{ref}",
            }))

    # 3) 찜한 장소 새 행사 (찜한 뒤에 공개된 것만, 최근 3일)
    follows = all_rows(sb.table("venue_follows").select("user_id,venue_id,created_at"))
    if follows:
        since = (now_kst() - timedelta(days=3)).astimezone(timezone.utc).isoformat()
        vids = sorted({f["venue_id"] for f in follows})
        new_events = []
        for i in range(0, len(vids), 100):
            new_events += all_rows(sb.table("events").select("id,title,venue,venue_id,published_at,event_date_end")
                                   .eq("status", "PUBLISHED").in_("venue_id", vids[i:i + 100])
                                   .gte("published_at", since).gte("event_date_end", today.isoformat()))
        by_venue = defaultdict(list)
        for e in new_events:
            by_venue[e["venue_id"]].append(e)
        per_user = defaultdict(list)
        for f in follows:
            u = f["user_id"]
            if u not in users or not profiles[u].get("push_venues", True):
                continue
            for e in by_venue.get(f["venue_id"], []):
                if (e.get("published_at") or "") < f["created_at"] or (u, "venue_new", e["id"]) in sent:
                    continue
                per_user[u].append(e)
        for u, evs in per_user.items():
            evs.sort(key=lambda e: e.get("published_at") or "")
            first = evs[0]
            vname = first.get("venue") or "찜한 장소"
            if len(evs) == 1:
                payload = {"title": f"{short(vname, 20)} 새 행사", "body": short(first["title"], 40),
                           "url": f"/events/{first['id']}", "tag": f"venue-{first['id']}"}
            else:
                payload = {"title": f"찜한 장소에 새 행사 {len(evs)}건",
                           "body": " · ".join(short(e["title"], 18) for e in evs[:3]),
                           "url": "/me#venues", "tag": "venue-new"}
            out.append((u, "venue_new", [e["id"] for e in evs], payload))
    return out


def send(sb, items, dry):
    from pywebpush import WebPushException, webpush
    key = os.environ.get("VAPID_PRIVATE_KEY")
    subject = os.environ.get("VAPID_SUBJECT", SITE)
    if not key and not dry:
        print("❌ VAPID_PRIVATE_KEY 없음(collector/.env.local)")
        return 0, 0, 0
    subs = defaultdict(list)
    for s in all_rows(sb.table("push_subscriptions").select("id,user_id,endpoint,p256dh,auth,fail_count")):
        subs[s["user_id"]].append(s)
    ok = fail = gone = 0
    for u, kind, refs, payload in items:
        devices = subs.get(u, [])
        print(f"  {'(미리보기) ' if dry else ''}{kind} → {u[:8]} 기기 {len(devices)}: {payload['title']} | {payload['body']}")
        if dry:
            continue
        delivered = False
        for s in devices:
            try:
                webpush(subscription_info={"endpoint": s["endpoint"], "keys": {"p256dh": s["p256dh"], "auth": s["auth"]}},
                        data=json.dumps(payload, ensure_ascii=False), vapid_private_key=key,
                        vapid_claims={"sub": subject}, ttl=60 * 60 * 12)
                delivered = True
                ok += 1
                sb.table("push_subscriptions").update({"last_ok_at": datetime.now(timezone.utc).isoformat(), "fail_count": 0}).eq("id", s["id"]).execute()
            except WebPushException as ex:
                code = getattr(ex.response, "status_code", None)
                if code in (404, 410):
                    gone += 1
                    sb.table("push_subscriptions").delete().eq("id", s["id"]).execute()
                else:
                    fail += 1
                    n = (s.get("fail_count") or 0) + 1
                    if n >= 10:
                        sb.table("push_subscriptions").delete().eq("id", s["id"]).execute()
                    else:
                        sb.table("push_subscriptions").update({"fail_count": n}).eq("id", s["id"]).execute()
                    print(f"    실패 {code}: {str(ex)[:120]}")
        if delivered and refs:
            sb.table("push_sent").upsert([{"user_id": u, "kind": kind, "ref": r} for r in refs]).execute()
    return ok, fail, gone


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force-weekend", action="store_true")
    ap.add_argument("--test", metavar="USER_ID")
    a = ap.parse_args()
    sb = Database().supabase
    if a.test:
        items = [(a.test, "test", [], {"title": "피카 알림 시험", "body": "이 기기로 알림이 옵니다.", "url": "/me", "tag": "test"})]
        ok, fail, gone = send(sb, items, a.dry_run)  # 시험은 push_sent 에 남기지 않는다(refs 없음)
        print(f"휴대폰 알림 시험: 보냄 {ok} · 실패 {fail} · 지운 구독 {gone}")
        return
    now = now_kst()
    if not a.dry_run and (now.hour >= 21 or now.hour < 8):
        print(f"휴대폰 알림: 밤 시간({now:%H:%M})이라 보내지 않음")
        return
    items = plan(sb, now.date(), a.force_weekend, afternoon=now.hour >= 12)
    ok, fail, gone = send(sb, items, a.dry_run)
    kinds = defaultdict(int)
    for _, k, _, _ in items:
        kinds[k] += 1
    detail = " · ".join(f"{k} {n}" for k, n in sorted(kinds.items())) or "보낼 것 없음"
    print(f"휴대폰 알림{'(미리보기)' if a.dry_run else ''}: {detail} → 보냄 {ok} · 실패 {fail} · 지운 구독 {gone}")


if __name__ == "__main__":
    main()
