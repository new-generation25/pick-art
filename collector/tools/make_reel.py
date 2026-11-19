"""
facts 폴더로 «무료 공연·전시 모음» 릴스(1080×1920 mp4)를 만든다.

2026-11-19 시안(퀴즈·0원 도장·룰렛)이 «AI 티가 난다»는 평을 받고 다시 짰다.
기준: auto-short-video/research 13(한국 쇼츠 실측)·21(King받은 이도 릴스 실측), 브랜드 가이드 13절.
  - 포스터는 자르지도 덮지도 않는다(통째로, 위에 아무것도 안 얹음)
  - 흔들림·도장·쾅 효과·이모지·합성 효과음 없음. 하드컷과 아주 느린 밀기만
  - 위 제목은 처음부터 끝까지 고정(쇼츠는 썸네일이 없어 제목이 곧 썸네일)
  - 처음 2.4초는 실제 포스터를 빠르게 넘겨 보여 주고, 설명은 그 뒤
  - 행사당 1.5초, 가장 큰 글자는 «때»
  - 끝 5초는 전체 목록 한 장(저장할 이유). 로고 카드 없음
  - 소리 없음 → 게시할 때 앱에서 음악을 붙인다

  python tools/make_reel.py <facts 폴더> --out <폴더> [--sample] [--html-only]
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
H2V = Path("F:/projects/html-to-video")
DOW = "월화수목금토일"


def load_facts(folder: Path) -> list:
    out = []
    for p in sorted(folder.glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        d["_file"] = p.stem
        out.append(d)
    return out


def is_free(f: dict) -> bool:
    return str(f.get("price", "")).startswith("무료")


def db_poster(event_id: str) -> str:
    sys.path.insert(0, str(HERE.parent))
    from dotenv import load_dotenv
    load_dotenv(HERE.parent / ".env.local")
    from database import Database
    r = Database().supabase.table("events").select("poster_image_url").eq("id", event_id).execute()
    return (r.data[0].get("poster_image_url") or "") if r.data else ""


def fetch_poster(f: dict, dst: Path) -> bool:
    src = f.get("poster") or db_poster(f.get("id", ""))
    if not src:
        return False
    if re.match(r"https?://", src):
        import requests
        tmp = dst.with_suffix(".src")
        tmp.write_bytes(requests.get(src, timeout=30).content)
        src = str(tmp)
    im = Image.open(src).convert("RGB")
    im.thumbnail((1400, 1400))
    im.save(dst, quality=90)
    dst.with_suffix(".src").unlink(missing_ok=True)
    return True


def clean(s: str) -> str:
    """괄호 속 보충 설명을 뗀다: '오후 4시 (70분)' → '오후 4시'"""
    return re.sub(r"\s*\([^)]*\)", "", s or "").strip()


def when_line(f: dict) -> str:
    """가장 큰 글자. 하루 행사는 '22일 일요일 오후 5시', 기간 행사는 '11.21 ~ 12.4'"""
    d = f.get("date_label") or f.get("chip") or ""
    t = clean(f.get("time", "")) if f.get("time", "-") != "-" else ""
    m = re.match(r"(\d+)\.(\d+)\((.)\)$", d.strip())
    if m:
        return f"{int(m.group(2))}일 {m.group(3)}요일 {t}".strip()
    rng = re.sub(r"\((.)\)", "", d).replace(" ", "").replace("~", " ~ ")
    return rng


def short_title(f: dict) -> str:
    t = f["title"]
    m = re.search(r"〈[^〉]+〉", t)
    if m and len(t) > 22:
        head = t[: m.start()].strip()
        head = re.sub(r"^(제?\d+회|\d{4})\s*", "", head)
        t = f"{head.split()[-1] if head else ''} {m.group(0)}".strip()
    return t if len(t) <= 24 else t[:23] + "…"


def list_row(f: dict) -> dict:
    d = f.get("date_label") or f.get("chip") or ""
    m = re.match(r"(\d+)\.(\d+)\((.)\)", d)
    day = f"{int(m.group(1))}.{int(m.group(2))} {m.group(3)}" if m else d
    if "~" in d:
        day = re.sub(r"\((.)\)", "", d).replace(" ", "")
    city = f.get("kicker", "").split("·")[0].strip()
    return {"day": day, "city": city, "title": short_title(f)}


CSS = """
:root{--cream:#F6EFDF;--red:#D33A2C;--ink:#1C1C1C;--slate:#8C9BA8}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:var(--ink)}
body{font-family:'Pretendard Variable',sans-serif;word-break:keep-all;letter-spacing:-.02em;color:var(--cream)}
#title{position:absolute;left:64px;right:64px;top:190px}
#title .l1{font-size:66px;font-weight:900;line-height:1.15}
#title .l2{font-size:46px;font-weight:800;color:var(--red);margin-top:10px}
#posterBox{position:absolute;left:90px;right:90px;top:420px;height:720px;display:flex;align-items:center;justify-content:center}
#posterBox img{max-width:100%;max-height:100%;display:block}
#cnt{position:absolute;right:64px;top:388px;font-size:30px;font-weight:700;color:var(--slate)}
#when{position:absolute;left:64px;right:64px;top:1172px;font-size:84px;font-weight:900;line-height:1.1}
#where{position:absolute;left:64px;right:64px;top:1278px;font-size:42px;font-weight:700;color:var(--cream);opacity:.85}
#src{position:absolute;left:64px;right:64px;top:1340px;font-size:28px;font-weight:600;color:var(--slate)}
#list{position:absolute;left:64px;right:64px;top:420px;display:none}
.row{display:flex;gap:22px;align-items:baseline;padding:20px 0;border-bottom:2px solid rgba(246,239,223,.16)}
.row .d{width:270px;flex:none;font-size:40px;font-weight:900}
.row .c{width:90px;flex:none;font-size:34px;font-weight:800;color:var(--red)}
.row .t{font-size:34px;font-weight:700;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#foot{position:absolute;left:64px;right:64px;top:1300px;font-size:30px;font-weight:600;color:var(--slate);line-height:1.5;display:none}
"""

JS = """
const D = %s;
const FLICK = 0.3, ITEM = 1.5, LIST = 5.0;
const T_ITEM = FLICK * D.items.length, T_LIST = T_ITEM + ITEM * D.items.length, TOTAL = T_LIST + LIST;
const $ = id => document.getElementById(id);
D.items.forEach(it => { const i = new Image(); i.src = it.img; });
$('rows').innerHTML = D.items.map(it => `<div class="row"><div class="d">${it.row.day}</div><div class="c">${it.row.city}</div><div class="t">${it.row.title}</div></div>`).join('');
const start = performance.now();
function frame() {
  const t = (performance.now() - start) / 1000, img = $('pimg');
  if (t < T_ITEM) {               // 실제 포스터를 빠르게 넘김 — 글자는 제목만
    const k = Math.min(D.items.length - 1, Math.floor(t / FLICK));
    img.src = D.items[k].img; img.style.transform = 'scale(1)';
    ['when','where','src','cnt'].forEach(x => $(x).textContent = '');
  } else if (t < T_LIST) {        // 한 곳씩 1.5초, 아주 느리게 밀기
    const k = Math.min(D.items.length - 1, Math.floor((t - T_ITEM) / ITEM)), lt = t - T_ITEM - k * ITEM, it = D.items[k];
    img.src = it.img; img.style.transform = `scale(${1 + lt * 0.02})`;
    $('cnt').textContent = `${k + 1} / ${D.items.length}`;
    $('when').textContent = it.when; $('where').textContent = it.where; $('src').textContent = it.src;
  } else {
    $('posterBox').style.display = 'none'; ['when','where','src','cnt'].forEach(x => $(x).style.display = 'none');
    $('list').style.display = 'block'; $('foot').style.display = 'block';
  }
  if (t < TOTAL + .2) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
"""


def build_page(items: list, title1: str, title2: str, foot: str) -> str:
    data = {"items": items}
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>{CSS}</style></head><body>
<div id="title"><div class="l1">{title1}</div><div class="l2">{title2}</div></div>
<div id="cnt"></div>
<div id="posterBox"><img id="pimg"></div>
<div id="when"></div><div id="where"></div><div id="src"></div>
<div id="list"><div id="rows"></div></div>
<div id="foot">{foot}</div>
<script>{JS % json.dumps(data, ensure_ascii=False)}</script></body></html>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("facts")
    ap.add_argument("--out", required=True)
    ap.add_argument("--slug", default="free_reel")
    ap.add_argument("--max", type=int, default=8)
    ap.add_argument("--sample", action="store_true")
    ap.add_argument("--html-only", action="store_true")
    a = ap.parse_args()

    out = Path(a.out); (out / "p").mkdir(parents=True, exist_ok=True)
    fs = [f for f in load_facts(Path(a.facts)) if is_free(f)]
    items = []
    for f in fs:
        dst = out / "p" / f"{f['_file']}.jpg"
        if not fetch_poster(f, dst):
            print("포스터 없음, 뺌:", f["_file"]); continue
        venue = clean(f.get("venue", ""))
        city = f.get("kicker", "").split("·")[0].strip()
        items.append({"img": f"p/{dst.name}", "when": when_line(f),
                      "where": f"{city} · {venue}" if city and city not in venue else venue,
                      "src": f"출처 {f.get('source_name', '')}", "row": list_row(f)})
        if len(items) >= a.max:
            break
    if len(items) < 4:
        sys.exit(f"무료 행사가 {len(items)}건뿐이라 만들지 않는다(4건 이상 필요)")

    # 기간 행사는 끝나는 날이 멀어도 «이번 주»에 갈 수 있으니 시작일만 센다
    starts = [re.findall(r"(\d+)\.(\d+)", f.get("date_label", ""))[:1] for f in fs[: len(items)]]
    flat = sorted((int(m), int(d)) for ds in starts for m, d in ds)
    rng = f"{flat[0][0]}.{flat[0][1]} ~ {flat[-1][0]}.{flat[-1][1]}" if flat else ""
    title1 = "이번 주 돈 안 내고<br>볼 수 있는 공연·전시"
    title2 = f"{len(items)}곳 · {rng}"
    foot = "예약·잔여석은 공식 안내에서 한 번 더 확인하세요<br>@picka.news"
    html_path = out / f"{a.slug}.html"
    html_path.write_text(build_page(items, title1, title2, foot), encoding="utf-8")
    total = 0.3 * len(items) + 1.5 * len(items) + 5.0
    print(f"{html_path} · {len(items)}곳 · {total:.1f}초")
    if a.html_only:
        return
    if a.sample:
        pts = [0.1, 0.4 + 0.3 * 2] + [0.3 * len(items) + 1.5 * i + 0.7 for i in range(len(items))] + [total - 2]
        subprocess.run(["node", str(H2V / "capture.js"), str(html_path), "--sample",
                        ",".join(str(round(p * 30)) for p in pts), "--out", str(out / "samples")], check=True)
        return
    mp4 = out / f"{a.slug}.mp4"
    subprocess.run(["node", str(H2V / "build.js"), str(html_path), "--sec", f"{total:.2f}",
                    "--out", str(mp4)], check=True)
    print(mp4)


if __name__ == "__main__":
    main()
