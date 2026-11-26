"""카카오톡 채널 제보의 «이미지 읽기» 자체 검증 (specs/017, 운영자 11/27 «검증을 네가 스스로 하는 코드를 만들어서 테스트하고 수정해»).

정답이 있는 사진으로 카카오 제보와 같은 길을 밟게 하고, 예약작업이 읽은 칸을 정답과 맞춰 채점한다.
  정답: 운영 DB 에 이미 공개된 행사(events, PUBLISHED, 포스터 있음)의 제목·날짜·장소·지역
  사진: 그 포스터를 휴대폰으로 찍은 것처럼 바꾼다(기울기·원근·밝기·흐림·저용량 압축 중 하나) → 서버와 같게 긴 변 2048px JPEG
  길: 익명 키 + 스킬 비밀값으로 kakao_intake(agree → start → image) → 익명으로 leaflets/kakao/<id>.jpg 업로드
      (서버 /api/kakao/skill 이 하는 일 그대로. 카카오 사진 주소를 내려받는 단계만 빠진다 — 그 단계는 kakaocdn 주소만 받으므로
       시험용 사진을 올릴 수 없다. 운영자 휴대폰 시험으로 확인함: verification.md)
  읽기: 평소처럼 `leaflet_queue.py --pending` → 지시문(prompts/leaflet_read.md)대로 읽기 → `--save`
  채점: 칸마다 맞음 / 비움 / **틀림**. 틀림(정답과 다른 값을 채움)이 가장 나쁘다(헌장 I: 확인한 정보만)

사용 (collector 폴더에서, PYTHONIOENCODING=utf-8)
  python tools/kakao_read_check.py make [--n 8] [--seed 1]      시험 제보를 만들고 .cache/kakao_check/<run>.json 에 정답을 적는다
  python tools/kakao_read_check.py score <run.json> [--md out.md] 읽힌 결과를 채점한다(아직 안 읽힌 것은 «대기»)
  python tools/kakao_read_check.py cleanup <run.json>             시험 제보 줄·버킷 파일·시험 보낸 사람 동의 기록을 지운다
"""
import argparse
import hashlib
import io
import json
import os
import random
import re
import sys
import urllib.request
import uuid
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402

load_dotenv(".env.local")
if not os.environ.get("KAKAO_SKILL_KEY") and ".claude" in HERE:  # 작업 폴더(worktree)면 본 저장소의 비밀값 파일을 쓴다
    load_dotenv(os.path.join(HERE.split(os.sep + ".claude" + os.sep)[0], "collector", ".env.local"))

RUN_DIR = os.path.join(HERE, ".cache", "kakao_check")
RIGHTS = "r1-2026-11-26"
PER_USER = 4
UA = "Mozilla/5.0 (pica kakao_read_check)"


# ---------- 채점 (순수 함수, 시험 가능) ----------

def norm(s):
    """비교용: 소문자, 한글·영문·숫자만"""
    return re.sub(r"[^0-9a-z가-힣]", "", (s or "").lower())


def bigrams(s):
    return {s[i:i + 2] for i in range(len(s) - 1)} if len(s) > 1 else {s}


def words(s):
    return [w for w in re.findall(r"[0-9a-z가-힣]+", (s or "").lower()) if len(w) >= 2]


def similar(a, b, need=0.5):
    """한쪽이 다른 쪽을 포함하거나, 짧은 쪽의 낱말이 모두 긴 쪽에 들어 있거나(«진주성 중영» ⊂ «진주성 공북문앞 중영»),
    두 글자 묶음 겹침(자카드)이 need 이상이면 같은 것으로 본다"""
    wa, wb = words(a), words(b)
    a, b = norm(a), norm(b)
    if not a or not b:
        return False
    if a in b or b in a:
        return True
    short, long_ = (wa, b) if len(a) <= len(b) else (wb, a)
    if short and all(w in long_ for w in short):
        return True
    A, B = bigrams(a), bigrams(b)
    return len(A & B) / len(A | B) >= need


TAG = re.compile(r"\s*\[[^\]]{1,10}\]\s*$")   # KOPIS 제목 끝의 «[부산]» 같은 지역 꼬리표


def hangul(s):
    return "".join(re.findall(r"[가-힣0-9]+", s or ""))


def judge_text(ai_value, truth, need=0.5):
    if not ai_value:
        return "empty"
    if not truth:
        return "unknown"
    truth = TAG.sub("", truth)
    if similar(ai_value, truth, need):
        return "ok"
    ha, ht = hangul(ai_value), hangul(truth)   # «열린음악회 The Jazz» ↔ «<열린 음악회>»: 한글 부분끼리
    return "ok" if len(ha) >= 3 and len(ht) >= 3 and (ha in ht or ht in ha) else "wrong"


def judge_dates(ai_start, ai_end, t_start, t_end):
    """날짜: 저장된 date_start/date_end(--save 가 규칙 파서로 만든 값) 를 정답과 맞춘다"""
    if not ai_start:
        return "empty"
    if ai_start == t_start and (ai_end or ai_start) == (t_end or t_start):
        return "ok"
    if ai_start == t_start:
        return "start_ok"   # 시작은 맞고 끝이 다름(연장 공연·회차 표기 등) — 사람이 볼 것
    return "wrong"


REGIONS = ["창원", "김해", "진주", "통영", "거제", "양산", "밀양", "사천", "함안", "고성", "합천", "거창", "함양",
           "창녕", "의령", "남해", "하동", "산청", "부산"]
# frontend/src/lib/regions.ts regionFromText 와 같은 규칙(다른 도시에도 있는 구 이름은 뺌)
DISTRICT_REGION = {**{d: "부산" for d in ["영도구", "부산진구", "동래구", "해운대구", "사하구", "금정구", "연제구", "수영구",
                                          "사상구", "기장군", "해운대", "기장"]},
                   **{d: "창원" for d in ["성산구", "의창구", "마산합포구", "마산회원구", "진해구", "마산", "진해"]}}


def region_from_text(text):
    t = re.sub(r"\s+", "", text or "")
    if not t:
        return None
    for r in REGIONS:
        if r in t:
            return r
    for k in sorted(DISTRICT_REGION, key=len, reverse=True):
        if k in t:
            return DISTRICT_REGION[k]
    return None


def judge_region(ai_value, truth):
    """ai_value: 운영자 화면이 채우는 지역 이름(이미 region_from_text·장소 목록을 거친 값)"""
    if not ai_value:
        return "empty"
    if not truth:
        return "unknown"
    return "ok" if ai_value == truth else "wrong"


FIELDS = ("title", "dates", "venue", "region")


def score_item(ai, truth):
    """ai: leaflet_submissions.ai_result, truth: 정답(events 줄). 칸마다 판정 문자열"""
    if not ai:
        return {"state": "pending"}
    if ai.get("error"):
        return {"state": "failed", "error": ai["error"]}
    v = lambda k: ((ai.get(k) or {}).get("value") if isinstance(ai.get(k), dict) else None)  # noqa: E731
    return {
        "state": "read",
        "title": judge_text(v("title"), truth["title"], 0.45),
        "dates": judge_dates(ai.get("date_start"), ai.get("date_end"), truth["start"], truth["end"]),
        "venue": judge_text(v("venue"), truth["venue"], 0.4),
        # 지역은 운영자 화면이 채우는 값으로 본다: 인쇄된 시·군, 없으면 장소 목록에서 찾은 장소의 지역(venue_match)
        "region": judge_region(region_from_text(v("region_hint")) or ((ai.get("venue_match") or {}).get("region")), truth["region"]),
    }


def summarize(results):
    out = {"total": len(results), "read": 0, "failed": 0, "pending": 0}
    for f in FIELDS:
        out[f] = {}
    for r in results:
        s = r["score"]
        out[s["state"]] = out.get(s["state"], 0) + 1
        if s["state"] != "read":
            continue
        for f in FIELDS:
            out[f][s[f]] = out[f].get(s[f], 0) + 1
    return out


# ---------- 휴대폰 사진처럼 바꾸기 ----------

def phone_photo(raw, variant, rnd):
    """포스터 → 휴대폰으로 찍은 듯한 사진. 서버(route.ts toJpeg)처럼 긴 변 2048px JPEG 으로 끝낸다(EXIF 없음)"""
    from PIL import Image, ImageEnhance, ImageFilter
    im = Image.open(io.BytesIO(raw))
    im.seek(0)
    im = im.convert("RGB")
    if variant == "tilt":        # 책상에 놓고 비스듬히: 회전 + 원근 + 배경
        w, h = im.size
        pad = int(max(w, h) * 0.08)
        bg = Image.new("RGB", (w + 2 * pad, h + 2 * pad), tuple(rnd.randint(150, 200) for _ in range(3)))
        bg.paste(im, (pad, pad))
        im = bg.rotate(rnd.uniform(-5, 5), resample=Image.BICUBIC, expand=False, fillcolor=(170, 170, 165))
        W, H = im.size
        d = int(min(W, H) * rnd.uniform(0.03, 0.06))
        quad = (rnd.randint(0, d), rnd.randint(0, d), rnd.randint(0, d), H - rnd.randint(0, d),
                W - rnd.randint(0, d), H - rnd.randint(0, d), W - rnd.randint(0, d), rnd.randint(0, d))
        im = im.transform((W, H), Image.QUAD, quad, resample=Image.BICUBIC)
        im = ImageEnhance.Brightness(im).enhance(rnd.uniform(0.82, 1.05))
        q = 75
    elif variant == "dim":       # 실내 조명 + 살짝 흔들림. 사람이 읽을 수 있는 정도(11/27 운영자 «왜 보이지 않는 포스터로 테스트를 해»)
        im = ImageEnhance.Brightness(im).enhance(rnd.uniform(0.85, 0.95))
        im = ImageEnhance.Contrast(im).enhance(0.92)
        im = im.filter(ImageFilter.GaussianBlur(rnd.uniform(0.3, 0.6)))
        q = 75
    elif variant == "small":     # 카카오톡 «저용량» 전송처럼 작게(긴 변 1280px)
        im.thumbnail((1280, 1280), Image.LANCZOS)
        q = 65
    else:                        # clean: 다시 압축만
        q = 80
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=q)
    im = Image.open(io.BytesIO(buf.getvalue())).convert("RGB")
    im.thumbnail((2048, 2048), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, "JPEG", quality=88)
    return out.getvalue()


VARIANTS = ("tilt", "dim", "small", "clean")
MIN_SOURCE_EDGE = 800   # 원본 포스터 긴 변이 이보다 작으면 쓰지 않는다(KOPIS 썸네일 182px 같은 것은 휴대폰 사진과 거리가 멀다)


def readable_source(raw, min_edge=MIN_SOURCE_EDGE):
    """사람이 글자를 읽을 수 있을 만한 원본인가(긴 변 min_edge px 이상)"""
    from PIL import Image
    try:
        im = Image.open(io.BytesIO(raw))
        return max(im.size) >= min_edge
    except Exception:
        return False


# ---------- DB ----------

def clients():
    from supabase import create_client
    url = os.environ["SUPABASE_URL"]
    anon = create_client(os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or url, os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"])
    svc = create_client(url, os.environ["SUPABASE_KEY"])
    return anon, svc


def sender_key(user):
    return hashlib.sha256(("pica-kakao:" + user).encode()).hexdigest()


def pick_events(svc, n, rnd):
    today = datetime.now(timezone.utc).date().isoformat()
    rows = (svc.table("events").select("id,title,event_date_start,event_date_end,venue,region,poster_image_url,poster_placeholder,source")
            .eq("status", "PUBLISHED").not_.is_("poster_image_url", "null").gte("event_date_end", today)
            .limit(2000).execute().data)
    by_src = {}
    for r in rows:
        if r.get("poster_placeholder"):
            continue
        by_src.setdefault(r.get("source") or "", []).append(r)
    for v in by_src.values():
        rnd.shuffle(v)
    srcs = sorted(by_src, key=lambda s: -len(by_src[s]))
    picked, i = [], 0
    while len(picked) < n and any(by_src.values()):   # 출처를 돌아가며 한 장씩(KOPIS 만 몰리지 않게)
        s = srcs[i % len(srcs)]
        if by_src[s]:
            picked.append(by_src[s].pop())
        i += 1
    return picked


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read()


def make(n, seed):
    rnd = random.Random(seed)
    anon, svc = clients()
    secret = os.environ["KAKAO_SKILL_KEY"]
    run = datetime.now().strftime("%Y%m%d-%H%M%S")
    users = []

    def intake(action):
        return anon.rpc("kakao_intake", {"p_secret": secret, "p_user": users[-1], "p_action": action,
                                         "p_text": None, "p_rights": RIGHTS}).execute().data

    items = []
    for ev in pick_events(svc, n * 3, rnd):
        if len(items) >= n:
            break
        k = len(items)
        if len(items) % PER_USER == 0 and len(users) <= len(items) // PER_USER:  # 보낸 사람당 하루 5건 제한(DB) → 4건마다 바꾼다
            users.append(f"pica-check-{run}-{uuid.uuid4().hex[:6]}")
            a = intake("agree")
            if not a.get("ok"):
                raise SystemExit(f"동의 실패: {a}")
        variant = VARIANTS[k % len(VARIANTS)]
        truth = {"event_id": ev["id"], "title": ev["title"], "start": (ev["event_date_start"] or "")[:10] or None,
                 "end": (ev["event_date_end"] or "")[:10] or None, "venue": ev.get("venue"), "region": ev.get("region"),
                 "source": ev.get("source"), "poster": ev["poster_image_url"]}
        try:
            raw = fetch(ev["poster_image_url"])
            if not readable_source(raw):
                print(f"  건너뜀(원본이 작아 글자를 알아볼 수 없음): {ev['title'][:30]}")
                continue
            img = phone_photo(raw, variant, rnd)
        except Exception as e:
            print(f"  건너뜀(포스터 못 받음): {ev['title'][:30]} — {str(e)[:80]}")
            continue
        intake("start")
        r = intake("image")
        if not r.get("ok"):
            print(f"  제출 거절: {r}")
            break
        up = anon.storage.from_("leaflets").upload(r["image_path"], img, {"content-type": "image/jpeg", "upsert": "false"})
        items.append({"id": r["id"], "image_path": r["image_path"], "variant": variant, "bytes": len(img), "truth": truth})
        print(f"  {r['id'][:8]} {variant:5s} {len(img)//1024:4d}KB  {truth['source'][:12]:12s} {truth['title'][:40]}")
        del up
    os.makedirs(RUN_DIR, exist_ok=True)
    path = os.path.join(RUN_DIR, f"{run}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"run": run, "users": users, "seed": seed, "items": items}, fh, ensure_ascii=False, indent=1)
    print(f"시험 제보 {len(items)}건 → {path}")
    return path


def load_run(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


ICON = {"ok": "맞음", "start_ok": "시작만", "empty": "비움", "wrong": "틀림", "unknown": "-"}


def score(path, md=None):
    run = load_run(path)
    _, svc = clients()
    ids = [it["id"] for it in run["items"]]
    rows = {r["id"]: r for r in svc.table("leaflet_submissions").select("id,status,ai_result").in_("id", ids).execute().data}
    results = []
    for it in run["items"]:
        ai = (rows.get(it["id"]) or {}).get("ai_result")
        results.append({**it, "ai": ai, "score": score_item(ai, it["truth"])})
    summ = summarize(results)
    lines = [f"# 카카오 제보 이미지 읽기 검증 {run['run']}", "",
             f"시험 {summ['total']}건 · 읽음 {summ['read']} · 읽지 못함 {summ['failed']} · 대기 {summ['pending']}", ""]
    for f in FIELDS:
        lines.append(f"- {f}: " + ", ".join(f"{ICON.get(k, k)} {v}" for k, v in sorted(summ[f].items())))
    lines += ["", "| id | 사진 | 정답 제목 | 제목 | 날짜 | 장소 | 지역 | 읽은 값(제목 / 날짜 / 장소 / 지역) |", "|---|---|---|---|---|---|---|---|"]
    for r in results:
        s, ai, t = r["score"], r["ai"] or {}, r["truth"]
        if s["state"] != "read":
            lines.append(f"| {r['id'][:8]} | {r['variant']} | {t['title'][:30]} | {s['state']} {s.get('error', '')[:60]} | | | | |")
            continue
        val = lambda k: ((ai.get(k) or {}).get("value") or "")[:30]  # noqa: E731
        got = f"{val('title')} / {ai.get('date_start') or ''}~{ai.get('date_end') or ''} / {val('venue')} / {val('region_hint')}"
        lines.append(f"| {r['id'][:8]} | {r['variant']} | {t['title'][:30]} ({t['start']}~{t['end']}, {(t['venue'] or '')[:20]}, {t['region']}) | "
                     f"{ICON[s['title']]} | {ICON[s['dates']]} | {ICON[s['venue']]} | {ICON[s['region']]} | {got} |")
    text = "\n".join(lines)
    print(text)
    if md:
        with open(md, "w", encoding="utf-8") as fh:
            fh.write(text + "\n")
    return summ, results


def cleanup(path):
    run = load_run(path)
    _, svc = clients()
    paths = [it["image_path"] for it in run["items"] if it.get("image_path")]
    ids = [it["id"] for it in run["items"]]
    if paths:
        svc.storage.from_("leaflets").remove(paths)
    if ids:
        svc.table("leaflet_submissions").delete().in_("id", ids).execute()
    users = run.get("users") or [run["user"]]
    left = 0
    for u in users:
        sk = sender_key(u)
        svc.table("leaflet_submissions").delete().eq("sender_key", sk).execute()   # 만들다 멈춘 줄까지
        svc.table("kakao_senders").delete().eq("sender_key", sk).execute()
        left += len(svc.table("leaflet_submissions").select("id").eq("sender_key", sk).execute().data)
    print(f"지움: 제보 {len(ids)}건, 파일 {len(paths)}개, 동의 기록 {len(users)}줄 · 남은 줄 {left}")


def main(argv):
    ap = argparse.ArgumentParser(description="카카오 제보 이미지 읽기 자체 검증 (specs/017)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("make")
    m.add_argument("--n", type=int, default=8)
    m.add_argument("--seed", type=int, default=1)
    s = sub.add_parser("score")
    s.add_argument("run")
    s.add_argument("--md")
    c = sub.add_parser("cleanup")
    c.add_argument("run")
    a = ap.parse_args(argv)
    if a.cmd == "make":
        make(a.n, a.seed)
    elif a.cmd == "score":
        score(a.run, a.md)
    else:
        cleanup(a.run)


if __name__ == "__main__":
    main(sys.argv[1:])
