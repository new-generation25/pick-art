"""막히는 누리집(위험 사이트) 관리 — 운영자 2026-11-27 지시.

「막히는 사이트는 위험 사이트로 간주하고, 3회까지 시도 후 막히면 접근하지 않는다.
 위험 사이트 리스트로 등록하고 관리자 확인으로 남겨 둔다.」

- 정기 실행 한 번 = 시도 한 번. 차단(HTTP 401·403·406·429·451, 방화벽 안내 문구, 접속 거부·끊김·시간 초과)이면
  .cache/blocked_sites.json 의 그 주소(host) 연속 차단 수를 1 올리고, 성공하면 0으로 되돌린다.
- 연속 3회가 되면 그 host 를 쓰는 출처(whitelist, 인스타 제외)의 paused_reason 에 「위험 사이트」를 적는다.
  관리자 «출처» 화면에 «쉬는 중»과 이유로 보이고(«살펴볼 것» 묶음), main.py 는 paused_reason 이 있는 출처를 읽지 않는다.
  다시 돌리려면 관리자가 확인한 뒤 그 칸을 비운다(연속 차단 수는 등록할 때 0으로 돌려 두었다).
- 수집분을 공개할 때(publish_verified)도 쉬는 출처의 host 는 링크 확인을 하지 않고 건너뛴다.
"""
import json
import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

LIMIT = 3
BLOCK_CODES = {401, 403, 406, 429, 451}
# 방화벽·봇 차단 안내 화면에 나오는 말(정상 페이지에 잘 안 나오는 것만)
BLOCK_MARKERS = ("비정상적인 접근", "비정상 접근", "접근이 차단", "접근이 거부", "웹 방화벽", "웹방화벽",
                 "Web Application Firewall", "Request Rejected", "Request Blocked", "Access Denied")
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache", "blocked_sites.json")
KST = timezone(timedelta(hours=9))


class SiteBlocked(Exception):
    """누리집이 이 회선의 접근을 막았다(차단 응답 코드나 방화벽 안내 화면)"""


def host_of(url: str) -> str:
    h = (urlparse(url or "").hostname or "").lower()
    return h[4:] if h.startswith("www.") else h


def check_response(status: int, text: str = ""):
    """차단 응답이면 SiteBlocked 를 낸다. 안내 문구는 짧은 화면(방화벽 안내는 대개 짧다)에서만 본다"""
    if status in BLOCK_CODES:
        raise SiteBlocked(f"HTTP {status}")
    if text and len(text) < 20000:
        for m in BLOCK_MARKERS:
            if m in text:
                raise SiteBlocked(f"차단 안내 화면 «{m}»")


def _load():
    try:
        with open(STATE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save(state):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    with open(STATE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=1)


def pause_reason(reason: str, count: int = LIMIT, day: str = None) -> str:
    day = day or datetime.now(KST).date().isoformat()
    return (f"위험 사이트({day}): {count}회 연속 접근 차단({reason})"
            f" — 관리자 확인 전까지 접근하지 않음. 확인 뒤 이 칸을 비우면 다시 읽음")[:300]


def mark_risky(db, host: str, reason: str, count: int = LIMIT) -> list:
    """host 를 쓰는 출처(인스타 제외)의 paused_reason 에 위험 사이트를 적는다. 이미 쉬는 출처는 그대로 둔다. 바꾼 이름들을 돌려준다"""
    rows = db.supabase.table("whitelist").select("id,name,value,type,paused_reason").ilike("value", f"%{host}%").execute().data or []
    changed = []
    for r in rows:
        if r.get("type") == "instagram" or host_of(r.get("value")) != host or (r.get("paused_reason") or "").strip():
            continue
        db.supabase.table("whitelist").update({"paused_reason": pause_reason(reason, count)}).eq("id", r["id"]).execute()
        changed.append(r.get("name") or r.get("value"))
    return changed


def record(db, url: str, blocked: bool, reason: str = "") -> str:
    """정기 실행 한 번의 결과를 적는다. 3회째 차단이면 위험 사이트로 등록하고 보고용 한 줄을 돌려준다"""
    host = host_of(url)
    if not host:
        return ""
    state = _load()
    cur = state.get(host, {"fails": 0})
    if not blocked:
        if cur.get("fails"):
            state[host] = {"fails": 0, "last_ok": datetime.now(KST).isoformat(timespec="minutes")}
            _save(state)
        return ""
    cur["fails"] = int(cur.get("fails") or 0) + 1
    cur["last_block"] = datetime.now(KST).isoformat(timespec="minutes")
    cur["last_reason"] = reason
    note = f" (연속 차단 {cur['fails']}/{LIMIT})"
    if cur["fails"] >= LIMIT:
        names = mark_risky(db, host, reason, cur["fails"])
        cur["risky_since"] = datetime.now(KST).date().isoformat()
        cur["fails"] = 0  # 관리자가 쉬게 함을 풀면 다시 처음부터 센다
        note = f" ⛔ 위험 사이트로 등록 — 관리자 확인 전까지 접근 안 함({', '.join(names) or host})"
    state[host] = cur
    _save(state)
    return note


def paused_hosts(db) -> set:
    """쉬게 한 출처(인스타 제외)의 host 들 — 이 host 의 링크는 확인하지 않는다"""
    rows = db.supabase.table("whitelist").select("value,type,paused_reason").not_.is_("paused_reason", "null").execute().data or []
    return {host_of(r["value"]) for r in rows if r.get("type") != "instagram" and (r.get("paused_reason") or "").strip()}
