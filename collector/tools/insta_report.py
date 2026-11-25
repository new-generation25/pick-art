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
  metrics.json   {"rows": [...], "meta": [...]}  운영 지표. kind=summary(지표 하나 = 한 줄, 정의·현재 값·목표),
                 kind=day(날짜 하나 = 한 줄), kind=region·category(활성 행사 나눔). 공급 지표는 피카 DB events 를
                 frontend/.env.local 의 anon 키로 읽기만 한다(쓰지 않는다). KOPIS 수집 건수는 collector/logs/scheduled_*.log
                 (정기 수집 로그)의 「KOPIS 수집 완료: 경남 n · 부산 n건」 줄에서 읽는다(2026-11-26 추가)

사용: python tools/insta_report.py   (collector 폴더에서)
"""
import json
import os
import re
import statistics
import urllib.parse
import urllib.request
from datetime import date as _date, datetime, timedelta

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
    metrics = build_metrics(runs)
    with open(os.path.join(OUT, "metrics.json"), "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=1)
    print(f"activity {len(rows)}줄, stats {len(load('stats.json'))}줄, daily {len(daily)}줄, runs {len(runs)}줄, "
          f"metrics {len(metrics['rows'])}줄 → {OUT}")


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

    seen_posts = set()  # 순회공연은 회차마다 줄이 있고 게시물은 하나다 → 게시물 주소로 한 번만 센다
    for p in load("posted.json"):
        key = p.get("post_url") or id(p)
        if key in seen_posts:
            continue
        seen_posts.add(key)
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


# ---------------------------------------------------------------- 운영 지표 (metrics.json)

ENV = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env.local")
# 피카가 다루는 시군: 부산 1 + 경남 18. DB region 값과 같은 이름
SIGUNGU = ["부산", "창원", "진주", "통영", "사천", "김해", "밀양", "거제", "양산", "의령", "함안", "창녕",
           "고성", "남해", "하동", "산청", "함양", "거창", "합천"]
SMALL_POST_TARGET = 50   # 게시 소규모:공공 = 5:5 (운영매뉴얼 1.2)
POSTS_PER_DAY_TARGET = 10  # 하루 게시 목표 10 (대시보드 「그날 활동」 게시 칸)
PENDING_DAYS = 7         # 허락 댓글 7일 무응답 → none 으로 정리 (dm.json status 규칙)
STANDING_VISIT_DAYS = 30  # 상시 동의 계정은 한 달에 한 번 찾아간다 (insta_state.py standing-due)
LOGS = os.path.join(os.path.dirname(__file__), "..", "logs")  # 정기 수집 로그 scheduled_YYYYMMDD_HHMM.log
KOPIS_ZERO_STOP = 3       # KOPIS 0건이 3일 이어지면 멈춤 조건(갈무리 add_finding) — 1차·2차 SKILL 「멈춤」

# 지표 정의: id, 묶음, 이름, 무엇을 보나, 계산식, 출처, 좋은 방향, 목표·경고선(근거 없으면 「기준 정하기 필요」)
METRIC_DEFS = [
    ("active_events", "공급", "활성 행사 수", "지금 피카 앱에 보이는 행사의 양",
     "events 중 끝나는 날(없으면 시작일) ≥ 오늘", "피카 DB events", "높을수록", "기준 정하기 필요"),
    ("small_active", "공급", "소규모 활성 행사 수", "게시할 수 있는 허락받은 소규모 행사의 양",
     "활성 행사 중 ① posted.json 에 scale=소규모로 올린 event_id 이거나 ② original_url 게시물이 dm.json 허락(yes·posted) 기록의 게시물과 같은 것",
     "피카 DB events · posted.json · dm.json", "높을수록", "기준 정하기 필요 (참고: 목표대로면 하루 소규모 게시 5건)"),
    ("small_supply_pct", "공급", "소규모 공급 비율", "DB 안에서 소규모가 차지하는 몫",
     "소규모 활성 행사 수 ÷ 활성 행사 수 × 100", "피카 DB events", "높을수록", "기준 정하기 필요"),
    ("empty_regions", "공급", "행사 0건 시군 수", "소식이 하나도 없는 지역",
     "부산 + 경남 18 시군(19곳) 중 활성 행사가 0건인 곳의 수", "피카 DB events", "낮을수록", "기준 정하기 필요"),
    ("kopis_today", "공급", "KOPIS 오늘 수집 건수", "KOPIS 수집이 살아 있나(11/19~25 0건 장애, 0630a16 수정)",
     "오늘 정기 수집 로그의 「KOPIS 수집 완료: 경남 n · 부산 n건」 합(신규·중복 모두, 그날 마지막 실행). 로그가 없으면 빈 값",
     "collector/logs/scheduled_*.log", "0보다 크게", "경고: 0건"),
    ("kopis_zero_streak", "공급", "KOPIS 0건 연속 일수", "수집 장애가 이어지나",
     "오늘부터 거슬러 KOPIS 수집 건수가 0인 날이 이어진 수(로그 없는 날에서 끊는다)", "collector/logs/scheduled_*.log",
     "낮을수록", f"경고: {KOPIS_ZERO_STOP}일 이상(멈춤 조건 — 갈무리 add_finding)"),
    ("asks_7d", "깔때기", "허락 요청 수(7일)", "소규모 확보 깔때기의 입구",
     "최근 7일 dm.json 기록 수(허락 댓글 + DM, failed 제외)", "dm.json", "높을수록", "기준 정하기 필요"),
    ("reply_rate", "깔때기", "답 받은 비율(누적)", "허락 요청에 답이 오는가",
     "status 가 yes·no·posted 인 기록 ÷ 전체 요청(failed 제외) × 100. reply 칸에는 확인 메모도 들어 있어 쓰지 않는다", "dm.json", "높을수록", "기준 정하기 필요"),
    ("permit_rate", "깔때기", "허락 비율(누적)", "요청이 허락으로 이어지는가 (대시보드 「허락 깔때기 허락률」)",
     "status 가 yes·posted 인 기록 ÷ 전체 요청(failed 제외) × 100", "dm.json", "높을수록", "기준 정하기 필요"),
    ("permit_to_post_days", "깔때기", "허락 후 게시까지 일수(중앙값)", "허락받고 얼마나 빨리 올리나",
     "status=posted 기록의 (posted_url 게시 날짜 − 허락 날짜) 중앙값. 허락 날짜는 reply 글의 M.D(없으면 요청한 날)",
     "dm.json · posted.json", "낮을수록", "기준 정하기 필요"),
    ("standing_accounts", "깔때기", "상시 동의 계정 수", "다시 묻지 않고 올릴 수 있는 계정",
     "dm.json 에서 standing=true 이고 status 가 yes·posted 인 계정 수(중복 없이)", "dm.json", "높을수록", "기준 정하기 필요"),
    ("pending", "깔때기", "답 대기 건수", "아직 답이 없는 허락 요청",
     "status=sent(보냄·답 없음)인 기록 수", "dm.json", "낮을수록", "기준 정하기 필요"),
    ("pending_over7", "깔때기", "7일 넘은 답 대기", "정리해야 할 무응답 요청",
     "답 대기 중 요청한 지 7일이 지난 기록 수", "dm.json", "낮을수록", "경고: 1건 이상 (7일 무응답은 none 으로 정리하는 규칙)"),
    ("standing_due", "깔때기", "순회 지난 상시 동의 계정", "한 달에 한 번 찾아가기를 놓친 계정",
     "상시 동의 계정 중 standing_visits.json 마지막 방문이 30일 넘었거나 아직 안 간 계정 수", "dm.json · standing_visits.json",
     "낮을수록", "기준 정하기 필요 (하루 3계정씩 순회)"),
    ("standing_found", "깔때기", "순회에서 찾은 새 행사 수", "상시 동의 순회가 공급을 늘리는가",
     "standing_visits.json 의 found 합(계정마다 마지막 방문 기록만 남는다)", "standing_visits.json", "높을수록", "기준 정하기 필요"),
    ("posts_per_day", "게시", "하루 게시 수(7일 평균)", "게시량",
     "최근 7일 게시물 수(post_url 중복 없이) ÷ 7", "posted.json", "목표에 가깝게", f"목표 {POSTS_PER_DAY_TARGET}건"),
    ("small_post_pct", "게시", "게시 소규모 비율(7일)", "피카 목적(개인·소규모 소개)을 지키나",
     "최근 7일 소규모 게시 ÷ (소규모 + 공공 게시) × 100. scale 기록이 없는 게시는 빼고 「기록 누락」에 센다",
     "posted.json", "목표에 가깝게", f"목표 {SMALL_POST_TARGET}%"),
    ("coverage", "게시", "게시 커버리지", "활성 행사 중 인스타에 소개한 몫",
     "활성 행사 중 posted.json event_id 에 있는 수 ÷ 활성 행사 수 × 100", "피카 DB events · posted.json", "높을수록", "기준 정하기 필요"),
    ("lead_days", "게시", "게시 시점 행사까지 남은 일수(중앙값, 7일)", "너무 늦게 알리지 않나",
     "최근 7일 게시마다 (행사 시작일 − 게시일). 이미 시작한 행사는 0. DB에 있는 행사만", "posted.json · 피카 DB events",
     "기준 정하기 필요", "기준 정하기 필요"),
    ("dup_posts", "게시", "중복 게시 건수(누적)", "같은 행사를 두 번 올렸나",
     "event_id 하나에 서로 다른 post_url 이 2개 이상인 행사 수", "posted.json", "낮을수록", "목표 0 (중복은 오류)"),
    ("record_missing", "게시", "기록 누락 건수(누적)", "기록이 빠져 지표가 틀어지지 않나",
     "posted.json 에서 event_id·post_url·scale 중 하나가 빈 줄 + dm.json 에서 status=posted 인데 posted_url 이 빈 줄",
     "posted.json · dm.json", "낮을수록", "목표 0 (누락은 오류)"),
    ("followers_delta_7d", "반응·성장", "팔로워 7일 증감", "계정이 자라나",
     "마지막 기록의 followers − 7일 전(없으면 그보다 앞선 가장 가까운) 기록의 followers", "stats.json", "높을수록", "기준 정하기 필요"),
    ("views_7d", "반응·성장", "7일 조회수", "게시물이 보이는 양", "마지막 기록의 views_7d (인스타 인사이트)", "stats.json", "높을수록", "기준 정하기 필요"),
    ("reached_7d", "반응·성장", "7일 도달", "본 사람 수", "마지막 기록의 reached_7d", "stats.json", "높을수록", "기준 정하기 필요"),
    ("interactions_7d", "반응·성장", "7일 반응", "좋아요·댓글·저장·공유", "마지막 기록의 interactions_7d", "stats.json", "높을수록", "기준 정하기 필요"),
    ("profile_visits_7d", "반응·성장", "7일 프로필 방문", "피카 계정까지 들어오나", "마지막 기록의 profile_visits_7d", "stats.json", "높을수록", "기준 정하기 필요"),
    ("interactions_per_post", "반응·성장", "게시물당 반응(7일, 근사)", "게시물 하나가 얻는 반응",
     "7일 반응 ÷ 최근 7일 게시물 수. 인사이트 반응에는 옛 게시물 반응도 섞여 근사값", "stats.json · posted.json", "높을수록", "기준 정하기 필요"),
    ("thanks_rate", "반응·성장", "답례 처리율(7일, 근사)", "받은 반응에 답했나",
     "최근 7일 답례(engaged like_back·reply·comment_like) ÷ 받은 반응(feedback, 맞팔로우·follow 제외) × 100. 1:1로 잇지 않은 근사값",
     "engaged.json · feedback.json", "높을수록", "기준 정하기 필요"),
    ("min_per_run", "운영 효율", "실행당 분(7일, 1차·2차)", "예약 실행이 짧게 끝나나",
     "최근 7일 1차·2차 실행 minutes 평균", "runs.json", "낮을수록", "기준 정하기 필요"),
    ("cache_per_run_m", "운영 효율", "실행당 캐시 읽기 토큰(백만, 7일)", "실행 비용",
     "최근 7일 1차·2차 실행 cache_read 평균 ÷ 1,000,000", "runs.json", "낮을수록", "기준 정하기 필요"),
    ("tokens_per_post_m", "운영 효율", "게시 1건당 토큰(백만, 7일)", "게시 하나에 드는 비용",
     "최근 7일 모든 실행 cache_read 합 ÷ 최근 7일 게시물 수 ÷ 1,000,000", "runs.json · posted.json", "낮을수록", "기준 정하기 필요"),
]


def _db_events():
    """피카 DB events 를 anon 키로 읽기만 한다. 키 값은 출력하지 않는다. 실패하면 (None, 이유)."""
    try:
        env = {}
        with open(ENV, encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.lstrip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    env[k] = v.strip().strip('"').strip("'")
        url, key = env["NEXT_PUBLIC_SUPABASE_URL"], env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
        rows, off = [], 0
        sel = "id,region,category,event_date_start,event_date_end,original_url,created_at"
        while True:
            req = urllib.request.Request(f"{url}/rest/v1/events?select={sel}&order=id",
                                         headers={"apikey": key, "Authorization": "Bearer " + key,
                                                  "Range": f"{off}-{off + 999}", "User-Agent": "pick-art-insta-report"})
            with urllib.request.urlopen(req, timeout=60) as r:
                b = json.load(r)
            rows += b
            if len(b) < 1000:
                return rows, ""
            off += 1000
    except Exception as e:  # 키 값이 메시지에 섞이지 않게 종류만 남긴다
        return None, f"DB 읽기 실패: {type(e).__name__}"


def _kopis_by_day():
    """정기 수집 로그에서 날짜별 KOPIS 수집 건수(경남+부산, 그날 마지막 실행 값). 로그가 없으면 {}."""
    out = {}
    try:
        names = sorted(n for n in os.listdir(LOGS) if re.match(r"scheduled_\d{8}_\d{4}\.log$", n))
    except OSError:
        return out
    pat = re.compile(r"KOPIS 수집 완료: 경남 (\d+) · 부산 (\d+)건")
    for n in names:  # 이름 순 = 시각 순이라 같은 날 뒤 실행이 덮어쓴다
        try:
            with open(os.path.join(LOGS, n), encoding="utf-8-sig", errors="replace") as f:
                m = pat.search(f.read())
        except OSError:
            continue
        if m:
            out[f"{n[10:14]}-{n[14:16]}-{n[16:18]}"] = int(m.group(1)) + int(m.group(2))
    return out


def _post_code(u):
    m = re.search(r"instagram\.com/(?:[^/?#]+/)?(?:p|reel)/([^/?#]+)", u or "")
    return m.group(1) if m else None


def _pct(a, b):
    return round(a / b * 100, 1) if b else None


def build_metrics(runs):
    today = _date.today()
    T = today.isoformat()
    w_from = (today - timedelta(days=6)).isoformat()  # 최근 7일 = 오늘 포함 7일
    in7 = lambda d: w_from <= (d or "")[:10] <= T
    posted, dm, eng, fb = load("posted.json"), load("dm.json"), load("engaged.json"), load("feedback.json")
    stats = sorted(load("stats.json"), key=lambda s: s["date"])
    visits = load("standing_visits.json") or {}
    asks = [d for d in dm if d.get("status") != "failed"]
    permitted = [d for d in asks if d.get("status") in ("yes", "posted")]

    # 게시물 하나 = post_url 하나 (순회공연은 회차마다 줄이 있다)
    posts = {}
    for p in posted:
        k = p.get("post_url") or id(p)
        posts.setdefault(k, p)
    post_day = {k: (p.get("posted_at") or "")[:10] for k, p in posts.items()}

    # 피카 DB 공급
    events, db_err = _db_events()
    small_ids = {p["event_id"] for p in posted if p.get("scale") == "소규모" and p.get("event_id")}
    ok_codes = ({_post_code(d.get("post_url")) for d in permitted} | {_post_code(d.get("posted_url")) for d in permitted}) - {None}
    posted_ids = {p.get("event_id") for p in posted if p.get("event_id")}
    ev_by_id = {}
    if events is not None:
        for e in events:
            e["_end"] = (e.get("event_date_end") or e.get("event_date_start") or "")[:10]
            e["_small"] = e["id"] in small_ids or _post_code(e.get("original_url")) in ok_codes
            ev_by_id[e["id"]] = e

    def supply(d):
        if events is None:
            return None
        act = [e for e in events if e["_end"] >= d and (e.get("created_at") or "")[:10] <= d]
        small = [e for e in act if e["_small"]]
        regions = {e.get("region") for e in act}
        return {"active": len(act), "small": len(small), "empty": sum(1 for s in SIGUNGU if s not in regions), "act": act}

    sup_now = supply(T)
    kopis = _kopis_by_day()

    # 날짜별
    dates = set(post_day.values()) | {s["date"][:10] for s in stats} | {(d.get("date") or "")[:10] for d in dm}
    dates = sorted(d for d in dates if d and d <= T)
    if dates:  # 빈 날도 줄을 둔다
        d0 = _date.fromisoformat(dates[0])
        dates = [(d0 + timedelta(days=i)).isoformat() for i in range((today - d0).days + 1)]
    st_by = {s["date"][:10]: s for s in stats}
    rows, prev_f = [], None
    for d in dates:
        ks = [k for k, v in post_day.items() if v == d]
        sm = sum(1 for k in ks if posts[k].get("scale") == "소규모")
        pu = sum(1 for k in ks if posts[k].get("scale") == "공공")
        s = st_by.get(d, {})
        rr = [r for r in runs if r["date"] == d]
        r12 = [r for r in rr if r["round"] in ("1차", "2차")]
        cache = sum(r.get("cache_read") or 0 for r in rr)
        sp = supply(d)
        f_now = s.get("followers")
        fbn = sum(1 for f in fb if (f.get("date") or "")[:10] == d and f.get("kind") not in ("맞팔로우", "새 팔로워", "follow"))
        th = sum(1 for e in eng if (e.get("date") or "")[:10] == d and e.get("type") in ("like_back", "reply", "comment_like"))
        rows.append({
            "kind": "day", "id": "day:" + d, "date": d,
            "active_events": sp["active"] if sp else None, "small_active": sp["small"] if sp else None,
            "small_supply_pct": _pct(sp["small"], sp["active"]) if sp else None, "empty_regions": sp["empty"] if sp else None,
            "kopis": kopis.get(d),
            "posts": len(ks), "posts_small": sm, "posts_public": pu, "posts_unknown": len(ks) - sm - pu,
            "small_post_pct": _pct(sm, sm + pu),
            "asks": sum(1 for x in asks if (x.get("date") or "")[:10] == d),
            "new_permits": sum(1 for x in permitted if permit_date(x) == d),
            "followers": f_now, "followers_delta": (f_now - prev_f) if (f_now is not None and prev_f is not None) else None,
            "views_7d": s.get("views_7d"), "reached_7d": s.get("reached_7d"),
            "interactions_7d": s.get("interactions_7d"), "profile_visits_7d": s.get("profile_visits_7d"),
            "feedback": fbn, "thanks": th, "thanks_rate": _pct(th, fbn),
            "runs": len(rr), "run_min": round(sum(r.get("minutes") or 0 for r in r12), 1) if r12 else None,
            "run_cache_m": round(sum(r.get("cache_read") or 0 for r in r12) / 1e6, 1) if r12 else None,
            "tokens_per_post_m": round(cache / 1e6 / len(ks), 2) if (ks and rr) else None,
        })
        if f_now is not None:
            prev_f = f_now

    # 요약 값
    v = {}
    if sup_now:
        v["active_events"], v["small_active"], v["empty_regions"] = sup_now["active"], sup_now["small"], sup_now["empty"]
        v["small_supply_pct"] = _pct(sup_now["small"], sup_now["active"])
        v["coverage"] = _pct(sum(1 for e in sup_now["act"] if e["id"] in posted_ids), sup_now["active"])
    v["kopis_today"] = kopis.get(T)
    streak, d_ = 0, today
    while kopis.get(d_.isoformat()) == 0:
        streak += 1; d_ -= timedelta(days=1)
    v["kopis_zero_streak"] = streak if kopis else None
    v["asks_7d"] = sum(1 for x in asks if in7(x.get("date")))
    replied = [x for x in asks if x.get("status") in ("yes", "no", "posted")]  # reply 칸엔 확인 메모도 있다
    v["reply_rate"] = _pct(len(replied), len(asks))
    v["permit_rate"] = _pct(len(permitted), len(asks))
    by_url = {}
    for k, p in posts.items():
        c = _post_code(k if isinstance(k, str) else "")
        if c:
            by_url[c] = (p.get("posted_at") or "")[:10]
    gaps = []
    for x in dm:
        if x.get("status") == "posted" and _post_code(x.get("posted_url")) in by_url:
            pd_ = by_url[_post_code(x.get("posted_url"))]
            gaps.append(max(0, (_date.fromisoformat(pd_) - _date.fromisoformat(permit_date(x))).days))
    v["permit_to_post_days"] = statistics.median(gaps) if gaps else None
    standing = sorted({norm_acc(x["account"]) for x in permitted if x.get("standing")})
    v["standing_accounts"] = len(standing)
    pend = [x for x in asks if x.get("status") == "sent"]
    v["pending"] = len(pend)
    cut7 = (today - timedelta(days=PENDING_DAYS)).isoformat()
    v["pending_over7"] = sum(1 for x in pend if (x.get("date") or "")[:10] <= cut7)
    cut30 = (today - timedelta(days=STANDING_VISIT_DAYS)).isoformat()
    v["standing_due"] = sum(1 for a in standing if ((visits.get(a) or {}).get("at") or "") < cut30)
    v["standing_found"] = sum(int((visits.get(a) or {}).get("found") or 0) for a in visits)
    k7 = [k for k, d in post_day.items() if in7(d)]
    v["posts_per_day"] = round(len(k7) / 7, 1)
    sm7 = sum(1 for k in k7 if posts[k].get("scale") == "소규모")
    pu7 = sum(1 for k in k7 if posts[k].get("scale") == "공공")
    v["small_post_pct"] = _pct(sm7, sm7 + pu7)
    leads = []
    for k in k7:
        e = ev_by_id.get(posts[k].get("event_id"))
        if e and e.get("event_date_start"):
            leads.append(max(0, (_date.fromisoformat(e["event_date_start"][:10]) - _date.fromisoformat(post_day[k])).days))
    v["lead_days"] = statistics.median(leads) if leads else None
    urls_by_ev = {}
    for p in posted:
        if p.get("event_id") and p.get("post_url"):
            urls_by_ev.setdefault(p["event_id"], set()).add(p["post_url"])
    v["dup_posts"] = sum(1 for s in urls_by_ev.values() if len(s) > 1)
    v["record_missing"] = (sum(1 for p in posted if not (p.get("event_id") and p.get("post_url") and p.get("scale")))
                           + sum(1 for x in dm if x.get("status") == "posted" and not x.get("posted_url")))
    if stats:
        last = stats[-1]
        base_day = (_date.fromisoformat(last["date"][:10]) - timedelta(days=7)).isoformat()
        earlier = [s for s in stats if s["date"][:10] <= base_day] or stats[:1]
        v["followers_delta_7d"] = last["followers"] - earlier[-1]["followers"]
        for k in ("views_7d", "reached_7d", "interactions_7d", "profile_visits_7d"):
            v[k] = last.get(k)
        v["interactions_per_post"] = round(last["interactions_7d"] / len(k7), 1) if (k7 and last.get("interactions_7d") is not None) else None
        stats_last, stats_base = last["date"][:10], earlier[-1]["date"][:10]
    else:
        stats_last = stats_base = ""
    fb7 = sum(1 for f in fb if in7(f.get("date")) and f.get("kind") not in ("맞팔로우", "새 팔로워", "follow"))
    th7 = sum(1 for e in eng if in7(e.get("date")) and e.get("type") in ("like_back", "reply", "comment_like"))
    v["thanks_rate"] = _pct(th7, fb7)
    r7 = [r for r in runs if in7(r["date"])]
    r12 = [r for r in r7 if r["round"] in ("1차", "2차")]
    v["min_per_run"] = round(statistics.mean(r.get("minutes") or 0 for r in r12), 1) if r12 else None
    v["cache_per_run_m"] = round(statistics.mean((r.get("cache_read") or 0) for r in r12) / 1e6, 1) if r12 else None
    v["tokens_per_post_m"] = round(sum(r.get("cache_read") or 0 for r in r7) / 1e6 / len(k7), 2) if k7 else None

    units = {"small_supply_pct": "%", "reply_rate": "%", "permit_rate": "%", "small_post_pct": "%", "coverage": "%",
             "thanks_rate": "%", "permit_to_post_days": "일", "lead_days": "일", "min_per_run": "분",
             "cache_per_run_m": "백만", "tokens_per_post_m": "백만", "posts_per_day": "건", "kopis_today": "건",
             "kopis_zero_streak": "일"}
    windows = {"asks_7d": "7일", "posts_per_day": "7일", "small_post_pct": "7일", "lead_days": "7일",
               "followers_delta_7d": f"{stats_base}~{stats_last}", "interactions_per_post": "7일", "thanks_rate": "7일",
               "min_per_run": "7일", "cache_per_run_m": "7일", "tokens_per_post_m": "7일",
               "reply_rate": "누적", "permit_rate": "누적", "permit_to_post_days": "누적", "dup_posts": "누적",
               "record_missing": "누적", "standing_found": "누적"}
    for k in ("views_7d", "reached_7d", "interactions_7d", "profile_visits_7d"):
        windows[k] = f"{stats_last} 기록"

    def status(mid, val):
        if val is None:
            return "none"
        if mid == "small_post_pct":
            return "ok" if val >= SMALL_POST_TARGET else "warn"
        if mid == "posts_per_day":
            return "ok" if val >= POSTS_PER_DAY_TARGET else "warn"
        if mid in ("dup_posts", "record_missing", "pending_over7"):
            return "ok" if val == 0 else "warn"
        if mid == "kopis_today":
            return "ok" if val > 0 else "warn"
        if mid == "kopis_zero_streak":
            return "ok" if val < KOPIS_ZERO_STOP else "warn"
        return "none"  # 기준이 없는 지표는 칠하지 않는다

    summary = []
    for mid, grp, name, what, formula, src, good, target in METRIC_DEFS:
        val = v.get(mid)
        summary.append({"kind": "summary", "id": mid, "group": grp, "name": name, "value": val,
                        "unit": units.get(mid, ""), "window": windows.get(mid, f"{T} 기준"),
                        "what": what, "formula": formula, "source": src, "direction": good, "target": target,
                        "status": status(mid, val)})
    # 활성 행사 나눔(지역·분야)
    parts = []
    if sup_now:
        for col, kind in (("region", "region"), ("category", "category")):
            cnt, smc = {}, {}
            for e in sup_now["act"]:
                key = e.get(col) or "(없음)"
                cnt[key] = cnt.get(key, 0) + 1
                smc[key] = smc.get(key, 0) + (1 if e["_small"] else 0)
            names = SIGUNGU if kind == "region" else sorted(cnt, key=lambda x: -cnt[x])
            for nm in names + [n for n in cnt if kind == "region" and n not in SIGUNGU]:
                parts.append({"kind": kind, "id": f"{kind}:{nm}", "label": nm, "active": cnt.get(nm, 0), "small": smc.get(nm, 0),
                              "small_pct": _pct(smc.get(nm, 0), cnt.get(nm, 0))})
    rows.reverse()  # 최신 날이 위
    meta = [
        {"label": "만든 시각", "value": datetime.now().strftime("%Y-%m-%d %H:%M")},
        {"label": "기준일", "value": T},
        {"label": "최근 7일", "value": f"{w_from} ~ {T}"},
        {"label": "원본", "value": "피카 DB events(anon 읽기) · docs/insta/posted · dm · engaged · feedback · stats · runs · standing_visits .json · collector/logs/scheduled_*.log(KOPIS)"},
        {"label": "줄 종류", "value": "kind=summary 지표 하나 / kind=day 날짜 하나 / kind=region·category 활성 행사 나눔"},
        {"label": "날짜별 공급", "value": "그날까지 DB에 들어온(created_at) 행사 중 그날 끝나지 않은 것. 지운 행사는 빠진다"},
        {"label": "상태", "value": "ok/warn 은 근거 있는 목표·경고선이 있는 지표만. 나머지는 none"},
    ]
    if db_err:
        meta.append({"label": "공급 지표", "value": db_err})
    return {"rows": summary + parts + rows, "meta": meta}


def norm_acc(acc):
    acc = (acc or "").strip()
    return acc if acc.startswith("@") or not acc else "@" + acc


if __name__ == "__main__":
    main()
