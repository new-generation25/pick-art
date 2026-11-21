"""여러 행사를 한 게시물로 묶는 인스타그램 캐러셀(1080x1350)을 만든다.

예: 「김해, 오늘 어디 가지?」, 「이번 주말 부산 공연」.
단독 카드(make_insta_cards.py)와 같은 리소 색·글꼴·렌더러를 쓴다. 사실은 roundup JSON에
공식 안내로 확인한 값만 넣는다(빈 값은 장에서 뺀다). 게시는 하지 않는다.

장 구성: 1 표지(때·질문) → 2 한눈에 보기(목록) → 행사마다 1장(group 이면 포스터 여러 장) → 끝 요청 하나.

사용:
  python tools/make_insta_roundup.py <roundup.json> --out <DIR>

roundup JSON 키: slug, chip, kicker, hook, cover_band, summary_title, sources,
  items[]: tag, title, short, when, venue, price, what, poster, credit,
           group(true 이면 parts[]: title, room, poster)
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_insta_cards import CSS, RISO, W, H, esc, poster_data_uri, render  # noqa: E402

HANDLE = "@picka.news"

EXTRA_CSS = """
.rcover .stack { position: absolute; right: 30px; top: 175px; width: 600px; height: 900px; }
.rcover .stack .p { position: absolute; border: 4px solid %(ink)s; background: #fff; box-shadow: 10px 10px 0 %(blue)s; }
.rcover .stack .p img { display: block; height: 440px; width: auto; max-width: 340px; object-fit: contain; }
.rcover .hook { position: absolute; left: 72px; top: 240px; width: 560px; font-size: 112px; line-height: 1.04; z-index: 3; }
.rcover .titlebox { position: absolute; left: 0; right: 0; bottom: 96px; padding: 28px 72px; font-size: 44px; font-weight: 900; z-index: 3; }
.list { border: 4px solid %(ink)s; background: %(card)s; }
.list .r { display: grid; grid-template-columns: 70px 1fr; align-items: center; border-top: 3px dotted %(ink)s; padding: 36px 26px; gap: 18px; }
.list .r:first-child { border-top: none; }
.list .n { font-family: 'Black Han Sans', sans-serif; font-size: 52px; color: %(blue)s; }
.list .t { font-size: 44px; font-weight: 800; line-height: 1.2; }
.list .s { font-size: 31px; font-weight: 600; color: %(ink_soft)s; margin-top: 4px; }
.list .tg { display: inline-block; background: %(pink)s; border: 3px solid %(ink)s; font-size: 24px; font-weight: 800; padding: 2px 10px; margin-right: 10px; vertical-align: 4px; }
.one .poster { position: absolute; left: 72px; top: 290px; width: 500px; border: 4px solid %(ink)s; box-shadow: 10px 10px 0 %(pink)s; background: #fff; }
.one .poster img { display: block; width: 100%%; max-height: 900px; object-fit: contain; }
.one .info { position: absolute; left: 610px; right: 72px; top: 300px; }
.one .when { font-size: 54px; line-height: 1.15; margin: 22px 0 26px; }
.one .ti { font-size: 42px; font-weight: 900; line-height: 1.25; padding-bottom: 22px; border-bottom: 3px solid %(ink)s; }
.one .kv { font-size: 31px; font-weight: 700; line-height: 1.4; padding: 18px 0; border-bottom: 3px solid %(ink)s; }
.one .kv span { display: block; font-size: 24px; font-weight: 800; color: %(ink_soft)s; }
.grp .row3 { position: absolute; left: 72px; right: 72px; top: 540px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; }
.grp .row3 .p { border: 4px solid %(ink)s; background: #fff; box-shadow: 8px 8px 0 %(pink)s; }
.grp .row3 .p img { display: block; width: 100%%; height: 440px; object-fit: contain; background: #fff; }
.grp .row3 .cap { font-size: 26px; font-weight: 800; line-height: 1.3; margin-top: 18px; }
.grp .row3 .cap span { display: block; font-size: 23px; font-weight: 600; color: %(ink_soft)s; margin-top: 4px; }
"""


def build(spec: dict) -> list:
    items = spec["items"]
    n_total = 2 + len(items) + 1
    brand = f'<div class="brand">픽아트 <b>pica</b> · {esc(HANDLE)}</div>'

    def top(i):
        return f'<div class="top">{brand}<div class="page">{i}/{n_total}</div></div>'

    def credit(text):
        return f'<div class="credit"><span>{esc(text)}</span><span>문화예술 큐레이션</span></div>'

    posters = []
    for it in items:
        if it.get("group"):
            posters += [p["poster"] for p in it["parts"]]
        else:
            posters.append(it["poster"])
    uri = {p: poster_data_uri(p) for p in posters}
    out = []

    # 1. 표지: 포스터 3장을 엽서처럼 겹쳐 놓고, 때·질문을 가장 크게
    picks = posters[:3]
    pos = [("right:230px;top:430px;transform:rotate(-6deg)"), ("right:20px;top:420px;transform:rotate(5deg)"),
           ("right:120px;top:500px;transform:rotate(-1deg)")]
    stack = "".join(f'<div class="p" style="{pos[i]}"><img src="{uri[p]}"></div>' for i, p in enumerate(picks))
    out.append(f"""
<div class="slide cover rcover"><div class="top">{brand}</div>
  <div class="chips"><span class="chip pink">{esc(spec['chip'])}</span><span class="chip">{esc(spec['kicker'])}</span></div>
  <div class="stack">{stack}</div>
  <div class="hook disp print">{esc(spec['hook'])}</div>
  <div class="titlebox band">{esc(spec['cover_band'])}</div>
  <div class="swipe" style="top:1000px">넘겨서 보기 →</div>
  {credit('포스터: 각 주최 측')}
</div>""")

    # 2. 한눈에 보기
    rows = "".join(
        f'<div class="r"><div class="n">{i}</div><div><div class="t"><span class="tg">{esc(it["tag"])}</span>{esc(it["short"])}</div>'
        f'<div class="s">{esc(" · ".join(x for x in [it["when"], it["venue"]] if x))}</div></div></div>'
        for i, it in enumerate(items, 1))
    out.append(f"""
<div class="slide">{top(2)}
  <div class="pad disp h2 print" style="top:170px">{esc(spec['summary_title'])} {len(items)}</div>
  <div class="pad list" style="top:330px">{rows}</div>
  {credit('방문 전 공식 안내에서 변경 사항을 확인하세요')}
</div>""")

    # 3. 행사마다 한 장
    for i, it in enumerate(items, 3):
        if it.get("group"):
            cells = "".join(
                f'<div><div class="p"><img src="{uri[p["poster"]]}"></div><div class="cap">{esc(p["title"])}<span>{esc(p["room"])}</span></div></div>'
                for p in it["parts"])
            out.append(f"""
<div class="slide grp">{top(i)}
  <div class="pad" style="top:160px"><span class="chip pink">{esc(it['tag'])}</span></div>
  <div class="pad disp" style="top:250px;font-size:70px;line-height:1.12">{esc(it['title'])}</div>
  <div class="pad" style="top:425px;font-size:36px;font-weight:800">{esc(it['when'])}</div>
  <div class="row3">{cells}</div>
  {credit('포스터·정보: ' + it['credit'])}
</div>""")
            continue
        kv = "".join(f'<div class="kv"><span>{k}</span>{esc(v)}</div>'
                     for k, v in [("장소", it["venue"]), ("요금", it["price"]), ("한 줄", it.get("what", ""))] if v)
        out.append(f"""
<div class="slide one">{top(i)}
  <div class="pad" style="top:170px"><span class="chip pink">{esc(it['tag'])}</span> <span class="chip">오늘</span></div>
  <div class="poster"><img src="{uri[it['poster']]}"></div>
  <div class="info">
    <div class="ti">{esc(it['title'])}</div>
    <div class="when disp">{esc(it['when'])}</div>
    {kv}
  </div>
  {credit('포스터·정보: ' + it['credit'])}
</div>""")

    # 끝. 요청 하나
    out.append(f"""
<div class="slide cta">
  <div class="top"><div class="brand" style="color:#fff">픽아트 <b style="color:{RISO['pink']}">pica</b> · {esc(HANDLE)}</div><div class="page" style="color:#fff">{n_total}/{n_total}</div></div>
  <div class="pad disp big" style="top:240px">같이 갈<br>사람에게<br>보내기</div>
  <div class="pad" style="top:760px;font-size:38px;font-weight:800;line-height:1.45">다른 날 공연·전시는<br>프로필 링크에서 볼 수 있어요</div>
  <div class="pad src" style="top:1010px">출처 · {esc(spec['sources'])}<br>방문 전 공식 안내에서 변경 사항을 꼭 확인하세요.</div>
  <div class="credit"><span>포스터: 각 주최 측</span><span>문화예술 큐레이션</span></div>
</div>""")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    spec = json.load(open(a.spec, encoding="utf-8"))
    os.makedirs(a.out, exist_ok=True)
    import make_insta_cards as m
    m.CSS = CSS + EXTRA_CSS  # render() 가 모듈의 CSS 를 읽는다
    for f in render(build(spec), os.path.abspath(a.out), spec["slug"]):
        print(f)


if __name__ == "__main__":
    main()
