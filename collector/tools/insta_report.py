"""인스타 활동 기록(docs/insta/*.json)을 리포트 대시보드용 데이터 파일로 묶는다.

입력 (docs/insta/):
  posted.json    게시: {event_id, title, region, posted_at, post_url, note?}
  engaged.json   팔로우·댓글: {date, type: follow|comment, account, role?, post_url?, text?, form?, saved?, note?}
  dm.json        DM: {date, account, post_url, event, text?, status: sent|yes|no|none, reply?}
  feedback.json  받은 반응: {date, kind, account, detail, link?}  (맞팔로우·댓글 답글·DM 답장·멘션 등)
  stats.json     계정 숫자: {date, followers, following, posts, note?}

출력 (docs/insta/report/):
  activity.json  {"rows": [...], "meta": [...]}  한 줄 = 활동 하나
  stats.json     {"rows": [...]}                 날짜별 계정 숫자

사용: python tools/insta_report.py   (collector 폴더에서)
"""
import json
import os
from datetime import datetime

BASE = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "insta")
OUT = os.path.join(BASE, "report")


def load(name):
    p = os.path.join(BASE, name)
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def main():
    rows = []
    for p in load("posted.json"):
        rows.append({"date": p.get("posted_at", ""), "kind": "게시", "account": "@picka.news",
                     "detail": f"{p.get('region', '')} · {p.get('title', '')}", "link": p.get("post_url", ""),
                     "result": p.get("note", "올림")})
    role_ko = {"official": "기관", "group": "단체", "artist": "예술인"}
    for e in load("engaged.json"):
        base = {"date": e["date"], "account": e["account"], "name": e.get("name", ""), "scale": e.get("scale", "")}
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
        rows.append({"date": d["date"], "kind": "허락요청" if d.get("channel") == "comment" else "DM", "account": d["account"], "name": d.get("name", ""), "scale": "소규모",
                     "detail": d.get("event", ""), "link": d.get("post_url", ""),
                     "result": status + (f" · 답: {d['reply']}" if d.get("reply") else "")})
    for f in load("feedback.json"):
        rows.append({"date": f["date"], "kind": "반응", "account": f["account"], "name": f.get("name", ""), "scale": "",
                     "detail": f"{f.get('kind', '')} · {f.get('detail', '')}", "link": f.get("link", ""), "result": f.get("kind", "")})
    for r in rows:
        r.setdefault("name", "")
        r.setdefault("scale", "")
    order = {"게시": 0, "팔로우": 1, "댓글": 2, "DM": 3, "허락요청": 3, "반응": 4, "답례": 5}
    rows.sort(key=lambda r: (r["date"], order.get(r["kind"], 9)), reverse=False)
    for i, r in enumerate(rows, 1):
        r["id"] = f"{r['date']}-{i:04d}"
    os.makedirs(OUT, exist_ok=True)
    meta = [{"label": "만든 시각", "value": datetime.now().strftime("%Y-%m-%d %H:%M")},
            {"label": "원본", "value": "docs/insta/posted.json · engaged.json · dm.json · feedback.json"}]
    with open(os.path.join(OUT, "activity.json"), "w", encoding="utf-8") as f:
        json.dump({"rows": rows, "meta": meta}, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "stats.json"), "w", encoding="utf-8") as f:
        json.dump({"rows": load("stats.json")}, f, ensure_ascii=False, indent=1)
    print(f"activity {len(rows)}줄, stats {len(load('stats.json'))}줄 → {OUT}")


if __name__ == "__main__":
    main()
