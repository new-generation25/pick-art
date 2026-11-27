"""숨은 행사 제보 주간 집계 — 그 주에 확인돼 피카에 실린 제보(쿠폰 후보)를 뽑는다.

사용: python tools/tip_weekly.py                 이번 주(월~일, 한국 시각)
      python tools/tip_weekly.py --week 2026-12-03   그 날짜가 든 주

읽는 곳: 보기 public.tip_entries (specs/020-tip-event/plan.md 「주간 집계」, service_role 만 읽음, 연락처 값 없음).
- 실린 제보 = done 이고 handled_at 이 그 주
- 쿠폰은 연락처를 남긴 사이트 제보(has_contact)에게 보낸다. 카카오 제보는 연락처가 없어 채널 1:1 채팅으로만 건넬 수 있다
- 5명을 고르고 쿠폰을 사서 보내는 일은 운영자가 한다(돈이 나가는 일). 이 도구는 후보만 보여 준다
- 제보 원문이 인스타그램이면 그 계정이 출처 DB(whitelist)에 있는지도 본다(없으면 「출처 DB에 없음」 — 소규모 단체 기준에 맞으면 넣는다)
"""
import argparse
import datetime as dt
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402

KST = dt.timezone(dt.timedelta(hours=9))


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
    print(f"쿠폰 후보(아직 안 보냄, 건넬 길 있음): {can}건 — 운영자가 5명을 고른다(같은 사람은 한 주 1장)")


if __name__ == "__main__":
    main()
