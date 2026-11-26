"""상세 페이지 포스터 찾기 시험 (2026-11-26 김해서부문화센터 구지가 사례). collector 폴더에서: python -m pytest tests/test_poster_finder.py -q"""
import hashlib
import io
import json
import os
import sys

from bs4 import BeautifulSoup
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from poster_finder import has_poster_rule, is_placeholder, poster_candidates  # noqa: E402
from utils import encode_poster  # noqa: E402


def defn(slug):
    with open(os.path.join(HERE, "sources", f"{slug}.json"), encoding="utf-8") as f:
        return json.load(f)["detail"]


WGCC = """<div class="page_detail"><div class="thumb"><img src="/file/download?fileKey=AAA" alt="포스터.jpg"></div>
<div class="info">...</div></div><div class="view_content"><p>소개 글</p></div>"""

GASC = """<div class="page_detail"><div class="thumb"><img src="/file/download?fileKey=THUMB" alt="포스터"></div></div>
<div class="view_content"><img src="/file/download?fileKey=BODY"></div>"""

TONGYEONG_NONE = """<div class="p1"><img src="/scms-static/img/noimg.png" alt="사진 없음"></div>"""
TONGYEONG_POSTER = """<div class="p1"><img src="/ImagePrint.do?key=schedule&name=a.png"></div>"""


def test_wgcc_poster_in_page_detail():
    url = "https://wgcc.ghct.or.kr/board/detail/show01_01/570"
    got = poster_candidates(BeautifulSoup(WGCC, "html.parser"), url, defn("ghct_wgcc"))
    assert got == ["https://wgcc.ghct.or.kr/file/download?fileKey=AAA"]  # 본문(.view_content)에는 그림이 없다


def test_gasc_thumb_first_then_body():
    url = "https://gasc.ghct.or.kr/board/detail/show02/1"
    got = poster_candidates(BeautifulSoup(GASC, "html.parser"), url, defn("ghct_gasc"))
    assert got == ["https://gasc.ghct.or.kr/file/download?fileKey=THUMB", "https://gasc.ghct.or.kr/file/download?fileKey=BODY"]


def test_tongyeong_noimg_is_not_a_candidate():
    url = "https://www.tongyeong.go.kr/citizen/01790/02535/02536.web?sno=1"
    d = defn("tongyeong_hall")
    assert poster_candidates(BeautifulSoup(TONGYEONG_NONE, "html.parser"), url, d) == []
    assert poster_candidates(BeautifulSoup(TONGYEONG_POSTER, "html.parser"), url, d) == [
        "https://www.tongyeong.go.kr/ImagePrint.do?key=schedule&name=a.png"]


def test_has_poster_rule():
    assert has_poster_rule({"poster": ".x img"}) and has_poster_rule({"body": ".y"})
    assert not has_poster_rule({}) and not has_poster_rule(None) and not has_poster_rule({"title": ".t"})


def test_placeholder_matches_stored_fingerprint():
    # placeholder_images 에는 저장본(WebP) 지문이 들어 있다. 원본 PNG 를 받아도 같은 그림으로 알아봐야 한다
    buf = io.BytesIO()
    Image.new("RGB", (40, 60), (200, 30, 30)).save(buf, format="PNG")
    raw = buf.getvalue()
    stored = hashlib.sha256(encode_poster(raw)).hexdigest()
    assert is_placeholder(raw, {stored})
    assert is_placeholder(raw, {hashlib.sha256(raw).hexdigest()})
    assert not is_placeholder(raw, {"0" * 64})
    assert not is_placeholder(b"not an image", {stored})
