"""사이트 붙이기 1단계: URL 하나를 받아 반복되는 목록 후보와 적중 수를 표로 찍는다.

사용: python tools/probe.py <목록 URL> [<목록 URL> ...]
출력: 날짜처럼 보이는 글자와 링크를 가진 반복 컨테이너 후보, 첫 항목의 HTML 앞부분,
      그리고 페이지 안에 보이는 JSON 목록 API 힌트. 이걸 보고 collector/sources/<slug>.json 을 쓴다.
"""
import re
import sys
import urllib.request
from collections import Counter

from bs4 import BeautifulSoup

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
DATE = re.compile(r"20\d\d\s*[.\-/년]\s*\d{1,2}")


def probe(url):
    raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read()
    html = raw.decode("utf-8", "ignore")
    soup = BeautifulSoup(html, "html.parser")
    counts, first = Counter(), {}
    for el in soup.find_all(["li", "div", "tr", "article", "dl"]):
        cls = el.get("class")
        if not cls:
            continue
        text = el.get_text(" ", strip=True)
        has_link = el.find("a") is not None or el.get("onclick") or el.get("data-idx")
        if has_link and DATE.search(text) and len(text) < 600:
            key = f"{el.name}.{'.'.join(cls)}"
            counts[key] += 1
            first.setdefault(key, el)
    print(f"\n=== {url}  (title: {soup.title.get_text(strip=True) if soup.title else ''})")
    if not counts:
        print("  반복 후보 없음 — 목록이 자바스크립트로 그려질 수 있음. 아래 API 힌트를 보거나 브라우저 네트워크 탭을 확인")
    for key, n in counts.most_common(5):
        print(f"  {n:3d} × {key}")
    if counts:
        key = counts.most_common(1)[0][0]
        print("  --- 첫 항목 ---\n  " + re.sub(r"\s+", " ", str(first[key]))[:700])
    hints = sorted(set(re.findall(r"['\"](/[\w/.-]*(?:List|list|Ajax|ajax|json|api)[\w/.-]*)['\"]", html)))[:10]
    print(f"  API 힌트: {hints}")


if __name__ == "__main__":
    for u in sys.argv[1:]:
        try:
            probe(u)
        except Exception as e:
            print(f"\n=== {u}\n  오류: {e}")
