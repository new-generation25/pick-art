"""시군 주간 캐러셀(브랜드 가이드 5-2 월요일 편성 「이번 주, 어디 가지?」)을 만든다.

표지 1장 + 행사마다 1장 + 저장·출처 1장. 행사 내용은 공식 페이지에서 확인한 값만 JSON 으로 넣는다.
화면 틀·색·글꼴은 make_insta_cards.py(리소 테마)와 같게 쓴다. 게시는 하지 않는다.

사용:
  python tools/make_insta_weekly.py <week.json> --out <폴더> [--slug NAME]

week.json:
  {"city": "김해", "range": "11.16 – 11.22", "hook": "이번 주,\\n김해\\n어디 가지?",
   "caption_lead": "...", "hashtags": [...5개], "hashtags_pool": [...],
   "events": [{"when": "11.17(화) 오후 2시", "tag": "전시 개막", "title": "...", "poster": "경로",
               "lines": ["📍 ...", "🎟 ..."], "note": "한 줄", "credit": "포스터·정보: 기관",
               "source_name": "...", "source_url": "..."}]}
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_insta_cards import CSS, RISO, MAX_TAGS, esc, poster_data_uri, render  # noqa: E402

BRAND = "피카 <b>pica</b>"

WEEKLY_CSS = """
.wk .hook { position: absolute; left: 72px; top: 150px; font-size: 150px; line-height: 1.02; }
.wk .range { position: absolute; left: 72px; top: 650px; }
.wk .grid { position: absolute; left: 72px; right: 72px; bottom: 120px; display: flex; gap: 14px; align-items: flex-end; }
.wk .grid img { flex: 1; min-width: 0; height: 330px; object-fit: cover; object-position: top; border: 4px solid %(ink)s; background: #fff; }
.wk .grid img:nth-child(odd) { transform: rotate(-2deg); } .wk .grid img:nth-child(even) { transform: rotate(2deg); }
.wk .count { position: absolute; right: 72px; top: 560px; font-size: 40px; font-weight: 900; background: %(pink)s; border: 4px solid %(ink)s; padding: 10px 24px; transform: rotate(-4deg); }
.ev .when { position: absolute; left: 72px; top: 150px; font-size: 92px; line-height: 1.05; }
.ev .tag { position: absolute; left: 72px; top: 262px; }
.ev .poster { position: absolute; left: 72px; top: 350px; width: 470px; border: 4px solid %(ink)s; box-shadow: 12px 12px 0 %(blue)s; background: #fff; }
.ev .poster img { display: block; width: 100%%; max-height: 700px; object-fit: contain; }
.ev .side { position: absolute; left: 590px; right: 72px; top: 350px; }
.ev .side .t { font-size: 50px; line-height: 1.16; }
.ev .side ul { list-style: none; margin-top: 28px; border-top: 3px solid %(ink)s; }
.ev .side li { font-size: 32px; font-weight: 700; line-height: 1.35; padding: 16px 0; border-bottom: 3px solid %(ink)s; }
.ev .note { position: absolute; left: 72px; right: 72px; bottom: 120px; font-size: 34px; font-weight: 800; line-height: 1.4; background: %(card)s; border: 4px solid %(ink)s; padding: 20px 26px; }
.cta .srcs { font-size: 25px; line-height: 1.55; color: rgba(255,255,255,.92); }
"""


def build(week: dict) -> list:
    evs = week["events"]
    total = len(evs) + 2

    def top(i, white=False):
        style = ' style="color:#fff"' if white else ""
        b = BRAND.replace("<b>", f'<b style="color:{RISO["pink"]}">') if white else BRAND
        return f'<div class="top"><div class="brand"{style}>{b}</div><div class="page"{style}>{i}/{total}</div></div>'

    posters = [poster_data_uri(e["poster"]) for e in evs]
    out = [f"""
<div class="slide wk">{top(1)}
  <div class="hook disp print">{esc(week['hook'])}</div>
  <div class="range"><span class="chip pink">{esc(week['range'])}</span></div>
  <div class="count">{len(evs)}곳 골랐어요</div>
  <div class="grid">{''.join(f'<img src="{p}">' for p in posters)}</div>
  <div class="credit"><span>포스터·정보: 각 기관 (마지막 장)</span><span>넘겨서 보기 →</span></div>
</div>"""]
    for i, (e, p) in enumerate(zip(evs, posters), 2):
        out.append(f"""
<div class="slide ev">{top(i)}
  <div class="when disp print">{esc(e['when'])}</div>
  <div class="tag"><span class="chip blue">{esc(e['tag'])}</span></div>
  <div class="poster"><img src="{p}"></div>
  <div class="side"><div class="t disp">{esc(e['title'])}</div>
    <ul>{''.join(f'<li>{esc(x)}</li>' for x in e['lines'])}</ul></div>
  {f'<div class="note">{esc(e["note"])}</div>' if e.get('note') else ''}
  <div class="credit"><span>{esc(e['credit'])}</span><span>가까운 공연·전시·축제</span></div>
</div>""")
    srcs = "<br>".join(f"{esc(e['credit'].replace('포스터·정보: ', ''))} · {esc(e['source_url'])}" for e in evs)
    out.append(f"""
<div class="slide cta">{top(total, white=True)}
  <div class="pad disp big" style="top:190px">같이 갈<br>사람<br>태그!</div>
  <div class="pad acts" style="top:640px">
    <div class="act"><span class="i">🔖</span>저장해 두기</div>
    <div class="act"><span class="i">📨</span>친구에게 보내기</div>
    <div class="act"><span class="i">➕</span>팔로우하고<br>매주 받기</div>
  </div>
  <div class="pad srcs" style="top:920px">출처<br>{srcs}<br>방문 전 공식 안내에서 변경 사항을 꼭 확인하세요.</div>
  <div class="credit"><span>pick-art.vercel.app</span><span>가까운 공연·전시·축제</span></div>
</div>""")
    return out


def caption(week: dict) -> str:
    tags = week["hashtags"][:MAX_TAGS]
    lines = [week["caption_lead"], ""]
    for n, e in enumerate(week["events"], 1):
        lines.append(f"{n}. {e.get('cap_title') or e['title'].replace(chr(10), ' ')}")
        lines.append(f"🗓 {e['cap_when']}")
        lines += [x for x in e["lines"] if x.startswith(("📍", "🎟"))]
        lines.append("")
    lines += ["같이 갈 사람 태그해 주세요. 저장해 두면 주말에 다시 찾기 쉬워요.", ""]
    lines += [f"출처 ▸ {e['source_name']} ({e['source_url']})" for e in week["events"]]
    lines += ["방문 전 공식 안내에서 변경 사항을 꼭 확인하세요.", "", " ".join(tags)]
    pool = [t for t in week.get("hashtags_pool", []) if t not in tags]
    text = "\n".join(lines)
    if pool:
        text += "\n\n----- 예비 해시태그 (캡션 5개 한도 밖) -----\n" + " ".join(pool)
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("week")
    ap.add_argument("--out", required=True)
    ap.add_argument("--slug", default="weekly")
    a = ap.parse_args()
    week = json.load(open(a.week, encoding="utf-8"))
    os.makedirs(a.out, exist_ok=True)
    import make_insta_cards
    make_insta_cards.CSS = CSS + WEEKLY_CSS  # render() 가 모듈의 CSS 를 쓴다
    files = render(build(week), a.out, a.slug)
    cap = os.path.join(a.out, f"{a.slug}_caption.txt")
    with open(cap, "w", encoding="utf-8") as fh:
        fh.write(caption(week))
    print("\n".join(files + [cap]))


if __name__ == "__main__":
    main()
