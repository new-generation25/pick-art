"""숨은 행사 제보 주간 집계 — 그 주에 확인돼 피카에 실린 제보(쿠폰 후보)를 뽑는다.

사용: python tools/tip_weekly.py                 이번 주(월~일, 한국 시각)
      python tools/tip_weekly.py --week 2026-12-03   그 날짜가 든 주
      python tools/tip_weekly.py --draw [--seed 1203]  나머지 3명 추첨 결과까지 보인다(같은 seed 면 같은 결과)

읽는 곳: 보기 public.tip_entries (specs/020-tip-event/plan.md 「주간 집계」, service_role 만 읽음, 연락처 값 없음)
         와 reports(kind=tip, status=done 의 user_id — 사람별로 세려고. 관리자 «신고·제보» 화면과 같은 기준).
- 실린 제보 = done 이고 handled_at 이 그 주
- 당첨 규칙(2026-11-27 운영자 결정, docs/PLAN_community_2026-11.md 12-1):
  1) 그 주에 반영된 제보가 가장 많은 회원 2명은 무조건 당첨. 2위와 3위가 같은 건수면 운영자가 정한다
  2) 나머지 3명은 그 주에 실린 제보를 보낸 사람 중에서 뽑는다(같은 사람은 한 주 1장).
     로그인 없이 온 제보는 사람을 알 수 없어 제보 1건을 한 사람으로 센다. 카카오 제보는 채널 1:1 채팅으로만 건넬 수 있다
  3) 발표는 인스타그램 @picka.news 와 카카오톡 채널 «피카» 두 곳(11/27 정정). 쿠폰 지급은 2026년 12월까지
- 쿠폰을 사서 보내는 일은 운영자가 한다(돈이 나가는 일). 이 도구는 후보와 추첨 결과만 보여 준다
- 제보 원문이 인스타그램이면 그 계정이 출처 DB(whitelist)에 있는지도 본다(없으면 「출처 DB에 없음」 — 소규모 단체 기준에 맞으면 넣는다)
"""
import argparse
import collections
import datetime as dt
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402

KST = dt.timezone(dt.timedelta(hours=9))
END_DATE = dt.date(2026, 12, 31)  # 쿠폰 지급 기간 끝(2026-11-27 운영자 결정 「12월까지」)


def week_range(day):
    start = dt.datetime.combine(day - dt.timedelta(days=day.weekday()), dt.time(), KST)
    return start, start + dt.timedelta(days=7)


def insta_handle(url, credit):
    m = re.search(r"instagram\.com/([A-Za-z0-9_.]+)/?$", url or "")
    if m and m.group(1) not in ("p", "reel", "stories"):
        return m.group(1).lower()
    m = re.match(r"@([A-Za-z0-9_.]+)", (credit or "").strip())
    return m.group(1).lower() if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--week", help="그 주에 든 날짜 YYYY-MM-DD (기본: 오늘)")
    ap.add_argument("--draw", action="store_true", help="상위 2명 뒤 나머지 3명을 추첨해 보인다")
    ap.add_argument("--seed", type=int, help="추첨 seed(기록해 두면 같은 결과를 다시 낼 수 있다)")
    a = ap.parse_args()
    day = dt.date.fromisoformat(a.week) if a.week else dt.datetime.now(KST).date()
    start, end = week_range(day)
    sb = Database().supabase
    try:
        rows = (sb.table("tip_entries").select("*").eq("done", True)
                .gte("handled_at", start.isoformat()).lt("handled_at", end.isoformat())
                .order("handled_at").execute().data)
    except Exception as e:  # 020 배포 전에는 보기가 없다
        print(f"tip_entries 를 읽지 못함 — 운영 DB에 020(숨은 행사 제보)이 아직 적용되지 않았을 수 있음: {str(e)[:160]}")
        return
    wl = {r["value"].rstrip("/").split("/")[-1].lower()
          for r in sb.table("whitelist").select("value").eq("type", "instagram").range(0, 4999).execute().data}
    print(f"주간 실린 제보 {start:%Y-%m-%d}~{(end - dt.timedelta(days=1)):%m-%d}: {len(rows)}건")
    can = 0
    for r in rows:
        h = insta_handle(r.get("url"), r.get("credit_name"))
        src = ("" if not h else (" · 출처 DB에 있음" if h in wl else f" · @{h} 출처 DB에 없음"))
        coupon = ("쿠폰 보냄 " + r["reward_sent_at"][:10]) if r.get("reward_sent_at") else (
            "연락처 있음" if r.get("has_contact") else ("카카오 1:1로만" if str(r.get("channel", "")).startswith("kakao") else "연락처 없음"))
        if not r.get("reward_sent_at") and (r.get("has_contact") or str(r.get("channel", "")).startswith("kakao")):
            can += 1
        print(f"- [{r.get('channel')}] {(r.get('title') or '')[:40]} | 행사 {str(r.get('event_id') or '-')[:8]} | "
              f"{r.get('credit_name') or '이름 비공개'} | {coupon}{src}")
    print(f"쿠폰을 건넬 길이 있는 실린 제보(아직 안 보냄): {can}건")
    if start.date() > END_DATE:
        print(f"⚠️ 이 주는 쿠폰 지급 기간(~{END_DATE:%Y-%m-%d}) 밖이다 — 당첨을 뽑지 않는다")
        return

    # 사람별로 센다: 회원은 user_id, 로그인 없는 사이트 제보는 제보 1건 = 1명, 카카오 제보는 1건 = 1명
    rep = (sb.table("reports").select("id,user_id,reward_contact,reward_sent_at")
           .eq("kind", "tip").eq("status", "done")
           .gte("handled_at", start.isoformat()).lt("handled_at", end.isoformat()).execute().data)
    members = collections.Counter(r["user_id"] for r in rep if r.get("user_id"))
    contact = {r["user_id"] for r in rep if r.get("user_id") and r.get("reward_contact")}
    names = {}
    if members:
        for p in sb.table("profiles").select("id,nickname").in_("id", list(members)).execute().data:
            names[p["id"]] = (p.get("nickname") or "").strip() or "별명 없음"
    ranked = members.most_common()
    top = ranked[:2]
    print("\n[당첨 1] 반영된 제보가 가장 많은 회원 2명(무조건 당첨):")
    if not top:
        print("- 아직 없음")
    for i, (uid, n) in enumerate(top, 1):
        print(f"- {i}. {names.get(uid, '별명 없음')} {n}건" + ("" if uid in contact else " (연락처 없음 — 채널 1:1 또는 회원 정보로 연락)"))
    if len(ranked) > 2 and ranked[1][1] == ranked[2][1]:
        print(f"  ⚠️ 2위와 3위가 같은 {ranked[1][1]}건이다 — 누구를 넣을지는 운영자가 정한다(그 뒤 --draw)")
    pool = [("회원", names.get(uid, "별명 없음") + f" {n}건", uid in contact) for uid, n in ranked[2:]]
    anon_ids = {r["id"] for r in rep if not r.get("user_id")}
    pool += [("비회원 제보", (r.get("title") or "")[:30], bool(r.get("has_contact")))
             for r in rows if r.get("channel") == "site" and str(r.get("entry_id")) in anon_ids]
    pool += [("카카오", (r.get("title") or "")[:30], False) for r in rows if str(r.get("channel", "")).startswith("kakao")]
    print(f"\n[당첨 2] 나머지 3명 추첨 대상: {len(pool)}명")
    for kind, label, has in pool:
        print(f"- [{kind}] {label}" + (" · 연락처 있음" if has else (" · 카카오 1:1로만" if kind == "카카오" else " · 연락처 없음")))
    if a.draw and pool:
        seed = a.seed if a.seed is not None else int(start.strftime("%Y%m%d"))
        pick = random.Random(seed).sample(pool, min(3, len(pool)))
        print(f"\n추첨 결과(seed {seed}): " + " · ".join(f"[{k}] {l}" for k, l, _ in pick))
    print("\n발표: 인스타그램 @picka.news 와 카카오톡 채널 «피카». 쿠폰 구매·발송은 운영자가 한다. 보낸 뒤 관리자 «신고·제보»에서 «쿠폰 보냄 · 연락처 지우기»")


if __name__ == "__main__":
    main()
