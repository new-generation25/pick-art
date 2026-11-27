"""페이스북 페이지 커버(1640x624). 사이트 화면 팔레트(BRAND_GUIDE 2절)·로고 그림(brand/final/logo_postbox.png).
모바일에서 양옆이 잘리므로(가운데 약 1110px만 보임) 글자와 그림은 x 265~1375 안에 둔다."""
import os, base64
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
logo = base64.b64encode(open(os.path.join(HERE, '..', 'final', 'logo_postbox.png'), 'rb').read()).decode()
html = f"""<!doctype html><html><head><meta charset='utf-8'><style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
@import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Space+Grotesk:wght@700&display=block');
*{{margin:0;padding:0;box-sizing:border-box}}
#c{{width:1640px;height:624px;background:#F4EFE6;position:relative;overflow:hidden;font-family:'Pretendard Variable',sans-serif;color:#1E1A15}}
#logo{{position:absolute;left:300px;top:52px;height:540px}}
#txt{{position:absolute;left:640px;top:0;bottom:0;width:740px;display:flex;flex-direction:column;justify-content:center;gap:26px}}
h1{{font-family:'Gowun Batang',serif;font-weight:700;font-size:96px;letter-spacing:-3px;line-height:1.1}}
p{{font-size:34px;color:#6B6257;letter-spacing:-0.6px;line-height:1.45}}
.url{{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:44px;letter-spacing:-1px;color:#1E1A15;margin-top:6px}}
.url b{{color:#2E6B4E}}
.bar{{width:72px;height:6px;background:#2E6B4E;border-radius:3px}}
</style></head><body><div id='c'>
<img id='logo' src='data:image/png;base64,{logo}'>
<div id='txt'><div class='bar'></div><h1>이번 주, 어디 가지?</h1>
<p>부산·김해·창원·진주·통영·양산의<br>공연·전시·축제를 매일 모아 전해요</p>
<div class='url'>picka<b>.</b>news</div></div></div></body></html>"""
with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_page(viewport={'width':1640,'height':624})
    pg.set_content(html, wait_until='networkidle'); pg.evaluate('document.fonts.ready')
    pg.wait_for_function("document.fonts.check(\"40px 'Gowun Batang'\") && document.fonts.check(\"40px 'Pretendard Variable'\")", timeout=20000)
    out = os.path.join(HERE, 'fb_cover_1640x624.png'); pg.query_selector('#c').screenshot(path=out); b.close()
from PIL import Image
im = Image.open(out).convert('RGB'); im.save(out.replace('.png', '.jpg'), quality=92)
print(out)
