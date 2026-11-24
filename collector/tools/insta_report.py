"""인스타 활동 기록(docs/insta/*.json)을 리포트 대시보드용 데이터 파일로 묶는다.

입력 (docs/insta/):
  posted.json    게시: {event_id, title, region, posted_at, post_url, note?}
  engaged.json   팔로우·댓글: {date, type: follow|comment, account, role?, post_url?, text?, form?, saved?, note?}
  dm.json        DM: {date, account, post_url, event, text?, status: sent|yes|no|none, reply?}
  feedback.json  받은 반응: {date, kind, account, detail, link?}  (맞팔로우·댓글 답글·DM 답장·멘션 등)
  stats.json     계정 숫자: {date, followers, following, posts, note?}
  runs.json      예약 실행 기록: {task, start, minutes, status, turns, cache_read, ...}  (insta_runs.py 가 만든다)
  report_links.json  날짜별 작업 리포트 링크: [{date, title, url}]

출력 (docs/insta/report/):
  activity.json  {"rows": [...], "meta": [...]}  한 줄 = 활동 하나. date 는 YYYY-MM-DD, at 은 기록의 시각(ISO, 없으면 "")
  stats.json     {"rows": [...]}                 날짜별 계정 숫자
  daily.json     {"rows": [...], "meta": [...]}  한 줄 = 날짜 하나 (활동 수·계정 숫자·그날 실행·리포트 링크)
  runs.json      {"rows": [...], "meta": [...]}  runs.json 사본 + date·round(1차/2차/기타)·new_method

사용: python tools/insta_report.py   (collector 폴더에서)
"""
import json
import os
import re
from datetime import datetime

BASE = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "insta")
OUT = os.path.join(BASE, "report")


def load(name):
    p = os.path.join(BASE, name)
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def at_of(v):
    """시각이 들어 있는 ISO 값(YYYY-MM-DDTHH:MM…)만 시각으로 쓴다. 날짜만 있으면 ""."""
    v = v or ""
    return v if "T" in v else ""


def main():
    rows = []
    for p in load("posted.json"):
        rows.append({"date": p.get("posted_at", "")[:10], "at": at_of(p.get("posted_at")), "kind": "게시", "account": "@picka.news",
                     "detail": f"{p.get('region', '')} · {p.get('title', '')}", "link": p.get("post_url", ""),
                     "result": p.get("note", "올림")})
    role_ko = {"official": "기관", "group": "단체", "artist": "예술인"}
    for e in load("engaged.json"):
        base = {"date": e["date"][:10], "at": at_of(e.get("at") or e.get("date")), "account": e["account"], "name": e.get("name", ""), "scale": e.get("scale", "")}
        if e.get("type") == "follow":
            rows.append({**base, "kind": "팔로우",
                         "detail": role_ko.get(e.get("role"), e.get("role", "")),
                         "link": "https://www.instagram.com/" + e["account"].lstrip("@") + "/", "result": "팔로잉"})
        elif e.get("type") == "comment":
            rows.append({**base, "kind": "댓글",
                         "detail": f"[{e.get('form', '')}] {e.get('text', '')}", "link": e.get("post_url", ""),
                         "result": ("저장됨" if e.get("saved") else "저장 안 됨") + (f" · {e['note']}" if e.get("note") else "")})
        elif e.get("type") == "like_back":
            rows.append({**base, "kind": "답례",
                         "detail": f"좋아요 답례 ({e.get('why', '')})", "link": e.get("post_url", ""), "result": "좋아요"})
        elif e.get("type") == "reply":
            rows.append({**base, "kind": "답례",
                         "detail": f"대댓글: 「{e.get('their_text', '')}」 → {e.get('text', '')}", "link": e.get("post_url", ""),
                         "result": "저장됨" if e.get("saved") else "저장 안 됨"})
        elif e.get("type") == "comment_like":
            rows.append({**base, "kind": "답례",
                         "detail": f"댓글 좋아요: 「{e.get('their_text', '')}」", "link": e.get("post_url", ""), "result": "좋아요"})
    for d in load("dm.json"):
        status = {"sent": "보냄·답 없음", "yes": "허락", "no": "거절", "none": "7일 무응답", "posted": "허락·게시함"}.get(d.get("status"), d.get("status", ""))
        rows.append({"date": d["date"][:10], "at": at_of(d.get("at") or d.get("date")), "kind": "허락요청" if d.get("channel") == "comment" else "DM", "account": d["account"], "name": d.get("name", ""), "scale": "소규모",
                     "detail": d.get("event", ""), "link": d.get("post_url", ""),
                     "result": status + (f" · 답: {d['reply']}" if d.get("reply") else "")})
        if d.get("status") in ("yes", "posted"):  # 허락 받은 날에 한 줄 더 (날짜별 리포트의 새 허락 목록)
            rows.append({"date": permit_date(d), "at": "", "kind": "허락", "account": d["account"], "name": d.get("name", ""),
                         "scale": "소규모", "detail": d.get("event", ""), "link": d.get("posted_url") or d.get("post_url", ""),
                         "result": status})
    for f in load("feedback.json"):
        rows.append({"date": f["date"][:10], "at": at_of(f.get("at") or f.get("date")), "kind": "반응", "account": f["account"], "name": f.get("name", ""), "scale": "",
                     "detail": f"{f.get('kind', '')} · {f.get('detail', '')}", "link": f.get("link", ""), "result": f.get("kind", "")})
    for r in rows:
        r.setdefault("name", "")
        r.setdefault("scale", "")
        r.setdefault("at", "")  # 기록에 시각(at)이 없으면 비워 둔다. 날짜만 있는 줄에 가짜 시각을 만들지 않는다
    order = {"게시": 0, "팔로우": 1, "댓글": 2, "DM": 3, "허락요청": 3, "허락": 4, "반응": 4, "답례": 5}
    rows.sort(key=lambda r: (r["date"], order.get(r["kind"], 9), r["at"]), reverse=False)
    for i, r in enumerate(rows, 1):
        r["id"] = f"{r['date']}-{i:04d}"
    os.makedirs(OUT, exist_ok=True)
    meta = [{"label": "만든 시각", "value": datetime.now().strftime("%Y-%m-%d %H:%M")},
            {"label": "원본", "value": "docs/insta/posted.json · engaged.json · dm.json · feedback.json"}]
    with open(os.path.join(OUT, "activity.json"), "w", encoding="utf-8") as f:
        json.dump({"rows": rows, "meta": meta}, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "stats.json"), "w", encoding="utf-8") as f:
        json.dump({"rows": load("stats.json")}, f, ensure_ascii=False, indent=1)
    runs = build_runs()
    daily = build_daily(runs)
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    with open(os.path.join(OUT, "runs.json"), "w", encoding="utf-8") as f:
        json.dump({"rows": runs, "meta": [
            {"label": "만든 시각", "value": now},
            {"label": "원본", "value": "docs/insta/runs.json (insta_runs.py)"},
            {"label": "차수", "value": "task 이름에 daily → 1차(10시), check → 2차(16시, 옛날엔 14시·18시), 그 밖(수동·지역 묶음) → 기타"},
            {"label": "새 방식", "value": f"{NEW_METHOD_FROM} 부터 시작한 실행은 new_method=true"}]},
            f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "daily.json"), "w", encoding="utf-8") as f:
        json.dump({"rows": daily, "meta": [
            {"label": "만든 시각", "value": now},
            {"label": "원본", "value": "docs/insta/posted · engaged · dm · feedback · stats · runs · report_links .json"},
            {"label": "허락 댓글·DM", "value": "dm.json 의 그날 기록 중 channel=comment 은 허락 댓글, 그 밖은 DM"},
            {"label": "새 허락", "value": "dm.json 에서 status 가 yes·posted 인 것. 날짜는 reply 글에 처음 나오는 M.D·M/D(없으면 요청한 날)"},
            {"label": "답례", "value": "engaged.json 의 like_back·comment_like(좋아요), reply(대댓글)"},
            {"label": "실행 토큰", "value": "cache_read 를 백만 단위로 반올림(소수 첫째 자리). 같은 차수가 하루 여러 번이면 더한 값과 횟수"}]},
            f, ensure_ascii=False, indent=1)
    print(f"activity {len(rows)}줄, stats {len(load('stats.json'))}줄, daily {len(daily)}줄, runs {len(runs)}줄 → {OUT}")


NEW_METHOD_FROM = "2026-11-24"


def run_round(task):
    if "daily" in task and "manual" not in task:
        return "1차"
    if "check" in task:
        return "2차"
    return "기타"


def build_runs():
    out = []
    for r in load("runs.json"):
        row = {k: v for k, v in r.items() if k != "files"}  # files 는 이 PC 경로라 빼고 옮긴다
        start = r.get("start", "")
        row["date"] = start[:10]
        row["round"] = run_round(r.get("task", ""))
        row["new_method"] = start[:10] >= NEW_METHOD_FROM
        row["cache_read_m"] = round((r.get("cache_read") or 0) / 1e6, 1)
        out.append(row)
    return out


def permit_date(d):
    """허락 받은 날: reply 글에 처음 나오는 M.D·M/D. 없거나 요청한 날보다 앞이면 요청한 날."""
    asked = d.get("date", "")[:10]
    m = re.search(r"(?<!\d)(1[0-2]|0?[1-9])[./](3[01]|[12]\d|0?[1-9])(?!\d)", d.get("reply") or "")
    if m and asked:
        cand = f"{asked[:4]}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        if cand >= asked:
            return cand
    return asked


def build_daily(runs):
    days = {}

    def day(date):
        date = (date or "")[:10]
        if date not in days:
            days[date] = {"date": date, "posts": 0, "posts_small": 0, "posts_public": 0, "posts_other": 0,
                          "follows": 0, "comments": 0, "ask_comments": 0, "dms": 0, "new_permits": 0,
                          "feedback": 0, "thanks_like": 0, "thanks_reply": 0}
        return days[date]

    for p in load("posted.json"):
        d = day(p.get("posted_at"))
        d["posts"] += 1
        sc = p.get("scale")
        d["posts_small" if sc == "소규모" else "posts_public" if sc == "공공" else "posts_other"] += 1
    for e in load("engaged.json"):
        t = e.get("type")
        d = day(e.get("date"))
        if t == "follow":
            d["follows"] += 1
        elif t == "comment":
            d["comments"] += 1
        elif t in ("like_back", "comment_like"):
            d["thanks_like"] += 1
        elif t == "reply":
            d["thanks_reply"] += 1
    for m in load("dm.json"):
        d = day(m.get("date"))
        d["ask_comments" if m.get("channel") == "comment" else "dms"] += 1
        if m.get("status") in ("yes", "posted"):
            day(permit_date(m))["new_permits"] += 1
    for f in load("feedback.json"):
        day(f.get("date"))["feedback"] += 1
    stats = {s["date"][:10]: s for s in load("stats.json")}
    for date in stats:
        day(date)
    for r in runs:
        if r["round"] in ("1차", "2차"):
            day(r["date"])
    links = {}
    for l in load("report_links.json"):
        links.setdefault(l["date"][:10], l)
    for date in links:
        day(date)

    out = []
    total = 0
    for date in sorted(k for k in days if k):
        d = days[date]
        total += d["new_permits"]
        d["permits_total"] = total
        s = stats.get(date, {})
        for k in ("followers", "following", "posts_total", "views_7d", "reached_7d", "interactions_7d", "profile_visits_7d"):
            src = "posts" if k == "posts_total" else k
            d[k] = s.get(src)
        for rnd, key in (("1차", "run1"), ("2차", "run2")):
            rr = [r for r in runs if r["date"] == date and r["round"] == rnd]
            d[key + "_n"] = len(rr)
            d[key + "_min"] = round(sum(r.get("minutes") or 0 for r in rr), 1) if rr else None
            d[key + "_cache_m"] = round(sum(r.get("cache_read") or 0 for r in rr) / 1e6, 1) if rr else None
            d[key + "_status"] = ", ".join(r.get("status", "") for r in rr)
        l = links.get(date)
        d["report_title"] = l.get("title", "") if l else ""
        d["report_url"] = l.get("url", "") if l else ""
        out.append(d)
    out.reverse()  # 최신이 위
    return out


if __name__ == "__main__":
    main()
