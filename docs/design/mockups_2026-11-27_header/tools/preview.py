"""시안 하나 미리보기 + 375×812 확인.

    python tools/preview.py d03

dirs/e01.html(조각)을 틀에 끼워 _preview/d03.html 을 만들고, 화면마다(d03-home, d03-detail)
Edge 헤드리스로 375×812 캡처(captures/d03-home.png, …_scrolled.png)와 측정값(captures/d03.json)을 남긴다.
측정: 첫 화면에 온전히 보이는 [data-card] 수 · [data-k=title|period|venue]가 첫 화면 안인지 ·
.bar(아래 고정 막대)가 넘겨도 남는지 · .fb(위 고정 필터)가 넘겨도 붙는지 · 가로 넘침.
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
key = sys.argv[1]
frag = (ROOT / "dirs" / f"{key}.html").read_text(encoding="utf-8")
screens = re.findall(r'data-screen="([^"]+)"', frag)
shell = (ROOT / "tools" / "shell.css").read_text(encoding="utf-8")
page = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>{key}</title>
<style>{shell}
body{{margin:0;background:#888;display:flex;gap:24px;padding:24px;align-items:flex-start}}
body.only{{padding:0;gap:0;background:#fff}}
body.only [data-screen]:not(.on){{display:none}}
</style></head><body>
{frag}
<script>(function(){{var q=new URLSearchParams(location.search).get('only');if(!q)return;document.body.classList.add('only');
document.querySelectorAll('[data-screen]').forEach(function(e){{if(e.dataset.screen===q)e.classList.add('on')}});}})();</script>
</body></html>"""
out = ROOT / "_preview" / f"{key}.html"
out.parent.mkdir(exist_ok=True)
# 미리보기 파일은 _preview/ 안에 있으므로 img/ 경로를 한 칸 위로
page = page.replace('src="img/', 'src="../img/').replace("url('img/", "url('../img/").replace('url("img/', 'url("../img/')
page = page.replace('url("../fonts_full/', 'url("../fonts_full/')
out.write_text(page, encoding="utf-8")
res = subprocess.run(["node", str(ROOT / "tools" / "capture2.js"), str(out), str(ROOT / "captures"), ",".join(screens), key],
                     capture_output=True, text=True, encoding="utf-8")
print(res.stdout[-4000:])
if res.returncode:
    print(res.stderr[-3000:])
    sys.exit(1)
