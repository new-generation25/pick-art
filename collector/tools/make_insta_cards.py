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
  python tools/make_insta_cards.py <event_id> --story [--facts f.json] [--slug NAME]
      스토리 1장(1080x1920) <slug>_story.png + jpeg_for_api/<slug>_story.jpg 만 만든다(2026-11-27 피드 5건 + 스토리).
      facts 의 story_hook(없으면 hook)·chip·poster 를 쓴다. 위 250px·아래 340px 은 인스타 화면이 덮어 글자를 두지 않는다.

facts JSON 키(모두 선택): hook, kicker, title, date_label, time, venue, address, price,
  audience, what[], how[], contact, notice, cover_note, chip(표지 분홍 칩, 기본 "오늘 날짜"), poster(로컬 경로·URL, DB 포스터 대신), source_name, source_url, poster_credit,
  hashtags[](본 캡션용, 5개 이하), hashtags_pool[](예비), caption_lead, mentions[](주관 측 @계정)
"""
import argparse
import base64
import html
import json
import os
import re
import sys
from datetime import date

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402

W, H = 1080, 1350
STORY_H = 1920
WEEK = "월화수목금토일"
# 인스타그램은 2025-12 부터 게시물·릴스 캡션의 해시태그를 5개까지로 줄이고 있다
MAX_TAGS = 5

# frontend/src/app/globals.css 의 .pica-public[data-pica-theme="riso"] 값
RISO = {
    "paper": "#ecede6", "card": "#f7f7f2", "ink": "#1a1a1a", "ink_soft": "#55554f",
    "blue": "#2350d8", "pink": "#ff4fa3",
}


def source_label(f) -> str:
    """출처는 계정 태그나 이름으로만 쓴다. 인스타 캡션의 주소는 눌리지 않으므로 링크를 넣지 않는다(2026-11-21 운영자 규칙).
    인스타 계정이 출처면 첫 @계정, 아니면 출처 이름."""
    ms = [m if m.startswith("@") else f"@{m}" for m in (f.get("mentions") or [])]
    if "instagram.com" in (f.get("source_url") or "") and ms:
        return f"{f.get('source_name') or ''} {ms[0]}".strip()
    return f.get("source_name") or ""


# 개인 휴대폰 번호(010 등)는 카드·캡션에 옮기지 않는다 — 주최 측 계정 DM 안내로 바꾼다(2026-11-26 운영자 결정).
# 기관 대표번호(055-, 051-, 1588- 등)는 그대로 둔다.
MOBILE = re.compile(r"(?<!\d)01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)")


def no_mobile(f: dict) -> list:
    """contact·how·what·notice 의 휴대폰 번호를 「@계정 DM」으로 바꾼다. 계정이 없으면 「주최 측 안내 참고」. 바꾼 칸 이름을 돌려준다."""
    ms = [m if m.startswith("@") else f"@{m}" for m in (f.get("mentions") or [])]
    dm = f"{ms[0]} DM" if ms else "주최 측 안내 참고"
    changed = []
    if MOBILE.search(f.get("contact") or ""):
        f["contact"] = MOBILE.sub(dm, f["contact"]); changed.append("contact")
    for k in ("how", "what"):
        if any(MOBILE.search(x or "") for x in f.get(k) or []):
            f[k] = [MOBILE.sub(dm, x or "") for x in f[k]]; changed.append(k)
    if MOBILE.search(f.get("notice") or ""):
        f["notice"] = MOBILE.sub(dm, f["notice"]); changed.append("notice")
    return changed


def kdate(d: str) -> str:
    y, m, dd = map(int, d.split("-"))
    return f"{m}.{dd}({WEEK[date(y, m, dd).weekday()]})"


def esc(s) -> str:
    return html.escape(str(s or "")).replace("\n", "<br>")


def poster_data_uri(url: str) -> str:
    if not url:
        return ""
    if os.path.exists(url):
        ext = os.path.splitext(url)[1].lstrip(".").lower().replace("jpg", "jpeg")
        return f"data:image/{ext};base64,{base64.b64encode(open(url, 'rb').read()).decode()}"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    ctype = r.headers.get("content-type", "image/webp").split(";")[0]
    return f"data:{ctype};base64,{base64.b64encode(r.content).decode()}"


def build_facts(ev: dict, facts: dict) -> dict:
    """DB 행에서 기본값을 만들고 facts 로 덮어쓴다."""
    s, e = ev["event_date_start"], ev["event_date_end"]
    date_label = kdate(s) if s == e else f"{kdate(s)} ~ {kdate(e)}"
    price = ev.get("price_info") or ("무료" if ev.get("is_free") else "")
    # 지역은 시군 이름만 쓴다. '경남'을 앞세우지 않는다(2026-11-01 사용자 지시)
    region = ev.get("region") or ""
    cat = ev.get("category") or "행사"
    title_tag = "#" + re.sub(r"[^0-9A-Za-z가-힣]", "", ev["title"])
    f = {
        "title": ev["title"],
        "kicker": f"{region} · {cat}" if region else cat,
        "hook": f"오늘 {region}에서\n{cat} 한 편 어때요?" if region else f"오늘\n{cat} 한 편 어때요?",
        "date_label": date_label,
        "time": "", "venue": ev.get("venue") or "", "address": "",
        "price": price, "audience": "",
        "what": [], "how": [], "contact": "", "notice": "", "cover_note": "",
        "source_name": ev.get("source") or "", "source_url": ev.get("original_url") or "",
        "poster_credit": "",
        "hashtags": ([f"#{region}가볼만한곳", f"#{region}{cat}", title_tag, f"#{region}주말"]
                     if region else [title_tag, f"#{cat}"]) + ["#픽아트"],
        "hashtags_pool": [],
        "caption_lead": "", "mentions": [],
    }
    f.update({k: v for k, v in facts.items() if v not in (None, "")})
    # "-" 는 DB 기본값을 지우고 칸을 뺀다 (공식 안내에 없는 값을 DB 추정으로 채우지 않게)
    f.update({k: "" for k, v in facts.items() if v == "-"})
    if not f.get("chip"):
        f["chip"] = f"오늘 {f['date_label']}"
    if not f["poster_credit"]:
        f["poster_credit"] = f"포스터 출처: {f['source_name']}" if f["source_name"] else ""
    f["region"], f["category"] = region, cat
    changed = no_mobile(f)
    if changed:
        print(f"[문의] 개인 휴대폰 번호를 계정 DM 안내로 바꿈: {', '.join(changed)}")
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
.cover .poster { position: absolute; right: 18px; top: 165px; transform: rotate(3deg);
  border: 4px solid %(ink)s; box-shadow: 14px 14px 0 %(blue)s; background: #fff; }
.cover .poster img { display: block; height: 925px; width: auto; max-width: 760px; object-fit: contain; }
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

/* 스토리 1장 (1080x1920). 위 250px·아래 340px 은 인스타 화면(프로필 줄·답장 칸)이 덮는다 */
.story { height: 1920px; }
.story .top { top: 270px; }
.story .chips { position: absolute; left: 72px; top: 350px; display: flex; gap: 14px; z-index: 3; }
.story .hook { position: absolute; left: 72px; right: 72px; top: 430px; font-size: 82px; line-height: 1.06; }
.story .poster { position: absolute; left: 50%%; top: 780px; transform: translateX(-50%%) rotate(2deg);
  border: 4px solid %(ink)s; box-shadow: 14px 14px 0 %(blue)s; background: #fff; }
.story .poster img { display: block; height: 640px; width: auto; max-width: 860px; object-fit: contain; }
.story .titlebox { position: absolute; left: 0; right: 0; top: 1470px; padding: 24px 72px; }
.story .titlebox .t { font-size: 46px; font-weight: 900; line-height: 1.22; }
.story .titlebox .s { font-size: 32px; margin-top: 6px; opacity: .92; font-weight: 600; }
.story .more { position: absolute; left: 72px; right: 72px; top: 1640px; font-size: 28px; font-weight: 700; color: %(ink_soft)s; }

/* 6. 제보 이벤트 · 7. 단체 안내 */
.event .ev-big { display: flex; align-items: flex-end; gap: 22px; }
.event .ev-big .n { font-family: 'Black Han Sans', sans-serif; font-size: 240px; line-height: .85; color: %(blue)s; }
.event .ev-big span:last-child { font-size: 56px; font-weight: 900; line-height: 1.2; padding-bottom: 12px; }
.event .ways div { font-size: 40px; font-weight: 700; padding: 26px 30px; margin-bottom: 18px; background: %(card)s; border: 3px solid %(ink)s; }
.event .ways b, .group .gocta b { font-weight: 900; }
.event .small { font-size: 26px; font-weight: 500; color: %(ink_soft)s; line-height: 1.55; }
.group .gl div { font-size: 40px; font-weight: 700; line-height: 1.4; padding: 26px 0; border-bottom: 3px solid %(ink)s; }
.group .gocta { background: %(blue)s; color: #fff; font-size: 36px; font-weight: 700; line-height: 1.5; padding: 30px 36px; border: 4px solid %(ink)s; }

/* 4. 반으로 나눈 장 */
.how .half { position: absolute; left: 72px; right: 72px; }
.how .half.up { top: 150px; height: 520px; }
.how .half.down { top: 700px; height: 520px; border-top: 4px solid %(ink)s; padding-top: 50px; }
.how .h3 { font-size: 68px; line-height: 1.1; margin-bottom: 34px; }
.how .half li { font-size: 38px; margin-bottom: 26px; }
.how .half li::before { width: 72px; height: 72px; font-size: 44px; }
.how .half li.ct::before { content: '☎'; font-size: 36px; }
.how .where { font-size: 46px; font-weight: 800; line-height: 1.35; }
.how .where .wa { font-size: 32px; font-weight: 600; color: %(ink_soft)s; margin-top: 8px; padding-left: 58px; }
.how .where .wv { display: inline; }
.how .hint { margin-top: 40px; display: inline-block; background: %(card)s; border: 3px solid %(ink)s; padding: 16px 26px; font-size: 32px; font-weight: 700; }
.how .hint b { color: %(blue)s; }

/* 6. 피카 소개 */
.intro .story-txt p { font-size: 40px; font-weight: 600; line-height: 1.55; margin-bottom: 34px; }
.intro .story-txt b { color: %(blue)s; }
.intro .feats { display: flex; gap: 16px; }
.intro .feats span { border: 3px solid %(ink)s; background: %(card)s; padding: 12px 22px; font-size: 30px; font-weight: 800; }
.intro .gocta { background: %(blue)s; color: #fff; font-size: 40px; font-weight: 700; line-height: 1.4; padding: 30px 36px; border: 4px solid %(ink)s; }
.intro .gocta b { font-weight: 900; }
.intro .gocta .cnt { display: inline-block; margin-top: 18px; font-size: 32px; font-weight: 700; opacity: .92; }

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
    n_total = 7  # 행사 4장 + 피카 소개 1장 + 제보 이벤트 1장 + 단체 안내 1장(2026-11-27 운영자 지시)
    brand = f'<div class="brand">픽아트 <b>pica</b>{(" · " + esc(handle)) if handle else ""}</div>'

    def top(i):
        return f'<div class="top">{brand}<div class="page">{i}/{n_total}</div></div>'

    credit = f'<div class="credit"><span>{esc(f["poster_credit"])}</span><span>문화예술 큐레이션</span></div>'
    out = []

    # 1. 표지: 훅 + 포스터 + 제목 띠
    out.append(f"""
<div class="slide cover"><div class="top">{brand}</div>
  <div class="chips"><span class="chip pink">{esc(f['chip'])}</span><span class="chip">{esc(f['kicker'])}</span></div>
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

    # 4. 가는 법·예약 + 어디서 — 한 장을 위아래 반으로 나눠 각각 한 메시지(2026-11-27 운영자 지시)
    how = f["how"] or [f"공식 안내: {esc(f['source_name'])}"]
    contact = f'<li class="ct"><span>문의 {esc(f["contact"])}</span></li>' if f["contact"] else ""
    where = (f'<div class="wv">{esc(f["venue"])}</div>'
             f'{"<div class=wa>" + esc(f["address"]) + "</div>" if f["address"] else ""}') if f["venue"] else '<div class="wv">장소는 공식 안내 확인</div>'
    out.append(f"""
<div class="slide how">{top(4)}
  <div class="half up">
    <div class="disp h3 print">이렇게 가요</div>
    <ol>{''.join(f'<li><span>{x}</span></li>' for x in how)}{contact}</ol>
  </div>
  <div class="half down">
    <div class="disp h3 print">어디서 해요?</div>
    <div class="where">📍 {where}</div>
    <div class="hint">지도·길찾기는 <b>프로필 링크 → 피카</b>에서</div>
  </div>
  {credit}
</div>""")

    # 5. 피카 소개 — 왜 만들었는지 + 사이트로 오는 길(2026-11-27 운영자 지시)
    # 주소는 카드에 쓰지 않는다(2026-11-21 링크 금지 규칙). 사이트는 「프로필 링크」로 보낸다.
    out.append(f"""
<div class="slide intro">{top(5)}
  <div class="pad disp h2 print" style="top:170px">그래서<br>피카를 만들었어요</div>
  <div class="pad story-txt" style="top:420px">
    <p>몇 달 동안 준비한 동네 극단, 작은 합창단, 예술가의 전시가 포스터 몇 장 붙이고 소리 소문 없이 끝나는 일이 많아요.</p>
    <p>피카(pick art)는 흩어진 이런 소식을 매일 모아 <b>출처를 확인하고</b> 여러분들에게 전해 드려요.</p>
  </div>
  <div class="pad feats" style="top:900px"><span>오늘·이번 주</span><span>지역·분야로 고르기</span><span>지도로 보기</span></div>
  <div class="pad gocta" style="bottom:120px">가까운 공연·전시·축제 전체는<br><b>프로필 링크 → 피카</b>에서 볼 수 있어요{f'<br><span class="cnt">현재 등록된 부산경남 소식 {f["live_count"]:,}개</span>' if f.get("live_count") else ''}</div>
  {credit}
</div>""")

    # 6. 숨은 행사 찾기 — 제보 이벤트(2026-11-27 운영자 결정, 이름 「숨은 행사 찾기」, docs/PLAN_community_2026-11.md 12-1)
    out.append(f"""
<div class="slide event">{top(6)}
  <div class="pad" style="top:160px"><span class="chip pink">숨은 행사 찾기</span></div>
  <div class="pad disp h2 print" style="top:250px">우리 동네 행사,<br>알려 주세요</div>
  <div class="pad ev-big" style="top:480px"><span class="n">5</span><span>명께 매주<br>커피 쿠폰</span></div>
  <div class="pad ways" style="top:760px">
    <div><b>피카 사이트</b> 「행사 제보하기」</div>
    <div><b>카카오톡 채널 «피카»</b> 「행사 알리기」</div>
  </div>
  <div class="pad small" style="bottom:110px">그 주에 확인해서 피카에 실린 제보 가운데 골라요 · 당첨은 카카오톡 채널 «피카»에서 알려요<br>제일 많이 알리신 두 분은 무조건 당첨.<br>이 이벤트는 인스타그램이 후원·보증·관리하지 않으며, 인스타그램과 관련이 없습니다.</div>
</div>""")

    # 7. 단체·예술가 안내(2026-11-27 운영자 결정, 같은 문서 12-3)
    out.append(f"""
<div class="slide group">{top(7)}
  <div class="pad" style="top:160px"><span class="chip pink">단체·예술가 대상 안내</span></div>
  <div class="pad disp h2 print" style="top:250px">작은 공연·전시,<br>무료로 실어 드려요</div>
  <div class="pad gl" style="top:540px">
    <div>신청하신 행사는 그 주에 먼저 소개해요</div>
    <div>한 번 동의하면 앞으로의 소식도 계속 실어요</div>
    <div>원하지 않으시면 언제든 그만두실 수 있어요</div>
  </div>
  <div class="pad gocta" style="bottom:120px">신청: <b>프로필 링크 → 피카</b> 「동의하고 파트너십 맺기」<br>또는 카카오톡 채널 «피카» 「행사 알리기」</div>
</div>""")
    return out


def story_html(f: dict, poster: str, handle: str) -> str:
    """스토리 1장. 표지와 같은 말(때·훅·포스터·제목)을 세로 판에 맞게 다시 놓는다."""
    brand = f'<div class="brand">픽아트 <b>pica</b>{(" · " + esc(handle)) if handle else ""}</div>'
    hook = f.get("story_hook") or f["hook"]
    sub = " · ".join(x for x in [f["date_label"], f["time"], f["venue"]] if x)
    return f"""
<div class="slide story"><div class="top">{brand}</div>
  <div class="chips"><span class="chip pink">{esc(f['chip'])}</span><span class="chip">{esc(f['kicker'])}</span></div>
  <div class="hook disp print">{esc(hook)}</div>
  {f'<div class="poster"><img src="{poster}"></div>' if poster else ''}
  <div class="titlebox band"><div class="t">{esc(f['title'])}</div><div class="s">{esc(sub)}</div></div>
  <div class="more">{esc(f['poster_credit'])}<br>자세한 안내는 프로필 링크(피카)에서 · 방문 전 공식 안내 확인</div>
</div>"""


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
              "👉 이번 주 다른 공연·전시는 프로필 링크(피카 사이트)에서 지역별로 볼 수 있어요.",
              f"출처: {source_label(f)}",
              "방문 전 공식 안내에서 변경 사항을 꼭 확인하세요.", "", " ".join(tags)]
    out = "\n".join(lines)
    if pool:
        out += "\n\n----- 예비 해시태그 (인스타 캡션 5개 한도 밖 — 스레드·블로그·다른 날 교체용) -----\n" + " ".join(pool)
    return out


def _strip(s: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", re.sub(r"<br\s*/?>", " ", s))


# 새 화면 테마 (2026-11-27 운영자 제안 「기존 레이아웃은 유지하고 버튼·폰트·컬러만」 — 시안 단계, 기본값은 riso 그대로)
# 사이트 화면 팔레트·글꼴(BRAND_GUIDE 2·3절 2026-11-26): 종이·흰 면·짙은 초록, 제목 Gowun Batang, 숫자 Space Grotesk
SCREEN = {"paper": "#F4EFE6", "card": "#FFFFFF", "ink": "#1E1A15", "ink_soft": "#6B6257", "blue": "#2E6B4E", "pink": "#E6EFE9"}
SCREEN_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Space+Grotesk:wght@600;700&display=block');
.slide::before { display: none; }
.disp { font-family: 'Gowun Batang', serif; font-weight: 700; letter-spacing: -0.03em; }
.print { text-shadow: none; }
.brand { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 34px; letter-spacing: -0.5px; }
.brand b { color: #2E6B4E; }
.brand span { font-weight: 600; font-size: 26px; color: #6B6257; margin-left: 10px; }
.chip { border: none; border-radius: 999px; background: #fff; box-shadow: 0 2px 8px rgba(30,26,21,.14); padding: 10px 26px; }
.chip.pink { background: #2E6B4E; color: #fff; }
.band { background: #2E6B4E; }
.cover .poster { border: none; border-radius: 12px; box-shadow: 0 8px 26px rgba(30,26,21,.24); }
.cover .sticker { border: none; border-radius: 999px; background: #E6EFE9; color: #2E6B4E; }
.cover .swipe { border-radius: 999px; padding: 12px 26px; }
.ticket { border: none; border-radius: 22px; background: #fff; box-shadow: 0 3px 14px rgba(30,26,21,.12); overflow: hidden; }
.ticket .row { border-top: 2px solid #E3DBCD; }
.ticket .k { background: transparent; color: #6B6257; font-weight: 700; }
.notice { border: none; border-left: 8px solid #2E6B4E; border-radius: 14px; background: #E6EFE9; }
.what .poster2 { border: none; border-radius: 12px; box-shadow: 0 6px 20px rgba(30,26,21,.2); }
.what li, .what li:first-child { border-color: #E3DBCD; }
.how li::before { font-family: 'Space Grotesk', sans-serif; font-weight: 700; border-radius: 50%; box-shadow: none; }
.cover .hook { font-size: 62px; line-height: 1.18; width: 400px; }
.story .hook { font-size: 78px; }
.cta .big { text-shadow: none; }
.cta .brand b { color: #E6EFE9; }
.cta .brand span { color: rgba(255,255,255,.8); }
.cta .act { border: none; border-radius: 22px; background: rgba(255,255,255,.14); }
.story .poster { border: none; border-radius: 12px; box-shadow: 0 8px 26px rgba(30,26,21,.24); }
.intro .feats span { border: none; border-radius: 999px; background: #fff; box-shadow: 0 2px 8px rgba(30,26,21,.14); }
.intro .gocta { border: none; border-radius: 22px; }
.how .half.down { border-top: 2px solid #E3DBCD; }
.how .hint { border: none; border-radius: 999px; background: #E6EFE9; }
.event .ev-big .n { font-family: 'Space Grotesk', sans-serif; letter-spacing: -8px; }
.event .ways div { border: none; border-radius: 20px; box-shadow: 0 3px 12px rgba(30,26,21,.12); }
.group .gl div { border-bottom: 2px solid #E3DBCD; }
.group .gocta { border: none; border-radius: 22px; }
"""
THEME = "screen"  # 2026-11-27 운영자 결정 「새 색·글꼴」


def _screen_page(html: str) -> str:
    """riso 표기(픽아트 pica · @계정)를 사이트 글자 로고(pica. + @계정)로 바꾼다."""
    html = re.sub(r'픽아트 <b(?: style="[^"]*")?>pica</b>(?: · ([^<]+))?',
                  lambda m: 'pica<b>.</b>' + (f'<span>{m.group(1)}</span>' if m.group(1) else ''), html)
    return html.replace('<b style="color:#ff4fa3">', '<b>')


def render(pages: list, out_dir: str, slug: str, height: int = H, names: list = None) -> list:
    from playwright.sync_api import sync_playwright
    if THEME == "screen":
        imp, rest = SCREEN_CSS.strip().split("\n", 1)  # @import 는 맨 앞에 있어야 먹는다
        css = imp + "\n" + CSS % {"W": W, "H": H, **SCREEN} + rest
        pages = [_screen_page(pg) for pg in pages]
    else:
        css = CSS % {"W": W, "H": H, **RISO}
    doc = f"<!doctype html><html><head><meta charset='utf-8'><style>{css}</style></head><body>" + \
          "".join(pages) + "</body></html>"
    html_path = os.path.join(out_dir, f"{slug}_slides.html")
    with open(html_path, "w", encoding="utf-8") as fh:
        fh.write(doc)
    files = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": W, "height": height}, device_scale_factor=1)
        pg.goto("file:///" + os.path.abspath(html_path).replace("\\", "/"), wait_until="networkidle")
        pg.evaluate("document.fonts.ready")
        title_font = "Gowun Batang" if THEME == "screen" else "Black Han Sans"
        pg.wait_for_function(f"document.fonts.check(\"40px '{title_font}'\") && document.fonts.check(\"40px 'Pretendard Variable'\")", timeout=20000)
        for i, el in enumerate(pg.query_selector_all(".slide"), 1):
            png = os.path.join(out_dir, f"{slug}_{names[i - 1]}.png" if names else f"{slug}_{i:02d}.png")
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
    ap.add_argument("--story", action="store_true", help="스토리 1장(1080x1920)만 만든다")
    ap.add_argument("--theme", choices=["riso", "screen"], default="screen", help="screen = 사이트 새 화면 색·글꼴(2026-11-27 기본), riso = 옛 리소 테마")
    a = ap.parse_args()
    global THEME
    THEME = a.theme
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
    # 5장 「현재 등록된 … 소식 N개」: 카드를 만드는 날 공개 중이고 아직 끝나지 않은 행사 수(2026-11-27 운영자 문구)
    try:
        f["live_count"] = db.supabase.table("events").select("id", count="exact").eq("status", "PUBLISHED")             .gte("event_date_end", date.today().isoformat()).limit(1).execute().count
    except Exception:
        f["live_count"] = None
    slug = a.slug or a.event_id[:8]
    os.makedirs(a.out, exist_ok=True)
    poster = poster_data_uri(facts.get("poster") or ev.get("poster_image_url"))
    if a.story:
        for x in render([story_html(f, poster, a.handle)], a.out, slug, height=STORY_H, names=["story"]):
            print(x)
        return
    pages = slides_html(f, poster, a.handle)
    files = render(pages, a.out, slug)
    cap = os.path.join(a.out, f"{slug}_caption.txt")
    with open(cap, "w", encoding="utf-8") as fh:
        fh.write(caption_text(f, a.handle))
    for x in files + [cap]:
        print(x)


if __name__ == "__main__":
    main()
