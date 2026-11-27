"""인스타 활동 리포트(대시보드)용 날짜별 웹 방문 수 — docs/insta/report/web.json

Vercel Web Analytics 의 날짜별 합계(방문자·페이지뷰)만 읽는다. 사람 단위 기록은 없다.
토큰·호출은 publish_site_visits.py 와 같다(collector/.env.local 의 VERCEL_TOKEN). 날짜는 Vercel 이 주는 UTC 날짜다.
2026-11-27 운영자 지시: 「웹 방문자랑 게시 중 행사 수도 추이에 넣어」 — 게시 중 행사 수는 metrics.json 의 active_events 를 쓴다.

사용(collector 폴더에서): python tools/report_web_daily.py
"""
import json
import os
import sys
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import publish_site_visits as psv  # noqa: E402  (.env.local 을 읽는다)

OUT = os.path.join(HERE, "..", "..", "docs", "insta", "report", "web.json")
SINCE = "2026-11-16"  # 리포트 기록이 시작된 날 무렵부터


def main():
    token = os.getenv("VERCEL_TOKEN")
    if not token:
        print("❌ 웹 방문: VERCEL_TOKEN 이 없습니다(collector/.env.local)")
        return 1
    until = date.today().isoformat()
    n = (date.today() - date.fromisoformat(SINCE)).days + 2
    try:
        got = psv._get("aggregate", token, since=SINCE, until=until, by=["day"], limit=min(n, 400))
    except Exception as e:  # 토큰 값이 섞이지 않게 종류만
        print(f"❌ 웹 방문: {type(e).__name__}")
        return 1
    rows = [{"date": r["timestamp"][:10], "visitors": r.get("visitors", 0), "pageviews": r.get("pageviews", 0)} for r in got]
    rows.sort(key=lambda r: r["date"])
    meta = [
        {"label": "원본", "value": "Vercel Web Analytics 날짜별 합계 (쿠키 없음, 사람 단위 기록 없음)"},
        {"label": "날짜", "value": "UTC 날짜 단위(한국 시각 오전 9시에 날이 바뀜)"},
        {"label": "기간", "value": f"{SINCE} ~ {until}"},
        {"label": "만든 코드", "value": "collector/tools/report_web_daily.py"},
    ]
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"rows": rows, "meta": meta}, f, ensure_ascii=False, indent=1)
    last7 = [r for r in rows if r["date"] >= (date.today() - timedelta(days=6)).isoformat()]
    print(f"✅ 웹 방문 {len(rows)}일 → {os.path.normpath(OUT)} · 최근 7일 방문자 합 {sum(r['visitors'] for r in last7)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
