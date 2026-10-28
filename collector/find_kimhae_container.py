"""
국립김해박물관 전시 항목 컨테이너 찾기
"""
import asyncio
import aiohttp
from bs4 import BeautifulSoup
import sys

# UTF-8 인코딩 강제
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

async def find_exhibition_container():
    url = "https://gimhae.museum.go.kr/kr/html/sub02/020201.html"

    print("=" * 80)
    print(f"[Find Container] Looking for exhibition list container")
    print("=" * 80)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    async with aiohttp.ClientSession(headers=headers) as session:
        try:
            async with session.get(url, timeout=20) as response:
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                # thumb-box를 찾아서 그 부모들을 추적
                thumb_boxes = soup.select("div.thumb-box")
                print(f"\n[Found] {len(thumb_boxes)} thumb-box elements")

                if thumb_boxes:
                    # 첫 번째 thumb-box의 부모 계층 구조 확인
                    current = thumb_boxes[0]
                    print(f"\n[Hierarchy] Tracing parent structure:")
                    print("-" * 80)

                    level = 0
                    while current and level < 8:
                        tag_info = f"Level {level}: <{current.name}>"
                        if current.get('class'):
                            tag_info += f" class='{' '.join(current.get('class'))}'"
                        if current.get('id'):
                            tag_info += f" id='{current.get('id')}'"

                        print(f"  {tag_info}")

                        # 이 레벨에서 형제 요소가 몇 개인지 확인
                        if current.name in ['ul', 'div'] and current.get('class'):
                            siblings = soup.select(f"{current.name}.{current.get('class')[0]}")
                            if len(siblings) == 1:
                                # 리스트 컨테이너일 가능성
                                children = current.find_all(recursive=False)
                                print(f"    -> Possible list container! Has {len(children)} direct children")

                                # 자식 요소들의 구조 확인
                                for i, child in enumerate(children[:3], 1):
                                    print(f"\n    Child {i}:")
                                    print(f"    Tag: <{child.name}>")
                                    if child.get('class'):
                                        print(f"    Class: {' '.join(child.get('class'))}")

                                    # 이 자식에서 제목과 링크 찾기
                                    title = child.select_one("h3, h4, .title, strong, p.title")
                                    link = child.select_one("a")
                                    img = child.select_one("img")

                                    if title:
                                        print(f"    Title: {title.get_text(strip=True)[:80]}")
                                    if link:
                                        print(f"    Link href: {link.get('href', 'N/A')}")
                                    if img:
                                        print(f"    Image src: {img.get('src', 'N/A')[:80]}")

                        current = current.parent
                        level += 1

                    # 추천 셀렉터 출력
                    print(f"\n\n[Recommendation] Suggested selectors:")
                    print("-" * 80)

                    # 여러 가능한 셀렉터 테스트
                    test_selectors = [
                        "div.thumb-box",
                        "div.spe-display-list > div",
                        "ul.exhibition-list > li",
                        "div.display-item",
                        "#contents div.thumb-box",
                        ".prog_list .thumb-box",
                    ]

                    for selector in test_selectors:
                        results = soup.select(selector)
                        if results and len(results) > 1:
                            print(f"  ✓ '{selector}' -> {len(results)} items")

        except Exception as e:
            print(f"\n[ERROR] {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(find_exhibition_container())
