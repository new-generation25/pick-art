"""사이트 방문 수(Vercel Web Analytics)를 ops_snapshots('site_visits')에 올린다 (specs/011 FR-001)

관리자 대시보드(/admin)가 이것을 읽는다. 쿠키 없는 Vercel Web Analytics 합계만 쓴다(사람 단위 기록 없음).
토큰: collector/.env.local 의 VERCEL_TOKEN (pick-art 프로젝트만 읽는 토큰, 2027-11-26 만료). 수집기(PC)에만 둔다.
날짜는 Vercel 이 주는 UTC 날짜 단위다(한국 시각 오전 9시에 날이 바뀐다).

사용(collector 폴더에서): python tools/publish_site_visits.py   — 마지막 줄이 한 줄 요약
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")

PROJECT_ID = "prj_GfZmpxXrsXnJbIYUnLKQI9yfJqbM"  # pick-art
TEAM_ID = "team_5ViM0jKO3sbPowmeAARP08Fc"
API = "https://api.vercel.com/v1/query/web-analytics/visits"


def _get(path, token, **params):
    q = urllib.parse.urlencode({"projectId": PROJECT_ID, "teamId": TEAM_ID, **params}, doseq=True)
    req = urllib.request.Request(f"{API}/{path}?{q}", headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["data"]


def build(token, today=None):
    """Vercel 에서 읽어 스냅숏 모양으로 만든다"""
    today = today or datetime.now(timezone.utc).date()
    d = lambda n: (today - timedelta(days=n)).isoformat()
    month_start = today.replace(day=1).isoformat()
    six_months = (today.replace(day=1) - timedelta(days=150)).replace(day=1).isoformat()
    until = today.isoformat()

    def total(since):
        x = _get("count", token, since=since, until=until)
        return {"visitors": x.get("visitors", 0), "pageviews": x.get("pageviews", 0)}

    def top(dim, n=10):
        rows = _get("aggregate", token, since=d(29), until=until, by=[dim], limit=n)
        return [{"key": r.get(dim) or "(직접)", "visitors": r.get("visitors", 0), "pageviews": r.get("pageviews", 0)} for r in rows]

    daily = _get("aggregate", token, since=d(29), until=until, by=["day"], limit=31)
    monthly = _get("aggregate", token, since=six_months, until=until, by=["month"], limit=12)
    return {
        "summary": {"d7": total(d(6)), "d30": total(d(29)), "month": total(month_start)},
        "daily": [{"date": r["timestamp"][:10], "visitors": r.get("visitors", 0), "pageviews": r.get("pageviews", 0)} for r in daily],
        "monthly": [{"month": r["timestamp"][:7], "visitors": r.get("visitors", 0), "pageviews": r.get("pageviews", 0)} for r in monthly],
        "pages": top("requestPath"),
        "referrers": top("referrerHostname"),
        "devices": top("deviceType", 5),
        "meta": [{"label": "원본", "value": "Vercel Web Analytics (쿠키 없음, 합계만)"},
                 {"label": "날짜", "value": "UTC 날짜 단위"},
                 {"label": "기간", "value": f"{d(29)} ~ {until}"}],
    }


def main():
    token = os.getenv("VERCEL_TOKEN")
    if not token:
        print("❌ 방문 수: VERCEL_TOKEN 이 없습니다(collector/.env.local)")
        return 1
    try:
        data = build(token)
    except urllib.error.HTTPError as e:
        print(f"❌ 방문 수: Vercel 응답 {e.code}" + (" — 토큰 만료·권한 확인" if e.code in (401, 403) else ""))
        return 1
    except Exception as e:  # 네트워크 등
        print(f"❌ 방문 수: {type(e).__name__}")
        return 1

    from database import Database
    db = Database()
    now = datetime.now(timezone.utc).isoformat()
    db.supabase.table("ops_snapshots").upsert({"name": "site_visits", "data": data, "updated_at": now}, on_conflict="name").execute()
    got = db.supabase.table("ops_snapshots").select("updated_at").eq("name", "site_visits").execute().data or []
    if not got or got[0]["updated_at"][:19] != now[:19]:
        print("❌ 방문 수: 스냅숏 확인 실패")
        return 1
    s = data["summary"]
    print(f"✅ 방문 수: 7일 {s['d7']['visitors']}명·{s['d7']['pageviews']}뷰 · 30일 {s['d30']['visitors']}명·{s['d30']['pageviews']}뷰")
    return 0


if __name__ == "__main__":
    sys.exit(main())
