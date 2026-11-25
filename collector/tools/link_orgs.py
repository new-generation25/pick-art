"""공개 중인 행사에 단체(orgs)를 잇는다(specs/012). event_orgs(행사·단체·역할)를 채운다.

출처별 규칙
  KOPIS      raw_posts.content.ai_suggestion 의 host·organizer·planner·producer → 주최·주관·기획·제작.
             없으면 KOPIS 상세(pblprfr/{mt20id})를 불러 채우고, 그 값을 raw post 에도 적어 둔다(--apply 때만).
             이름에 재단·회관·문화원·시청·군청·구청·센터·공사(와 지자체 이름 등)가 있으면 기관, 아니면 단체.
  인스타그램 ai_suggestion.account(계정)·role → 계정 단체, 역할 게시. role 이 artist·group 이면 small(소규모).
             account 가 없으면 건너뛴다. 표시 이름은 whitelist 이름, 없으면 계정 이름.
  기관 누리집 출처 기관(events.source)이 곧 주최(기관). 여러 곳을 모아 싣는 출처(KOPIS·웹검색·행사일정 등)는 건너뛴다.

이름 맞추기: norm_name = 띄어쓰기·(재)/(사)/(주)/재단법인/사단법인·괄호·기호를 지우고 소문자로.
  인스타 계정은 '@계정'으로 따로 둔다(기관 이름과 섞이지 않게). 이름이 겹칠 만한 것은 검토 파일에 적는다.
같은 것을 다시 돌려도 늘지 않는다(orgs 는 norm_name, event_orgs 는 기본키로 겹치면 건너뜀).

쓰기는 collector/.env.local 의 service 키로 한다(RLS 우회).
사용: python tools/link_orgs.py [--dry-run | --apply]   (collector 폴더에서. 기본 --dry-run. 마지막 줄이 한 줄 요약)
검토 파일: collector/review/orgs_<오늘>.json (--apply: 오늘 만든 단체, 겹친 이름, 이상한 것)
          collector/review/orgs_<오늘>_dryrun.json (--dry-run: 만들 단체)
"""
import collections
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

import requests

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402
from kopis_scraper import ORG_TAGS, org_fields  # noqa: E402

KST = timezone(timedelta(hours=9))
KOPIS_DETAIL = "http://www.kopis.or.kr/openApi/restful/pblprfr/{}"
KOPIS_UA = {"User-Agent": "Mozilla/5.0"}  # KOPIS 가 기본 User-Agent 를 막는다
ROLE_OF = {"host": "주최", "organizer": "주관", "planner": "기획", "producer": "제작"}
SMALL_ROLES = ("artist", "group")

AGGREGATOR_EXACT = {"KOPIS", "웹검색", "인스타그램"}
AGGREGATOR_PARTS = ("행사일정", "행사·축제", "문화예술행사정보", "비짓부산", "블로그")
# 한 출처에 두 기관이 섞인 경우: 행사 장소로 가른다
SPLIT_SOURCES = {"부산문화회관·부산시민회관": (("시민회관", "부산시민회관"), ("", "부산문화회관"))}

INSTITUTION_WORDS = ("재단", "회관", "문화원", "시청", "군청", "구청", "센터", "공사",
                     "교육청", "미술관", "박물관", "진흥원", "공단", "도청", "체육관광부")
# 지자체 이름 그대로(경상남도·부산광역시·밀양시·의령군·부산진구). 단체 이름이 '…군'으로 끝나는 것(극단 예군)은 뺀다
LOCAL_GOV = re.compile(r"^([가-힣]{2,4}(특별시|광역시|특별자치시|특별자치도|도)|[가-힣]{1,4}(시|군|구))$")
NOT_GOV = re.compile(r"^(극단|밴드|무용단|합창단|악단|팀|예술단|오케스트라)")
LEGAL = re.compile(r"\((재|사|주|유|합|사단|재단)\)|㈜|㈔|재단법인|사단법인|주식회사|유한회사")
EMPTY_NAMES = {"", "-", "없음", "미정", "해당없음"}


def norm_name(name: str) -> str:
    s = LEGAL.sub("", name or "")
    s = re.sub(r"[^0-9A-Za-z가-힣]", "", s)  # 띄어쓰기·괄호·기호
    return s.lower()


def org_kind(name: str) -> str:
    n = re.sub(r"\s", "", LEGAL.sub("", name))
    if any(w in n for w in INSTITUTION_WORDS) or (LOCAL_GOV.match(n) and not NOT_GOV.match(n)):
        return "기관"
    return "단체"


def split_names(value: str):
    """'(재)밀양문화관광재단, 밀양시' -> 두 이름. 괄호 안의 쉼표는 자르지 않는다."""
    parts, buf, depth = [], "", 0
    for ch in value or "":
        if ch in "([":
            depth += 1
        elif ch in ")]" and depth:
            depth -= 1
        if ch in ",，;/" and depth == 0:
            parts.append(buf); buf = ""
        else:
            buf += ch
    parts.append(buf)
    return [p.strip() for p in parts if p.strip() not in EMPTY_NAMES and norm_name(p)]


def mt20id_of(raw):
    for v in (raw.get("source_id") or "", raw.get("source_url") or ""):
        m = re.search(r"PF\d+", v)
        if m:
            return m.group(0)
    return None


# 미리보기에서 부른 상세를 적용 때 다시 부르지 않도록 그날 하루만 임시 폴더에 둔다
CACHE = os.path.join(os.environ.get("TEMP") or "/tmp", f"pickart_kopis_orgs_{datetime.now(KST):%Y%m%d}.json")


def load_cache():
    try:
        with open(CACHE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def fetch_kopis(mt20id):
    key = os.getenv("KOPIS_API_KEY")
    r = requests.get(KOPIS_DETAIL.format(mt20id), params={"service": key}, headers=KOPIS_UA, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}")
    d = ET.fromstring(r.text).find("db")
    if d is None:
        raise RuntimeError("상세 없음")
    return org_fields(d)


def handle_of(account: str) -> str:
    a = (account or "").strip().lstrip("@")
    m = re.search(r"instagram\.com/([^/?#]+)", a)
    return (m.group(1) if m else a).strip("/").lower()


def page_all(q_fn):
    out, off = [], 0
    while True:
        rows = q_fn().range(off, off + 999).execute().data or []
        out += rows
        if len(rows) < 1000:
            return out
        off += 1000


def main():
    apply = "--apply" in sys.argv
    db = Database()
    sb = db.supabase
    today = datetime.now(KST).strftime("%Y-%m-%d")

    events = page_all(lambda: sb.table("events").select("id,title,source,venue,raw_post_id")
                      .eq("status", "PUBLISHED").gte("event_date_end", today).order("id"))
    raw_ids = sorted({e["raw_post_id"] for e in events if e["raw_post_id"]})
    raws = {}
    for i in range(0, len(raw_ids), 100):
        for r in sb.table("raw_posts").select("id,source,source_id,source_url,content") \
                .in_("id", raw_ids[i:i + 100]).execute().data or []:
            raws[r["id"]] = r
    wl = {}
    for w in page_all(lambda: sb.table("whitelist").select("value,name").eq("type", "instagram").order("value")):
        h = handle_of(w["value"])
        if h and w.get("name"):
            wl[h] = w["name"].strip()

    orgs = {}        # norm -> {names: Counter, kinds: set, insta_handle, small, events:set}
    links = set()    # (event_id, norm, role)
    odd = collections.defaultdict(list)
    skipped = collections.Counter()
    kopis_total = kopis_with = kopis_fetched = 0
    writebacks = []  # (raw, fields)
    cache = load_cache()

    def add(event_id, name, kind, role, handle=None, small=False, norm=None):
        nn = norm or norm_name(name)
        o = orgs.setdefault(nn, {"names": collections.Counter(), "kinds": set(), "insta_handle": handle,
                                 "small": False, "events": set()})
        o["names"][name.strip()] += 1
        o["kinds"].add(kind)
        o["small"] = o["small"] or small
        o["events"].add(event_id)
        links.add((event_id, nn, role))

    for e in events:
        raw = raws.get(e["raw_post_id"]) or {}
        sug = ((raw.get("content") or {}).get("ai_suggestion") or {})
        src = e["source"] or ""
        if src == "KOPIS":
            kopis_total += 1
            fields = {k: sug[k] for k, _ in ORG_TAGS if (sug.get(k) or "").strip()}
            if not fields and not sug.get("org_checked") and raw:
                mt = mt20id_of(raw)
                if not mt:
                    odd["kopis_no_mt20id"].append(e["title"]); continue
                try:
                    if mt in cache:
                        fields = cache[mt]
                    else:
                        fields = cache[mt] = fetch_kopis(mt)
                        kopis_fetched += 1
                        time.sleep(0.3)
                    writebacks.append((raw, fields))
                except Exception as ex:  # noqa: BLE001
                    odd["kopis_fetch_fail"].append(f"{mt} {e['title']}: {ex}")
                    time.sleep(0.3)
            names_here = 0
            for k, role in ROLE_OF.items():
                for n in split_names(fields.get(k, "")):
                    add(e["id"], n, org_kind(n), role); names_here += 1
            if names_here:
                kopis_with += 1
            else:
                odd["kopis_no_org"].append(e["title"])
        elif src == "인스타그램":
            h = handle_of(sug.get("account"))
            if not h:
                skipped["인스타 계정 없음"] += 1; continue
            author = handle_of(sug.get("author"))
            if author and author != h:
                odd["insta_author_differs"].append(f"account={h} author={author}: {e['title']}")
            add(e["id"], wl.get(h, h), "계정", "게시", handle=h,
                small=(sug.get("role") in SMALL_ROLES), norm="@" + h)
        elif src in AGGREGATOR_EXACT or any(p in src for p in AGGREGATOR_PARTS) or not src:
            skipped[f"모음 출처: {src or '(없음)'}"] += 1
        else:
            name = src
            if src in SPLIT_SOURCES:
                name = next(n for word, n in SPLIT_SOURCES[src] if word in (e["venue"] or ""))
            add(e["id"], name, "기관", "주최")

    if kopis_fetched:
        with open(CACHE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False)

    # 이미 있는 단체
    existing = {o["norm_name"]: o for o in page_all(
        lambda: sb.table("orgs").select("id,norm_name,name,kind").order("norm_name"))}

    created, merges = [], []
    rows = []
    for nn, o in sorted(orgs.items()):
        name = sorted(o["names"].items(), key=lambda kv: (-kv[1], len(kv[0]), kv[0]))[0][0]
        kind = "계정" if "계정" in o["kinds"] else ("기관" if "기관" in o["kinds"] else "단체")
        if len(o["names"]) > 1:
            plain = {re.sub(r"\s", "", LEGAL.sub("", n)) for n in o["names"]}
            merges.append({"norm_name": nn, "names": dict(o["names"]), "kept": name,
                           "only_prefix_or_space": len(plain) == 1})
        if len(o["kinds"]) > 1:
            odd["kind_conflict"].append(f"{name}: {sorted(o['kinds'])} → {kind}")
        if nn not in existing:
            rows.append({"name": name[:120], "norm_name": nn, "kind": kind,
                         "insta_handle": o["insta_handle"], "small": o["small"]})
            created.append({**rows[-1], "events": len(o["events"])})
    # 계정 표시 이름과 기관·단체 이름이 같은 것(같은 곳일 수 있음 → 운영자 확인)
    plain_norms = {nn for nn in orgs if not nn.startswith("@")}
    for nn, o in orgs.items():
        if nn.startswith("@"):
            label = norm_name(next(iter(o["names"])))
            if label in plain_norms:
                merges.append({"norm_name": nn, "names": dict(o["names"]), "kept": "따로 둠",
                               "same_as_org": label, "only_prefix_or_space": False})

    # 한 이름이 다른 이름을 품는 것(같은 곳의 다른 표기일 수 있음 → 운영자 확인, 합치지 않음)
    plain = sorted(n for n in plain_norms if len(n) >= 4)
    for a in plain:
        for b in plain:
            if a != b and a in b:
                odd["name_contains"].append(f"{orgs[a]['names'].most_common(1)[0][0]} ⊂ {orgs[b]['names'].most_common(1)[0][0]}")

    by_kind = collections.Counter(r["kind"] for r in rows)
    by_role = collections.Counter(role for _, _, role in links)
    small_n = sum(1 for o in orgs.values() if o["small"])

    written_orgs = written_links = written_raw = 0
    if apply:
        for i in range(0, len(rows), 200):
            sb.table("orgs").upsert(rows[i:i + 200], on_conflict="norm_name", ignore_duplicates=True,
                                    returning="minimal").execute()
        written_orgs = len(rows)
        ids = {o["norm_name"]: o["id"] for o in page_all(
            lambda: sb.table("orgs").select("id,norm_name").order("norm_name"))}
        link_rows = [{"event_id": ev, "org_id": ids[nn], "role": role}
                     for ev, nn, role in sorted(links) if nn in ids]
        missing = len(links) - len(link_rows)
        if missing:
            odd["link_without_org"].append(f"{missing}건")
        for i in range(0, len(link_rows), 500):
            sb.table("event_orgs").upsert(link_rows[i:i + 500], on_conflict="event_id,org_id,role",
                                          ignore_duplicates=True, returning="minimal").execute()
        written_links = len(link_rows)
        for raw, fields in writebacks:
            content = raw.get("content") or {}
            sug = dict(content.get("ai_suggestion") or {})
            sug.update(fields)
            sug["org_checked"] = today
            content["ai_suggestion"] = sug
            sb.table("raw_posts").update({"content": content}).eq("id", raw["id"]).execute()
            written_raw += 1
        if os.path.exists(CACHE):  # raw post 에 적었으니 임시 저장은 지운다
            os.remove(CACHE)

    # 오늘 만든 단체(다시 돌려도 목록이 비지 않게 DB 의 created_at 으로 가린다)
    if apply:
        made = page_all(lambda: sb.table("orgs").select("id,name,norm_name,kind,insta_handle,small,created_at")
                        .gte("created_at", f"{today}T00:00:00+09:00").order("norm_name"))
        created = [{**{k: m[k] for k in ("id", "name", "norm_name", "kind", "insta_handle", "small")},
                    "events": len(orgs[m["norm_name"]]["events"]) if m["norm_name"] in orgs else 0} for m in made]

    top = sorted(orgs.items(), key=lambda kv: -len(kv[1]["events"]))[:15]
    review = {
        "generated_at": datetime.now(KST).isoformat(timespec="seconds"),
        "mode": "apply" if apply else "dry-run",
        "events": len(events),
        "kopis": {"total": kopis_total, "with_org": kopis_with, "fetched_from_api": kopis_fetched},
        "orgs_new_by_kind": dict(by_kind),
        "event_orgs_by_role": dict(by_role),
        "small_accounts": small_n,
        "skipped": dict(skipped),
        "top_orgs": [{"name": orgs[nn]["names"].most_common(1)[0][0], "events": len(o["events"])} for nn, o in top],
        "ambiguous_merges": merges,
        "odd": {k: v for k, v in odd.items()},
        "created_orgs": created,
    }
    os.makedirs("review", exist_ok=True)
    path = os.path.join("review", f"orgs_{today}.json" if apply else f"orgs_{today}_dryrun.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(review, f, ensure_ascii=False, indent=1)

    print(f"공개·진행 행사 {len(events)}건 · KOPIS 상세 조회 {kopis_fetched}회(임시 저장 재사용 {len(writebacks) - kopis_fetched}건)")
    print(f"새 단체 {len(rows)}개: " + ", ".join(f"{k} {v}" for k, v in sorted(by_kind.items())))
    print("연결: " + ", ".join(f"{k} {v}" for k, v in sorted(by_role.items())))
    print(f"건너뜀: " + ", ".join(f"{k} {v}" for k, v in skipped.most_common()))
    print(f"이름 겹침 {len(merges)}건 · 이상 " + ", ".join(f"{k} {len(v)}" for k, v in odd.items()))
    print(f"검토 파일: {path}")
    pct = round(100 * kopis_with / kopis_total) if kopis_total else 0
    if apply:
        print(f"✅ 단체 연결 적용: 단체 {written_orgs}개 추가, 연결 {written_links}건(겹치면 건너뜀), "
              f"raw post {written_raw}건 보강, KOPIS 주최·주관 채움 {kopis_with}/{kopis_total}({pct}%), 소규모 {small_n}")
    else:
        print(f"🔎 단체 연결 미리보기(쓰지 않음): 새 단체 {len(rows)}개, 연결 {len(links)}건, "
              f"KOPIS 채움 {kopis_with}/{kopis_total}({pct}%), 소규모 {small_n} — 적용은 --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
