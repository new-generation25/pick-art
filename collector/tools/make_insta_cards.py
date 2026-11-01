"""공개 행사 1건으로 인스타그램 캐러셀(1080x1350) 슬라이드와 캡션을 만든다.

events 행(제목·날짜·장소·포스터·원문 링크)을 기본값으로 쓰고, 공식 페이지에서 확인한
사실(시간·요금·예약 방법 등)은 --facts JSON 으로 덧씌운다. DB 설명이 비어 있는 행이
많아서, 확인 안 된 칸은 슬라이드에 넣지 않고 "원문 확인" 으로 돌린다.

화면은 사이트의 리소(riso) 테마 색·글꼴(Black Han Sans + Pretendard)을 따른다.
Playwright(Chromium)로 HTML 을 렌더링해 PNG 를 찍고, Graph API 발행용 JPEG 도 같이 둔다.
게시는 하지 않는다. 만들어진 파일을 사람이 검토한 뒤 올린다.

사용:
  python tools/make_insta_cards.py <event_id> [--facts f.json] [--out DIR] [--slug NAME]
  python tools/make_insta_cards.py --today 2026-11-01      (오늘 열리는 후보만 출력)

facts JSON 키(모두 선택): hook, kicker, title, date_label, time, venue, address, price,
  audience, what[], how[], contact, notice, cover_note, source_name, source_url, poster_credit,
  hashtags[](본 캡션용, 5개 이하), hashtags_pool[](예비), caption_lead, mentions[](주관 측 @계정)
"""
import argparse
import base64
import html
import json
import os
import sys
from datetime import date

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402

W, H = 1080, 1350
WEEK = "월화수목금토일"
# 인스타그램은 2025-12 부터 게시물·릴스 캡션의 해시태그를 5개까지로 줄이고 있다
MAX_TAGS = 5

# frontend/src/app/globals.css 의 .pica-public[data-pica-theme="riso"] 값
RISO = {
    "paper": "#ecede6", "card": "#f7f7f2", "ink": "#1a1a1a", "ink_soft": "#55554f",
    "blue": "#2350d8", "pink": "#ff4fa3",
}


def kdate(d: str) -> str:
    y, m, dd = map(int, d.split("-"))
    return f"{m}.{dd}({WEEK[date(y, m, dd).weekday()]})"


def esc(s) -> str:
    return html.escape(str(s or "")).replace("\n", "<br>")


def poster_data_uri(url: str) -> str:
    if not url:
        return ""
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    ctype = r.headers.get("content-type", "image/webp").split(";")[0]
    return f"data:{ctype};base64,{base64.b64encode(r.content).decode()}"


def build_facts(ev: dict, facts: dict) -> dict:
    """DB 행에서 기본값을 만들고 facts 로 덮어쓴다."""
    s, e = ev["event_date_start"], ev["event_date_end"]
    date_label = kdate(s) if s == e else f"{kdate(s)} ~ {kdate(e)}"
    price = ev.get("price_info") or ("무료" if ev.get("is_free") else "")
    region = ev.get("region") or "경남"
    cat = ev.get("category") or "행사"
    f = {
        "title": ev["title"],
        "kicker": f"{region} · {cat}",
        "hook": f"오늘 {region}에서\n{cat} 한 편 어때요?",
        "date_label": date_label,
        "time": "", "venue": ev.get("venue") or "", "address": "",
        "price": price, "audience": "",
        "what": [], "how": [], "contact": "", "notice": "", "cover_note": "",
        "source_name": ev.get("source") or "", "source_url": ev.get("original_url") or "",
        "poster_credit": "",
        "hashtags": [f"#{region}가볼만한곳", f"#경남{cat}", f"#{region}{cat}", "#경남문화예술", "#픽아트"],
        "hashtags_pool": [],
        "caption_lead": "", "mentions": [],
    }
    f.update({k: v for k, v in facts.items() if v not in (None, "")})
    if not f["poster_credit"]:
        f["poster_credit"] = f"포스터 출처: {f['source_name']}" if f["source_name"] else ""
    f["region"], f["category"] = region, cat
    return f


CSS = """
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=block');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #888; }
.slide {
  width: %(W)dpx; height: %(H)dpx; position: relative; overflow: hidden;
  background: %(paper)s; color: %(ink)s;
  font-family: 'Pretendard Variable', Pretendard, sans-serif; letter-spacing: -0.02em;
  word-break: keep-all;
}
/* 종이 결: 아주 옅은 망점 */
.slide::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background-image: radial-gradient(rgba(26,26,26,.07) 1.2px, transparent 1.3px);
  background-size: 9px 9px;
}
.slide > * { position: relative; z-index: 1; }
.disp { font-family: 'Black Han Sans', 'Pretendard Variable', sans-serif; font-weight: 400; letter-spacing: -0.01em; }
/* 두 잉크가 살짝 어긋나게 찍힌 모양 */
.print { text-shadow: 6px 4px 0 rgba(255,79,163,.85); }
.top { position: absolute; top: 64px; left: 72px; right: 72px; display: flex; justify-content: space-between; align-items: center; }
.brand { font-size: 30px; font-weight: 800; }
.brand b { color: %(blue)s; }
.page { font-size: 26px; font-weight: 700; color: %(ink_soft)s; }
.chip { display: inline-block; border: 3px solid %(ink)s; padding: 8px 20px; font-size: 32px; font-weight: 800; background: %(card)s; }
.chip.pink { background: %(pink)s; }
.chip.blue { background: %(blue)s; color: #fff; border-color: %(blue)s; }
.credit { position: absolute; left: 72px; right: 72px; bottom: 44px; font-size: 22px; color: %(ink_soft)s; display: flex; justify-content: space-between; }
.band { background: %(blue)s; color: #fff; }
.h2 { font-size: 76px; line-height: 1.1; }
.pad { position: absolute; left: 72px; right: 72px; }

/* 1. 표지 */
.cover .poster { position: absolute; right: -12px; top: 56px; transform: rotate(3deg);
  border: 4px solid %(ink)s; box-shadow: 14px 14px 0 %(blue)s; background: #fff; }
.cover .poster img { display: block; height: 1000px; width: auto; max-width: 800px; object-fit: contain; }
.cover .hook { position: absolute; left: 72px; top: 250px; width: 420px; font-size: 76px; line-height: 1.08; }
.cover .chips { position: absolute; left: 72px; top: 150px; display: flex; gap: 14px; z-index: 3; }
.cover .sticker { position: absolute; right: 70px; top: 960px; z-index: 3; transform: rotate(-5deg); background: %(pink)s; border: 4px solid %(ink)s; padding: 12px 22px; font-size: 32px; font-weight: 900; }
.cover .titlebox { position: absolute; left: 0; right: 0; bottom: 96px; padding: 24px 72px; }
.cover .titlebox .t { font-size: 44px; font-weight: 900; line-height: 1.22; }
.cover .titlebox .s { font-size: 30px; margin-top: 6px; opacity: .92; font-weight: 600; }
.cover .swipe { position: absolute; left: 72px; top: 720px; font-size: 30px; font-weight: 800; background: %(ink)s; color: %(paper)s; padding: 10px 20px; }

/* 2. 정보표 (입장권 모양) */
.ticket { border: 4px solid %(ink)s; background: %(card)s; }
.ticket .row { display: grid; grid-template-columns: 210px 1fr; border-top: 3px dotted %(ink)s; }
.ticket .row:first-child { border-top: none; }
.ticket .k { background: %(ink)s; color: %(paper)s; font-size: 34px; font-weight: 800; padding: 30px 28px; }
.ticket .v { font-size: 40px; font-weight: 800; padding: 26px 30px; line-height: 1.3; }
.ticket .v small { display: block; font-size: 28px; font-weight: 600; color: %(ink_soft)s; margin-top: 6px; }
.notice { border: 4px solid %(ink)s; background: %(pink)s; font-size: 32px; font-weight: 800; padding: 22px 28px; line-height: 1.35; }

/* 3. 무엇 */
.what .poster2 { position: absolute; left: 72px; top: 330px; width: 430px; border: 4px solid %(ink)s; box-shadow: 10px 10px 0 %(pink)s; background:#fff; }
.what .poster2 img { display: block; width: 100%%; max-height: 640px; object-fit: cover; object-position: top; }
.what ul { position: absolute; left: 550px; right: 72px; top: 330px; list-style: none; }
.what li { font-size: 37px; font-weight: 700; line-height: 1.38; padding: 20px 0; border-bottom: 3px solid %(ink)s; }
.what li:first-child { border-top: 3px solid %(ink)s; }
.what li b { color: %(blue)s; }

/* 4. 가는 법 */
.how ol { list-style: none; counter-reset: n; }
.how li { counter-increment: n; display: grid; grid-template-columns: 90px 1fr; align-items: start; gap: 26px; margin-bottom: 48px; font-size: 44px; font-weight: 700; line-height: 1.38; }
.how li::before { content: counter(n); font-family: 'Black Han Sans', sans-serif; font-size: 52px; width: 84px; height: 84px; display: flex; align-items: center; justify-content: center; background: %(blue)s; color: #fff; box-shadow: 5px 4px 0 %(pink)s; }

/* 5. CTA */
.cta { background: %(blue)s; color: #fff; }
.cta::before { background-image: radial-gradient(rgba(255,255,255,.10) 1.2px, transparent 1.3px); }
.cta .big { font-size: 128px; line-height: 1.05; text-shadow: 7px 5px 0 rgba(255,79,163,.95); }
.cta .acts { display: flex; gap: 22px; }
.cta .act { flex: 1; border: 4px solid #fff; padding: 26px 18px; text-align: center; font-size: 34px; font-weight: 800; }
.cta .act .i { font-size: 64px; display: block; margin-bottom: 8px; }
.cta .credit { color: rgba(255,255,255,.8); }
.cta .src { font-size: 28px; line-height: 1.5; color: rgba(255,255,255,.9); }
"""


def slides_html(f: dict, poster: str, handle: str) -> list:
    n_total = 5
    brand = f'<div class="brand">픽아트 <b>pica</b>{(" · " + esc(handle)) if handle else ""}</div>'

    def top(i):
        return f'<div class="top">{brand}<div class="page">{i}/{n_total}</div></div>'

    credit = f'<div class="credit"><span>{esc(f["poster_credit"])}</span><span>경남 문화예술 큐레이션</span></div>'
    out = []

    # 1. 표지: 훅 + 포스터 + 제목 띠
    out.append(f"""
<div class="slide cover"><div class="top">{brand}</div>
  <div class="chips"><span class="chip pink">오늘 {esc(f['date_label'])}</span><span class="chip">{esc(f['kicker'])}</span></div>
  {f'<div class="poster"><img src="{poster}"></div>' if poster else ''}
  {f'<div class="sticker">{esc(f["cover_note"])}</div>' if f["cover_note"] else ''}
  <div class="hook disp print">{esc(f['hook'])}</div>
  <div class="titlebox band"><div class="t">{esc(f['title'])}</div>
    <div class="s">{esc(' · '.join(x for x in [f['time'], f['venue']] if x))}</div></div>
  <div class="swipe">넘겨서 보기 →</div>
  {credit}
</div>""")

    # 2. 언제·어디·얼마
    rows = [("날짜", f["date_label"], ""), ("시간", f["time"], ""),
            ("장소", f["venue"], f["address"]), ("요금", f["price"], ""), ("대상", f["audience"], "")]
    rows_html = "".join(
        f'<div class="row"><div class="k">{k}</div><div class="v">{esc(v)}{f"<small>{esc(sm)}</small>" if sm else ""}</div></div>'
        for k, v, sm in rows if v)
    notice = f'<div class="notice pad" style="top:{1080 if len([r for r in rows if r[1]]) <= 4 else 1110}px">{esc(f["notice"])}</div>' if f["notice"] else ""
    out.append(f"""
<div class="slide">{top(2)}
  <div class="pad disp h2 print" style="top:170px">언제, 어디서,<br>얼마?</div>
  <div class="pad ticket" style="top:390px">{rows_html}</div>
  {notice}
  {credit}
</div>""")

    # 3. 무엇
    what = f["what"] or ["자세한 내용은 공식 안내를 확인하세요."]
    out.append(f"""
<div class="slide what">{top(3)}
  <div class="pad disp h2 print" style="top:170px">어떤 {esc(f['category'])}?</div>
  {f'<div class="poster2"><img src="{poster}"></div>' if poster else ''}
  <ul>{''.join(f'<li>{x}</li>' for x in what)}</ul>
  {credit}
</div>""")

    # 4. 가는 법·예약
    how = f["how"] or [f"공식 안내: {esc(f['source_name'])}"]
    contact = f'<div class="pad chip" style="bottom:120px;font-size:34px">문의 {esc(f["contact"])}</div>' if f["contact"] else ""
    place = (f'<div class="pad notice" style="bottom:210px;background:{RISO["card"]}">📍 {esc(f["venue"])}'
             f'{"<br><span style=font-weight:600>" + esc(f["address"]) + "</span>" if f["address"] else ""}</div>') if f["venue"] else ""
    out.append(f"""
<div class="slide how">{top(4)}
  <div class="pad disp h2 print" style="top:170px">이렇게 가요</div>
  <ol class="pad" style="top:360px">{''.join(f'<li><span>{x}</span></li>' for x in how)}</ol>
  {place}
  {contact}
  {credit}
</div>""")

    # 5. 저장·공유 CTA + 출처
    out.append(f"""
<div class="slide cta">
  <div class="top"><div class="brand" style="color:#fff">픽아트 <b style="color:{RISO['pink']}">pica</b>{(" · " + esc(handle)) if handle else ""}</div><div class="page" style="color:#fff">5/5</div></div>
  <div class="pad disp big" style="top:220px">같이 갈<br>사람<br>태그!</div>
  <div class="pad acts" style="top:720px">
    <div class="act"><span class="i">🔖</span>저장해 두기</div>
    <div class="act"><span class="i">📨</span>친구에게 보내기</div>
    <div class="act"><span class="i">➕</span>팔로우하고<br>매일 받기</div>
  </div>
  <div class="pad src" style="top:1010px">출처 · {esc(f['source_name'])}<br>{esc(f['source_url'])[:90]}<br>방문 전 공식 안내에서 변경 사항을 꼭 확인하세요.</div>
  <div class="credit"><span>{esc(f['poster_credit'])}</span><span>경남 문화예술 큐레이션</span></div>
</div>""")
    return out


def caption_text(f: dict, handle: str) -> str:
    tags = [t if t.startswith("#") else f"#{t}" for t in f["hashtags"]][:MAX_TAGS]
    pool = [t if t.startswith("#") else f"#{t}" for t in f["hashtags_pool"] if t not in tags]
    hook_line = f["caption_lead"] or f["hook"].replace("\n", " ")
    lines = [hook_line, "", f"📌 {f['title']}", f"🗓 {f['date_label']}" + (f" {f['time']}" if f["time"] else "")]
    if f["venue"]:
        lines.append(f"📍 {f['venue']}" + (f" ({f['address']})" if f["address"] else ""))
    if f["price"]:
        lines.append(f"🎟 {f['price']}")
    if f["notice"]:
        lines += ["", f"⚠️ {f['notice']}"]
    if f["how"]:
        lines += ["", "✔️ 가는 법·예약"] + [f"- {html.unescape(_strip(x))}" for x in f["how"]]
    if f["mentions"]:
        lines += ["", "🏷 " + " ".join(m if m.startswith("@") else f"@{m}" for m in f["mentions"])]
    lines += ["", "🔖 저장해 두고, 같이 갈 사람에게 보내 주세요.",
              f"출처: {f['source_name']} {f['source_url']}".strip(),
              "방문 전 공식 안내에서 변경 사항을 꼭 확인하세요.", "", " ".join(tags)]
    out = "\n".join(lines)
    if pool:
        out += "\n\n----- 예비 해시태그 (인스타 캡션 5개 한도 밖 — 스레드·블로그·다른 날 교체용) -----\n" + " ".join(pool)
    return out


def _strip(s: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", re.sub(r"<br\s*/?>", " ", s))


def render(pages: list, out_dir: str, slug: str) -> list:
    from playwright.sync_api import sync_playwright
    css = CSS % {"W": W, "H": H, **RISO}
    doc = f"<!doctype html><html><head><meta charset='utf-8'><style>{css}</style></head><body>" + \
          "".join(pages) + "</body></html>"
    html_path = os.path.join(out_dir, f"{slug}_slides.html")
    with open(html_path, "w", encoding="utf-8") as fh:
        fh.write(doc)
    files = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        pg.goto("file:///" + os.path.abspath(html_path).replace("\\", "/"), wait_until="networkidle")
        pg.evaluate("document.fonts.ready")
        pg.wait_for_function("document.fonts.check(\"40px 'Black Han Sans'\") && document.fonts.check(\"40px 'Pretendard Variable'\")", timeout=20000)
        for i, el in enumerate(pg.query_selector_all(".slide"), 1):
            png = os.path.join(out_dir, f"{slug}_{i:02d}.png")
            el.screenshot(path=png)
            files.append(png)
        b.close()
    os.remove(html_path)
    # Graph API 캐러셀은 JPEG 만 받는다
    from PIL import Image
    jdir = os.path.join(out_dir, "jpeg_for_api")
    os.makedirs(jdir, exist_ok=True)
    for png in files:
        Image.open(png).convert("RGB").save(os.path.join(jdir, os.path.basename(png)[:-4] + ".jpg"), quality=92)
    return files


def list_today(db, day: str):
    rows = db.supabase.table("events").select("id,title,region,category,event_date_start,event_date_end,poster_image_url") \
        .eq("status", "PUBLISHED").lte("event_date_start", day).gte("event_date_end", day).execute().data
    rows.sort(key=lambda r: (r["event_date_start"] != r["event_date_end"], not r["poster_image_url"]))
    for r in rows:
        one = "하루" if r["event_date_start"] == r["event_date_end"] else "기간"
        print(f"{r['id']}  [{one}] {r['region']} {r['category']}  {r['title']}  {'' if r['poster_image_url'] else '(포스터 없음)'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("event_id", nargs="?")
    ap.add_argument("--facts")
    ap.add_argument("--out", default=os.path.join(os.path.expanduser("~"), "Desktop", "pick-art_인스타"))
    ap.add_argument("--slug")
    ap.add_argument("--handle", default="")
    ap.add_argument("--today")
    a = ap.parse_args()
    db = Database()
    if a.today:
        return list_today(db, a.today)
    if not a.event_id:
        ap.error("event_id 또는 --today 가 필요합니다")
    ev = db.supabase.table("events").select("*").eq("id", a.event_id).single().execute().data
    facts = {}
    if a.facts:
        with open(a.facts, encoding="utf-8") as fh:
            facts = json.load(fh)
    f = build_facts(ev, facts)
    slug = a.slug or a.event_id[:8]
    os.makedirs(a.out, exist_ok=True)
    pages = slides_html(f, poster_data_uri(ev.get("poster_image_url")), a.handle)
    files = render(pages, a.out, slug)
    cap = os.path.join(a.out, f"{slug}_caption.txt")
    with open(cap, "w", encoding="utf-8") as fh:
        fh.write(caption_text(f, a.handle))
    for x in files + [cap]:
        print(x)


if __name__ == "__main__":
    main()
