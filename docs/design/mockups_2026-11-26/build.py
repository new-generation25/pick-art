"""피카 화면 시안(2026-11-26) 빌드.

mockups.html(원본, img/·fonts/ 상대 경로)에서 두 가지를 만든다.
  1) fonts/*.woff2      — 시안에 쓰인 글자만 남긴 글꼴 (Black Han Sans · Pretendard · IBM Plex Mono, 모두 OFL)
  2) mockups_standalone.html — 포스터(축소본)와 글꼴을 base64로 넣은 한 파일. 앱 미리보기·Artifact용

captures/results.json(캡처 확인 결과)이 있으면 각 화면 주석의 «캡처 확인» 줄을 그 값으로 채운다.

실행:  python build.py
필요:  fonttools·brotli·Pillow, 글꼴 원본
  - Pretendard: C:/Windows/Fonts/Pretendard-*.ttf (설치본)
  - Black Han Sans·IBM Plex Mono: --src 폴더(google/fonts 저장소 ofl/ 에서 받은 TTF). 기본값은 환경변수 PICA_FONT_SRC
"""
import base64, io, json, os, re, sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE / "mockups.html"
OUT = HERE / "mockups_standalone.html"
FONT_DIR = HERE / "fonts"
WIN_FONTS = Path("C:/Windows/Fonts")
EXTRA_SRC = Path(os.environ.get("PICA_FONT_SRC", HERE / "fonts_src"))
IMG_MAX_W = 480  # 포스터 축소본 폭(px). 화면에서 가장 크게 보이는 곳이 343px라 2배 밀도에 가깝게 둔다

FONTS = {
    "BlackHanSans.woff2": EXTRA_SRC / "BlackHanSans-Regular.ttf",
    "PlexMono-500.woff2": EXTRA_SRC / "IBMPlexMono-Medium.ttf",
    "PlexMono-600.woff2": EXTRA_SRC / "IBMPlexMono-SemiBold.ttf",
    "Pretendard-400.woff2": WIN_FONTS / "Pretendard-Regular.ttf",
    "Pretendard-500.woff2": WIN_FONTS / "Pretendard-Medium.ttf",
    "Pretendard-600.woff2": WIN_FONTS / "Pretendard-SemiBold.ttf",
    "Pretendard-700.woff2": WIN_FONTS / "Pretendard-Bold.ttf",
    "Pretendard-800.woff2": WIN_FONTS / "Pretendard-ExtraBold.ttf",
}


def used_text(html: str) -> str:
    # 태그 밖 글자 + CSS content 문자열 + 캡처 결과 문장까지 넉넉히. 기본 ASCII는 항상 넣는다
    chars = set(chr(c) for c in range(0x20, 0x7F))
    chars |= set(html)
    chars |= set("“”‘’·–—~…→↗↙×✓")
    res = HERE / "captures" / "results.json"
    if res.exists():
        chars |= set(res.read_text(encoding="utf-8"))
    return "".join(sorted(c for c in chars if c.isprintable()))


def build_fonts(text: str):
    FONT_DIR.mkdir(exist_ok=True)
    for name, src in FONTS.items():
        if not src.exists():
            sys.exit(f"글꼴 원본 없음: {src}")
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        font = TTFont(src)
        s = subset.Subsetter(opts)
        s.populate(text=text)
        s.subset(font)
        out = FONT_DIR / name
        font.flavor = "woff2"
        font.save(out)
        print(f"  {name}: {out.stat().st_size/1024:.0f} KB")


def data_uri_img(path: Path) -> str:
    if path.suffix.lower() == ".png" and path.name == "logo.png":
        return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()
    im = Image.open(path)
    im = im.convert("RGBA")
    if im.width > IMG_MAX_W:
        im = im.resize((IMG_MAX_W, round(im.height * IMG_MAX_W / im.width)), Image.LANCZOS)
    # 투명 영역이 있는 포스터는 크림이 아니라 흰 바탕에 얹는다(포스터 색을 바꾸지 않는다)
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    buf = io.BytesIO()
    bg.convert("RGB").save(buf, "WEBP", quality=82, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def fill_checks(html: str) -> str:
    res = HERE / "captures" / "results.json"
    if not res.exists():
        return html
    data = json.loads(res.read_text(encoding="utf-8"))
    def sub(m):
        key = m.group(1)
        r = data.get(key)
        if not r:
            return m.group(0)
        return f'<li class="chk" data-chk="{key}">캡처 확인(375×812): {r["summary"]}</li>'
    return re.sub(r'<li class="chk" data-chk="([A-Za-z-]+)">[^<]*</li>', sub, html)


def main():
    html = SRC.read_text(encoding="utf-8")
    html = fill_checks(html)
    SRC.write_text(html, encoding="utf-8")  # 원본 주석도 같은 결과로 맞춘다
    print("글꼴 줄이기")
    build_fonts(used_text(html))

    out = html
    # 글꼴 → base64
    def font_sub(m):
        p = HERE / m.group(1)
        return 'url("data:font/woff2;base64,' + base64.b64encode(p.read_bytes()).decode() + '")'
    out = re.sub(r'url\("(fonts/[^"]+\.woff2)"\)', font_sub, out)
    # 포스터 → base64 (같은 파일은 한 번만 변환)
    cache = {}
    def img_sub(m):
        rel = m.group(1)
        if rel not in cache:
            cache[rel] = data_uri_img(HERE / rel)
        return f'src="{cache[rel]}"'
    out = re.sub(r'src="(img/[^"]+)"', img_sub, out)
    assert 'src="img/' not in out and 'url("fonts/' not in out
    OUT.write_text(out, encoding="utf-8")
    print(f"standalone: {OUT.name} {OUT.stat().st_size/1024/1024:.2f} MB, 이미지 {len(cache)}개")


if __name__ == "__main__":
    main()
