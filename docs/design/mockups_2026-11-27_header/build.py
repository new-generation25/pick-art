"""피카 화면 시안 4차(3번 색 + 1번 짜임 + 지도 버튼, 1안 3화면) 페이지 조립.

    python build.py

dirs/f01.html(시안 조각)과 captures/f01.json(tools/preview.py 확인 결과)을 모아
  - mockups_v4.html          한 파일. 포스터(축소본)·글꼴(쓰인 글자만)을 base64로 넣었다. 앱 미리보기·Artifact용
  - artifact.html            위 파일에서 문서 틀(<html>·<head>·<body>)을 뺀 Artifact 게시용
을 만든다. ?only=f01-home 을 붙이면 그 화면 하나만 375×812로 연다(캡처 확인용).
같은 포스터를 여러 시안이 쓰므로, 이미지는 한 번만 넣고 페이지가 열릴 때 제자리에 채운다.
"""
import base64, io, json, re, html
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parent
FULL = ROOT.parent / "mockups_2026-11-26_v2" / "fonts_full"
V2CAP = ROOT.parent / "mockups_2026-11-26_v2" / "captures"
NOW = ROOT.parent.parent / "plan" / "design_plan"
IMG_MAX_W = 480

FACES = [  # (family, weight, file)
    ("PT", "400", "Pretendard-Regular.ttf"), ("PT", "500", "Pretendard-Medium.ttf"), ("PT", "600", "Pretendard-SemiBold.ttf"),
    ("PT", "700", "Pretendard-Bold.ttf"), ("PT", "800", "Pretendard-ExtraBold.ttf"), ("BHS", "400", "BlackHanSans-Regular.ttf"),
    ("GB", "400", "GowunBatang-Regular.ttf"), ("GB", "700", "GowunBatang-Bold.ttf"), ("DH", "400", "DoHyeon-Regular.ttf"),
    ("SG", "300 700", "SpaceGrotesk-VF.ttf"), ("PX", "500", "IBMPlexMono-Medium.ttf"), ("PX", "600", "IBMPlexMono-SemiBold.ttf"),
]


def font_face_css(text):
    out = []
    for fam, w, f in FACES:
        opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["*"]; opts.notdef_outline = True
        font = TTFont(FULL / f)
        s = subset.Subsetter(opts); s.populate(text=text); s.subset(font)
        font.flavor = "woff2"; buf = io.BytesIO(); font.save(buf)
        b64 = base64.b64encode(buf.getvalue()).decode()
        out.append(f'@font-face{{font-family:"{fam}";src:url("data:font/woff2;base64,{b64}") format("woff2");font-weight:{w};font-display:block}}')
    return "\n".join(out)


def img_data(path: Path, max_w=IMG_MAX_W):
    im = Image.open(path).convert("RGBA")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    if path.name.startswith("logo"):
        buf = io.BytesIO(); im.save(buf, "PNG"); return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
    buf = io.BytesIO(); bg.convert("RGB").save(buf, "WEBP", quality=80, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


PAGE_CSS = """
.pg{--ink:#18181B;--soft:#5B5B63;--line:#D9D9DE;--bg:#F4F4F2;background:var(--bg);color:var(--ink);font-family:"PT",sans-serif;font-size:15px;line-height:1.6;word-break:keep-all}
.pg *{box-sizing:border-box}
.pg-in{max-width:1280px;margin:0 auto;padding-block:32px 96px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.pg h1,.pg h2,.pg h3,.pg p{margin:0}
.pg-meta{font-size:13px;font-weight:600;color:var(--soft)}
.pg-h1{font-size:40px;font-weight:800;line-height:1.15;letter-spacing:-.02em;margin-top:6px;text-wrap:balance}
.pg-lead{max-width:78ch;font-size:16px;margin-top:12px}
.pg-rules{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:20px}
.pg-rules div{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;font-size:14px}
.pg-rules b{display:block;font-size:15px;margin-bottom:4px}
.pg-toc{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.pg-toc a{font-size:14px;font-weight:700;color:var(--ink);text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 12px}
.pg-toc a:focus-visible,.pg-toc a:hover{border-color:var(--ink)}
.pg-now{margin-top:36px;display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
.pg-now figure{margin:0}
.pg-now img{width:180px;height:auto;border-radius:10px;border:1px solid var(--line);display:block}
.pg-now figcaption{font-size:12.5px;color:var(--soft);margin-top:6px;max-width:180px}
.pg-sec{margin-top:64px;border-top:2px solid var(--ink);padding-top:20px;scroll-margin-top:16px}
.pg-sec-h{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.pg-no{font-family:"SG",sans-serif;font-weight:700;font-size:40px;line-height:1;font-variant-numeric:tabular-nums}
.pg-sec-h h2{font-size:28px;font-weight:800;letter-spacing:-.02em}
.pg-bench{font-size:14px;font-weight:700;color:var(--soft)}
.pg-concept{max-width:80ch;margin-top:8px;font-size:15px}
.pg-sw{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:12.5px;color:var(--soft);align-items:center}
.pg-sw span{display:inline-flex;align-items:center;gap:6px}
.pg-sw i{width:16px;height:16px;border-radius:4px;border:1px solid rgba(0,0,0,.18);display:inline-block}
.pg-row{display:flex;gap:28px;margin-top:20px;overflow-x:auto;padding-bottom:8px;align-items:flex-start}
.pg-shot{flex:none;width:379px}
.pg-shot-t{font-size:13px;font-weight:700;color:var(--soft);margin-bottom:6px}
.pg-frame{border:2px solid var(--ink);border-radius:14px;overflow:hidden;width:379px;background:#fff}
.pg-notes{margin:12px 0 0;padding:0;list-style:none;font-size:13.5px;line-height:1.55}
.pg-notes li{position:relative;padding-left:14px;margin-top:5px}
.pg-notes li::before{content:"";position:absolute;left:2px;top:.6em;width:5px;height:5px;border-radius:50%;background:var(--ink)}
.pg-chk{margin-top:10px;font-size:12.5px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:7px 10px;color:var(--ink)}
.pg-pick{margin-top:64px;border-top:2px solid var(--ink);padding-top:20px}
.pg-pick h2{font-size:28px;font-weight:800}
.pg-pick ol{margin:14px 0 0;padding-left:22px;max-width:86ch;display:grid;gap:10px;font-size:15px}
.pg-foot{margin-top:40px;font-size:12.5px;color:var(--soft);max-width:96ch}
body.only{background:#fff}
"""


def main():
    frags = []
    for i in range(1, 2):
        key = f"h{i:02d}"
        p = ROOT / "dirs" / f"{key}.html"
        if not p.exists():
            print("없음:", key); continue
        t = p.read_text(encoding="utf-8")
        meta = json.loads(re.search(r'<script type="application/json" id="meta-%s">(.*?)</script>' % key, t, re.S).group(1))
        body = re.sub(r'<script type="application/json" id="meta-%s">.*?</script>' % key, "", t, flags=re.S)
        style = "\n".join(re.findall(r"<style>(.*?)</style>", body, re.S))
        body = re.sub(r"<style>.*?</style>", "", body, flags=re.S).strip()
        phones = re.findall(r'(<div class="ph [^"]*" data-screen="([^"]+)".*?)(?=<div class="ph [^"]*" data-screen=|\Z)', body, re.S)
        chk = {}
        cj = ROOT / "captures" / f"{key}.json"
        if cj.exists():
            chk = {k: v.get("summary", "") for k, v in json.loads(cj.read_text(encoding="utf-8")).items()}
        frags.append((key, meta, style, phones, chk))

    # 이미지: 한 번만 넣는다
    keys = sorted(set(re.findall(r'src="img/([^"]+)"', "".join(b for _, _, _, ph, _ in frags for b, _ in ph))))
    imgmap = {k: img_data(ROOT / "img" / k) for k in keys}
    # CSS url('img/…') 도 같은 지도로
    def css_img(m):
        k = m.group(2)
        if k not in imgmap: imgmap[k] = img_data(ROOT / "img" / k)
        return f'url("{imgmap[k]}")'

    sec_html, css_all = [], [PAGE_CSS]
    for key, meta, style, phones, chk in frags:
        css_all.append(re.sub(r"""url\((['"]?)img/([^'")]+)\1\)""", css_img, style))
        sw = "".join(f'<span><i style="background:{html.escape(c)}"></i>{html.escape(c)} {html.escape(n)}</span>' for c, n in meta.get("palette", []))
        fonts = " · ".join({"PT": "Pretendard", "BHS": "Black Han Sans", "GB": "Gowun Batang", "DH": "Do Hyeon", "SG": "Space Grotesk", "PX": "IBM Plex Mono"}.get(f, f) for f in meta.get("fonts", []))
        shots = []
        for block, scr in phones:
            kind = scr.split("-", 1)[1]
            label = {"A": "A · 지금 그대로", "B": "B · 까치 심볼 + 글자 · 선 원", "C": "C · 명조 글자 + 한 줄 소개 · 이름 첫 글자", "D": "D · 글자 로고 유지 · «내 정보» 알약"}.get(kind, kind)
            notes = "".join(f"<li>{html.escape(n)}</li>" for n in meta.get("notes", {}).get(kind, []))
            c = chk.get(scr, "")
            block = re.sub(r'src="img/([^"]+)"', lambda m: f'src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-img="{m.group(1)}"', block.strip())
            shots.append(f'<div class="pg-shot"><p class="pg-shot-t">{key}-{label}</p><div class="pg-frame">{block}</div>'
                         f'<ul class="pg-notes">{notes}</ul>' + (f'<p class="pg-chk">캡처 확인(375×812): {html.escape(c)}</p>' if c else "") + "</div>")
        sec_html.append(f'<section class="pg-sec" id="{key}"><div class="pg-sec-h"><span class="pg-no">{key[1:]}</span><h2>{html.escape(meta.get("name", key))}</h2>'
                        f'<span class="pg-bench">가져온 것: {html.escape(" · ".join(meta.get("bench", [])))}</span></div>'
                        f'<p class="pg-concept">{html.escape(meta.get("concept", ""))}</p>'
                        f'<div class="pg-sw">{sw}<span>글꼴: {html.escape(fonts)}</span></div>'
                        f'<div class="pg-row">{"".join(shots)}</div></section>')

    toc = "".join(f'<a href="#{k}">{k[1:]} {html.escape(m.get("name", k))}</a>' for k, m, *_ in frags)
    body = f"""<div class="pg"><div class="pg-in">
<p class="pg-meta">pica · 2026.11.27 · 확정 시안의 맨 위 한 줄 고치기 (코드 반영 전, 고르기용)</p>
<h1 class="pg-h1">왼쪽 로고 · 오른쪽 내 정보 버튼 시안 4안</h1>
<p class="pg-lead">지금 사이트 맨 위 한 줄은 글자 로고 «pica.»(Space Grotesk, 끝 점만 초록)와 검정으로 꽉 찬 원 안의 인물 아이콘입니다. 검정 원은 종이색 화면에서 가장 진한 덩어리라 눈이 먼저 가고, 글자 로고는 까치 우편 상징과 이어지지 않습니다. 머리 줄만 바꾼 4안을 375px 화면으로 그렸습니다. 칩 아래 회색 띠는 로그아웃 상태의 오른쪽 버튼을 보여 주는 설명용이며 실제 화면에는 없습니다.</p>
{''.join(sec_html)}
<section class="pg-pick" style="background:#EAF4EE;border:2px solid #2E6B4E;border-radius:14px;padding:18px 20px;margin-top:48px"><h2>골라 주실 것</h2><ol>
<li><b>왼쪽 로고:</b> A·D 글자 로고 그대로 / B 까치 심볼 + 글자 / C 명조 글자 + 한 줄 소개. B를 고르시면 사람이 벡터로 다시 그린 로고 파일이 필요합니다(브랜드 가이드 4절, 지금 파일은 AI 시안 PNG).</li>
<li><b>오른쪽 내 정보 버튼:</b> A 검정 원 / B 흰 원에 선 / C 이름 첫 글자 원(로그아웃 때 «로그인» 글자) / D «내 정보» 글자 알약. 왼쪽과 오른쪽은 따로 골라 섞어도 됩니다.</li>
</ol></section>
<p class="pg-foot">화면의 행사 정보: picka.news 공개 데이터(2026-11-26 조회). 로고 그림: docs/brand/final/logo_postbox.png 윗부분. 글꼴: Pretendard · Gowun Batang · Space Grotesk (모두 OFL).</p>
</div></div>"""

    text = body + "".join(css_all) + "".join(json.dumps(m, ensure_ascii=False) for _, m, *_ in frags)
    fonts = font_face_css("".join(sorted(set(text) | set(chr(c) for c in range(0x20, 0x7F)))))
    shell = (ROOT / "tools" / "shell.css").read_text(encoding="utf-8")
    shell = re.sub(r"@font-face\{[^}]*\}\s*", "", shell)
    script = ("<script>(function(){var M=" + json.dumps(imgmap) + ";"
              "document.querySelectorAll('img[data-img]').forEach(function(i){var s=M[i.getAttribute('data-img')];if(s)i.src=s;});"
              "var q=new URLSearchParams(location.search).get('only');if(!q)return;var el=document.querySelector('[data-screen=\"'+q+'\"]');if(!el)return;"
              "document.body.classList.add('only');document.querySelector('.pg').style.display='none';document.body.prepend(el);})();</script>")
    style = "<style>\n" + fonts + "\n" + shell + "\n" + "\n".join(css_all) + "\n</style>"
    title = "<title>피카 머리 줄 시안 (로고 · 내 정보 버튼)</title>"
    (ROOT / "header_options.html").write_text(
        f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">{title}{style}</head>'
        f'<body style="margin:0">{body}{script}</body></html>', encoding="utf-8")
    (ROOT / "artifact.html").write_text(
        f'{title}\n<meta name="claude:viewport-fit-sides" content="cover">\n{style}\n<style>body{{background:#F4F4F2}}</style>\n{body}{script}', encoding="utf-8")
    for n in ["header_options.html", "artifact.html"]:
        print(n, f"{(ROOT / n).stat().st_size / 1024 / 1024:.2f} MB")
    print("시안", len(frags), "· 이미지", len(imgmap))


if __name__ == "__main__":
    main()
