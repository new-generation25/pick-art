"""리플렛 읽기 대기열 (specs/013-leaflet-intake). 글자 읽기는 클로드 예약작업이 하고, 이 도구는 파일을 내려받고 결과를 저장한다.

운영자 11/26 결정: AI 읽기 = 클로드 예약작업(이 PC, 자기 눈으로 읽음, API 키 없음) · 이미지 보관 1년 ·
휴대폰 사진(image_kind='photo')은 글자만 읽고 포스터로 쓰지 않는다. 지시문: collector/prompts/leaflet_read.md

사용 (collector 폴더에서, PYTHONIOENCODING=utf-8. 마지막 줄이 한 줄 요약)
  python tools/leaflet_queue.py --pending [--limit 10]
      status='uploaded' 이고 image_path 가 있는 제출을 오래된 것부터(카카오 챗봇으로 «글만» 온 제출도 — specs/017,
      항목의 source="text", file=null, text=보낸 글. 이미지 대신 글에서 칸을 옮긴다). 비공개 버킷 leaflets 에서
      .cache/leaflets/<id>.<확장자> 로 내려받고, 작은 글씨용으로 위·아래 절반을 2배로 키운 조각
      <id>.tile1.jpg·<id>.tile2.jpg 를 옆에 만들어(항목의 tiles) JSON 배열(한 줄)을 찍는다
  python tools/leaflet_queue.py --save <id> --file <result.json>
      예약작업이 쓴 JSON 을 엄격히 검사하고(칸 밖 키·틀린 모양이면 저장 안 함), 개인 휴대전화·계좌번호 칸을 비우고,
      date_text.raw 를 수집기 규칙 파서(rule_extractor.parse_period, 기본 연도 없음)로 date_start/date_end 로 바꿔
      ai_result 에 넣는다(줄임 표기 «2027년 1월 9일~10일» 은 끝날에 시작 월을 채워 읽고, multiple_events 면 날짜를
      비운다). status='uploaded' 인 줄만 'read' 로 바꾼다. 내려받은 이미지·조각은 지운다
  python tools/leaflet_queue.py --fail <id> --reason "..."
      읽지 못함: ai_result={"error": 이유}, status='read'(운영자가 그래도 본다)
  python tools/leaflet_queue.py --cleanup [--apply]
      올린 지 365일 지난 제출의 버킷 파일을 지우고 image_path 를 NULL 로. 카카오톡 채널(specs/017)의 보낸 사람 구분값도
      1년 지난 것은 지운다(kakao_senders 동의 기록 삭제, 제출의 sender_key NULL). --apply 없으면 세기만 한다
"""
import argparse
import contextlib
import glob
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from rule_extractor import parse_period  # noqa: E402  수집기 정의 파일(public_scraper)이 쓰는 규칙 날짜 파서

BUCKET = "leaflets"
CACHE_DIR = os.path.join(HERE, ".cache", "leaflets")
KEEP_DAYS = 365
PAGE = 1000
MAX_LEN = 300
READ_BY = "claude-scheduled"

TEXT_FIELDS = ("title", "date_text", "time_text", "venue", "region_hint", "price_text",
               "booking_text", "booking_url", "organizer", "contact")
BOOL_FIELDS = ("multiple_events", "personal_info_visible")  # personal_info_visible: 이미지에 개인 휴대전화·계좌번호·개인 메일이 보임 → 포스터로 공개하지 않음(FR-042)
ALLOWED_KEYS = set(TEXT_FIELDS) | set(BOOL_FIELDS)
CONFIDENCE = {"high", "low", "none"}
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
EXT_OK = {"jpg", "jpeg", "png", "webp", "heic", "heif"}

# 개인정보 (FR-040·041): 휴대전화 010·011·016·017·018·019(+82 포함), 계좌번호
MOBILE = re.compile(r"(?:\+?82[\s.\-]*0?|(?<!\d)0)1[016789][\s.\-)]*\d{3,4}[\s.\-]*\d{4}(?!\d)")
BANK_WORDS = re.compile(r"계좌|예금주|입금|은행|농협|새마을금고|신협|우체국|수협|카카오뱅크|케이뱅크|토스뱅크|IBK|KB|NH")
DIGIT_RUN = re.compile(r"\d(?:\d|[\s\-](?=\d))*")  # 숫자 묶음: 숫자 사이 하이픈·빈칸 한 개까지
DATE_LIKE = re.compile(r"^20\d\d[\s\-]\d{1,2}[\s\-]\d{1,2}$")
NO_ACCOUNT_CHECK = {"date_text", "time_text"}  # 날짜·시각은 숫자뿐이라 계좌 판정에서 뺀다(휴대전화 판정은 한다)
# 대표·유선 전화 모양(계좌가 아님): 지역번호 02·031~064·070·080·050x 안심번호(0502~0508), 괄호 지역번호
# «(055)864-6969»·«055)864-6969», 15xx·16xx·18xx-xxxx, 지역번호 없는 국번 «680-1051». 앞뒤로 숫자 묶음이
# 하이픈·점으로 이어지면(«110-1234-5678-90» 같은 계좌) 전화로 보지 않는다. 빈칸으로 띄운 번호 두 개
# («1599-1216 680-1051»)는 각각 전화다
_NB = r"(?<!\d)(?<!\d[.\-])"       # 앞에 하이픈·점으로 붙은 숫자 묶음이 없음
_NA = r"(?![.\-]?\d)"              # 뒤에 하이픈·점으로 붙은 숫자 묶음이 없음
PHONE = re.compile(
    _NB + r"(?:"
    r"\(?0(?:2|[3-6][1-5]|70|80|50[2-8])\)?[\s.\-)]*\d{3,4}[\s.\-]*\d{4}"   # 지역번호·070·080·050x
    r"|1[568]\d{2}[\s.\-]*\d{4}"                                           # 15xx·16xx·18xx 대표번호
    r"|\d{3,4}[.\-]\d{4}"                                                  # 지역번호 없는 국번-번호
    r")" + _NA)


class ValidationError(ValueError):
    pass


# ---------- DB·버킷 (테스트에서는 같은 메서드를 가진 가짜로 바꾼다) ----------

class Store:
    def __init__(self, db):
        self.sb = db.supabase

    def pending(self, limit):
        return (self.sb.table("leaflet_submissions")
                .select("id,image_path,image_kind,group_name,official_url,given,note,created_at,channel")
                .eq("status", "uploaded")
                .or_("image_path.not.is.null,and(channel.eq.kakao_bot,note.not.is.null)")
                .order("created_at").limit(limit).execute().data or [])

    def _bucket(self):
        # storage3 가 «Storage endpoint URL should have a trailing slash.» 를 stdout 에 찍어 JSON 줄을 더럽힌다 → stderr 로
        with contextlib.redirect_stdout(sys.stderr):
            return self.sb.storage.from_(BUCKET)

    def download(self, path):
        return self._bucket().download(path)

    def mark_read(self, sid, ai_result, read_at):
        """status='uploaded' 인 줄만 바꾼다. 바뀌었으면 True."""
        res = (self.sb.table("leaflet_submissions")
               .update({"ai_result": ai_result, "ai_read_at": read_at, "status": "read"})
               .eq("id", sid).eq("status", "uploaded").execute())
        return bool(res.data)

    def status_of(self, sid):
        d = self.sb.table("leaflet_submissions").select("status").eq("id", sid).execute().data
        return d[0]["status"] if d else None

    def expired(self, before_iso):
        rows, start = [], 0
        while True:
            page = (self.sb.table("leaflet_submissions").select("id,image_path,created_at")
                    .lt("created_at", before_iso).not_.is_("image_path", "null")
                    .order("created_at").range(start, start + PAGE - 1).execute().data or [])
            rows += page
            if len(page) < PAGE:
                return rows
            start += PAGE

    def remove_files(self, paths):
        return self._bucket().remove(paths)

    def expire_kakao(self, before_iso, apply):
        """1년 지난 카카오 보낸 사람 구분값: (동의 기록 수, 제출 줄 수). apply 면 지운다"""
        senders = (self.sb.table("kakao_senders").select("sender_key", count="exact")
                   .lt("agreed_at", before_iso).limit(1).execute().count or 0)
        rows = (self.sb.table("leaflet_submissions").select("id", count="exact")
                .lt("created_at", before_iso).not_.is_("sender_key", "null").limit(1).execute().count or 0)
        if apply:
            if senders:
                self.sb.table("kakao_senders").delete().lt("agreed_at", before_iso).execute()
            if rows:
                (self.sb.table("leaflet_submissions").update({"sender_key": None})
                 .lt("created_at", before_iso).not_.is_("sender_key", "null").execute())
        return senders, rows

    def clear_image_path(self, sid, path):
        res = (self.sb.table("leaflet_submissions").update({"image_path": None})
               .eq("id", sid).eq("image_path", path).execute())
        return bool(res.data)


# ---------- 검사 ----------

def _clean_text(v, where):
    if v is None:
        return None
    if not isinstance(v, str):
        raise ValidationError(f"{where} 는 글자 또는 null 이어야 한다")
    v = " ".join(v.split())
    return v[:MAX_LEN] or None


def is_mobile(text):
    return bool(text and MOBILE.search(text))


def looks_phone(digits):
    """대표·유선 전화(0으로 시작 9~11자리, 050x 안심번호 11~12자리, 15xx·16xx·18xx 8자리)."""
    if digits[:4] in {f"050{i}" for i in range(2, 9)} and 11 <= len(digits) <= 12:
        return True
    return (digits.startswith("0") and 9 <= len(digits) <= 11) or (len(digits) == 8 and digits[:2] in ("15", "16", "18"))


def is_account(text):
    """계좌번호로 보이는 글자: 은행·계좌 낱말 + 8자리 이상 숫자 묶음, 또는 10~16자리 숫자 묶음.
    전화번호(PHONE 모양을 먼저 지움)·날짜 모양 묶음은 뺀다."""
    if not text:
        return False
    bank = bool(BANK_WORDS.search(text))
    text = PHONE.sub(" / ", text)  # 번호 두 개가 빈칸 하나로 이어져 긴 숫자 묶음이 되지 않게 끊는다
    for m in DIGIT_RUN.finditer(text):
        run = m.group(0)
        digits = re.sub(r"\D", "", run)
        if looks_phone(digits) or DATE_LIKE.match(run):
            continue
        if (bank and len(digits) >= 8) or 10 <= len(digits) <= 16:
            return True
    return False


def privacy_reason(name, field):
    """raw·value 를 따로 검사한다(이어 붙이면 raw 끝 번호와 value 앞 번호가 한 숫자 묶음이 돼 계좌로 오판한다)."""
    texts = [x for x in (field.get("raw"), field.get("value")) if x]
    if any(is_mobile(t) for t in texts):
        return "mobile"
    if name not in NO_ACCOUNT_CHECK and any(is_account(t) for t in texts):
        return "account"
    return None


def validate(data):
    """예약작업 결과 → (칸 dict, 비운 칸 목록). 칸 밖 키·틀린 모양이면 ValidationError (저장하지 않는다)."""
    if not isinstance(data, dict):
        raise ValidationError("맨 위는 JSON 객체여야 한다")
    extra = set(data) - ALLOWED_KEYS
    if extra:
        raise ValidationError(f"칸 밖 키: {sorted(extra)}")
    out, dropped = {}, []
    flags = {}
    for b in BOOL_FIELDS:
        v = data.get(b, False)
        if not isinstance(v, bool):
            raise ValidationError(f"{b} 는 true/false 여야 한다")
        flags[b] = v
    for name in TEXT_FIELDS:
        f = data.get(name)
        if f is None:
            f = {"raw": None, "value": None, "confidence": "none"}
        if not isinstance(f, dict):
            raise ValidationError(f"{name} 는 {{raw, value, confidence}} 객체여야 한다")
        if set(f) != {"raw", "value", "confidence"}:
            raise ValidationError(f"{name} 의 키는 raw·value·confidence 셋이어야 한다 (지금 {sorted(f)})")
        conf = f["confidence"]
        if conf not in CONFIDENCE:
            raise ValidationError(f"{name}.confidence 는 high·low·none 중 하나 (지금 {conf!r})")
        raw = _clean_text(f["raw"], f"{name}.raw")
        value = _clean_text(f["value"], f"{name}.value")
        if conf == "none":
            value = None
        if name == "booking_url" and value is not None and not re.match(r"^https?://\S+$", value, re.I):
            value = None
        if raw is None and value is None:
            conf = "none"
        field = {"raw": raw, "value": value, "confidence": conf}
        reason = privacy_reason(name, field)
        if reason:
            field = {"raw": None, "value": None, "confidence": "none"}
            dropped.append({"field": name, "reason": reason})
        out[name] = field
    out.update(flags)
    # 칸에서 개인 연락처를 걸러 냈다면 이미지에도 보인다는 뜻이다
    if dropped:
        out["personal_info_visible"] = True
    return out, dropped


# 끝날의 월이 빠진 줄임 표기(시작에 연도·월이 인쇄된 경우만). 끝날 뒤에 숫자·«:»·«시»·«월»이 오면
# 월·시각일 수 있으므로 건드리지 않는다
_WKDAY = r"(?:\s*\([^)\d]{1,4}\))?"
_ABBR_KO = re.compile(r"(?P<y>20\d{2})\s*년\s*(?P<m>\d{1,2})\s*월\s*(?P<d>\d{1,2})\s*일" + _WKDAY +
                      r"\s*[~∼–\-]\s*(?P<ed>\d{1,2})\s*일")
_ABBR_DOT = re.compile(r"(?P<y>20\d{2})\s*\.\s*(?P<m>\d{1,2})\s*\.\s*(?P<d>\d{1,2})(?!\d)\.?" + _WKDAY +
                       r"\s*[~∼–\-]\s*(?P<ed>\d{1,2})(?!\d)(?!\s*\.\s*\d)(?!\s*[:시월])")


def normalize_abbrev_end(text):
    """«2027년 1월 9일~10일» → «2027년 1월 9일 ~ 1월 10일», «2027. 1. 9 ~ 10»·«2027.1.9~10(일)» → «… ~ 1. 10…».
    시작의 월을 끝날에 채울 뿐 연도는 넣지 않는다(연도는 인쇄된 것만). 줄임 표기가 아니면 그대로 돌려준다."""
    if not text:
        return text
    m = _ABBR_KO.search(text)
    if m:
        return text[:m.end("d")] + text[m.end("d"):m.start("ed")].replace("-", "~") + f"{m['m']}월 " + text[m.start("ed"):]
    m = _ABBR_DOT.search(text)
    if m:
        # 붙은 하이픈(«9-10»)은 parse_period 가 범위로 보지 않으므로 «~» 로 바꾼다
        mid = re.sub(r"[~∼–\-]", "~", text[m.end("d"):m.start("ed")])
        return text[:m.end("d")] + mid + f"{m['m']}. " + text[m.start("ed"):]
    return text


def parse_dates(date_raw, multiple_events=False):
    """date_text.raw → (date_start, date_end). 연도가 인쇄돼 있지 않거나 파서가 못 바꾸면 (None, None).
    기본 연도를 주지 않으므로 연도 없는 날짜는 채우지 않는다. 끝이 시작보다 앞이면(연도 넘김을 추측해야 함) 비운다.
    한 장에 행사가 여럿(multiple_events)이면 날짜 목록이 첫 날짜 하루로 바뀌는 오답을 막으려고 파싱하지 않는다."""
    if not date_raw or multiple_events:
        return None, None
    p = parse_period(normalize_abbrev_end(date_raw), None)
    if not p["parsed"] or not p["start"] or not p["end"] or p["end"] < p["start"]:
        return None, None
    return p["start"], p["end"]


def build_result(data):
    fields, dropped = validate(data)
    start, end = parse_dates(fields["date_text"]["raw"], fields["multiple_events"])
    fields.update({"date_start": start, "date_end": end, "date_parser": "rule_extractor.parse_period",
                   "read_by": READ_BY, "privacy_dropped": dropped})
    return fields


# ---------- 동작 ----------

def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def check_id(sid):
    if not UUID.match(sid or ""):
        raise ValidationError(f"제출 id 모양이 아니다: {sid!r}")


def ext_of(path):
    e = os.path.splitext(path or "")[1].lstrip(".").lower()
    return e if e in EXT_OK else "img"


def remove_cache(sid, cache_dir=CACHE_DIR, also=None):
    gone = 0
    for p in glob.glob(os.path.join(cache_dir, f"{sid}.*")):
        os.remove(p)
        gone += 1
    if also:
        a = os.path.abspath(also)
        if os.path.dirname(a) == os.path.abspath(cache_dir) and os.path.exists(a):
            os.remove(a)
            gone += 1
    return gone


TILE_SCALE = 2
TILE_MAX_SIDE = 4000   # 큰 사진은 2배로 키우면 파일만 커진다 → 긴 변을 여기서 멈춘다(원본보다 작게 줄이지는 않는다)
TILE_OVERLAP = 0.06    # 가운데 줄이 두 조각으로 잘리지 않게 위·아래 조각을 높이의 6%씩 겹친다


def make_tiles(path, sid, cache_dir=CACHE_DIR):
    """작은 글씨용 확대 조각: 위 절반·아래 절반을 2배로 키운 jpg 두 장(<id>.tile1.jpg·<id>.tile2.jpg).
    원본과 같은 «<id>.*» 이름이라 --save·--fail 때 함께 지워진다. 경로 목록을 돌려준다."""
    from PIL import Image, ImageOps
    with Image.open(path) as im:
        im.seek(0)  # 움직이는 gif 는 첫 장
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        half, pad = h // 2, int(h * TILE_OVERLAP)
        out = []
        for i, box in enumerate(((0, 0, w, min(h, half + pad)), (0, max(0, half - pad), w, h)), 1):
            tile = im.crop(box)
            tw, th = tile.size
            scale = max(1.0, min(TILE_SCALE, TILE_MAX_SIDE / max(tw, th)))
            tile = tile.resize((round(tw * scale), round(th * scale)), Image.LANCZOS)
            dest = os.path.join(cache_dir, f"{sid}.tile{i}.jpg")
            tile.save(dest, "JPEG", quality=90)
            out.append(os.path.abspath(dest))
    return out


def pending(store, limit, cache_dir=CACHE_DIR):
    os.makedirs(cache_dir, exist_ok=True)
    items = []
    for r in store.pending(limit):
        item = {"id": r["id"], "source": "image", "file": None, "tiles": [], "image_kind": r.get("image_kind"),
                "group_name": r.get("group_name"), "official_url": r.get("official_url"),
                "given": r.get("given") or {}, "note": r.get("note"), "channel": r.get("channel") or "web"}
        if not r.get("image_path"):  # 카카오 챗봇으로 글만 보낸 제출(specs/017): 읽을 것은 글
            item.update({"source": "text", "text": r.get("note") or ""})
            items.append(item)
            continue
        try:
            check_id(r["id"])
            dest = os.path.join(cache_dir, f"{r['id']}.{ext_of(r['image_path'])}")
            with open(dest, "wb") as fh:
                fh.write(store.download(r["image_path"]))
            item["file"] = os.path.abspath(dest)
        except Exception as e:  # 한 장이 실패해도 나머지는 넘긴다
            item["download_error"] = str(e)[:200]
        if item["file"]:
            try:
                item["tiles"] = make_tiles(item["file"], r["id"], cache_dir)
            except Exception as e:  # 조각을 못 만들어도(heic 등) 원본으로 읽는다
                item["tiles_error"] = str(e)[:200]
        items.append(item)
    return items


def save(store, sid, result_path, cache_dir=CACHE_DIR):
    check_id(sid)
    with open(result_path, encoding="utf-8") as fh:
        data = json.load(fh)
    result = build_result(data)
    ok = store.mark_read(sid, result, now_iso())
    if ok:
        remove_cache(sid, cache_dir, also=result_path)
    return ok, result


def fail(store, sid, reason, cache_dir=CACHE_DIR):
    check_id(sid)
    reason = " ".join((reason or "").split())[:MAX_LEN] or "읽지 못함"
    ok = store.mark_read(sid, {"error": reason, "read_by": READ_BY}, now_iso())
    if ok:
        remove_cache(sid, cache_dir)
    return ok


def cleanup(store, apply, now=None):
    before = ((now or datetime.now(timezone.utc)) - timedelta(days=KEEP_DAYS)).isoformat(timespec="seconds")
    rows = store.expired(before)
    out = {"expired": len(rows), "files_removed": 0, "rows_cleared": 0, "errors": [], "apply": apply,
           "kakao_senders": 0, "kakao_sender_keys": 0}
    try:
        out["kakao_senders"], out["kakao_sender_keys"] = store.expire_kakao(before, apply)
    except Exception as e:  # 017 마이그레이션 전 DB 등: 이미지 정리는 계속한다
        out["errors"].append(f"kakao: {str(e)[:180]}")
    if not apply:
        return out
    for i in range(0, len(rows), 100):
        chunk = rows[i:i + 100]
        try:
            store.remove_files([r["image_path"] for r in chunk])
            out["files_removed"] += len(chunk)
        except Exception as e:
            out["errors"].append(str(e)[:200])
            continue  # 파일을 못 지웠으면 경로를 남겨 둔다(다음에 다시)
        for r in chunk:
            if store.clear_image_path(r["id"], r["image_path"]):
                out["rows_cleared"] += 1
    return out


def main(argv):
    ap = argparse.ArgumentParser(description="리플렛 읽기 대기열 (specs/013)")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--pending", action="store_true")
    g.add_argument("--save", metavar="ID")
    g.add_argument("--fail", metavar="ID")
    g.add_argument("--cleanup", action="store_true")
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--file")
    ap.add_argument("--reason")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args(argv)

    from database import Database
    store = Store(Database())
    try:
        if a.pending:
            items = pending(store, max(1, min(a.limit, 50)))
            print(json.dumps(items, ensure_ascii=False))
            bad = sum(1 for x in items if x["source"] == "image" and not x["file"])
            print(f"리플렛 대기 {len(items)}건 내려받음" + (f" · 내려받기 실패 {bad}건" if bad else "")
                  + f" ({os.path.relpath(CACHE_DIR, HERE)})")
            return 0
        if a.save:
            if not a.file:
                print("❌ --save 에는 --file <result.json> 이 필요하다"); return 2
            ok, result = save(store, a.save, a.file)
            if not ok:
                print(f"⚠️ 저장 안 함: {a.save} 는 지금 status={store.status_of(a.save)!r} (uploaded 아님)"); return 1
            filled = sum(1 for k in TEXT_FIELDS if result[k]["value"])
            print(f"✅ 저장 {a.save}: 칸 {filled}/{len(TEXT_FIELDS)} · 날짜 {result['date_start'] or '-'}~"
                  f"{result['date_end'] or '-'} · 개인정보로 비운 칸 {len(result['privacy_dropped'])} · status=read")
            return 0
        if a.fail:
            if not fail(store, a.fail, a.reason):
                print(f"⚠️ 기록 안 함: {a.fail} 는 지금 status={store.status_of(a.fail)!r} (uploaded 아님)"); return 1
            print(f"✅ 읽기 실패로 기록 {a.fail}: status=read (운영자 검토)")
            return 0
        out = cleanup(store, a.apply)
        print(json.dumps(out, ensure_ascii=False))
        verb = "지움" if a.apply else "지울 대상(dry-run, --apply 로 적용)"
        print(f"1년 지난 리플렛 이미지 {out['expired']}건 {verb} · 파일 {out['files_removed']} · 경로 비움 "
              f"{out['rows_cleared']} · 카카오 구분값 동의 {out['kakao_senders']}·제출 {out['kakao_sender_keys']}"
              + (f" · 오류 {len(out['errors'])}" if out["errors"] else ""))
        return 1 if out["errors"] else 0
    except ValidationError as e:
        print(f"❌ 검사 실패(저장 안 함): {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
