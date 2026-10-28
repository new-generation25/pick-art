"""
국립김해박물관 전시 항목 HTML 구조 상세 분석
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

async def analyze_exhibition_structure():
    url = "https://gimhae.museum.go.kr/kr/html/sub02/020201.html"

    print("=" * 80)
    print(f"[Debug] Analyzing exhibition structure: {url}")
    print("=" * 80)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    async with aiohttp.ClientSession(headers=headers) as session:
        try:
            async with session.get(url, timeout=20) as response:
                print(f"\n[HTTP] Status: {response.status}")

                if response.status != 200:
                    print(f"[ERROR] Non-200 status")
                    return

                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                # 전시 관련 키워드를 포함하는 요소 찾기
                print("\n[Search] Looking for exhibition-related content...")
                print("-" * 80)

                # 전시 항목으로 추정되는 요소들 찾기
                potential_selectors = [
                    "div.special_list",
                    "div.exhibition_list",
                    "ul.exhibition",
                    "div.exhi_list",
                    ".display_list",
                    "#contents",
                    "div.prog_list",
                    "div.board_list",
                ]

                for selector in potential_selectors:
                    elements = soup.select(selector)
                    if elements:
                        print(f"\n[FOUND] '{selector}': {len(elements)} elements")
                        for i, elem in enumerate(elements[:2], 1):
                            print(f"\n  Element {i} preview:")
                            print(f"  {elem.prettify()[:500]}...")

                # 본문 콘텐츠 영역 찾기
                main_content = soup.select_one("#contents") or soup.select_one(".contents")
                if main_content:
                    print(f"\n[Main Content] Found main content area")
                    print("-" * 80)

                    # 이미지가 있는 div, li, article 찾기
                    items_with_images = main_content.select("div:has(img), li:has(img), article:has(img)")
                    print(f"\n[Items with images] Found {len(items_with_images)} items")

                    if items_with_images:
                        for i, item in enumerate(items_with_images[:3], 1):
                            print(f"\n  Item {i}:")
                            print(f"  Tag: {item.name}")
                            print(f"  Classes: {item.get('class', [])}")

                            # 제목 찾기
                            title_elem = item.select_one("h3, h4, .title, strong")
                            if title_elem:
                                print(f"  Title: {title_elem.get_text(strip=True)[:100]}")

                            # 링크 찾기
                            link = item.select_one("a")
                            if link:
                                print(f"  Link: {link.get('href', 'N/A')}")

                            # 이미지 찾기
                            img = item.select_one("img")
                            if img:
                                print(f"  Image: {img.get('src', 'N/A')[:100]}")

                            # 구조 미리보기
                            print(f"\n  Structure preview:")
                            print(f"  {item.prettify()[:400]}...")

                # 전체 HTML에서 이미지 URL이 포함된 section 찾기
                print("\n\n[Deep Search] Looking for sections with exhibition images...")
                print("-" * 80)

                # prog, spe, display 같은 전시 관련 경로가 있는지 확인
                images = soup.select("img[src*='spe'], img[src*='display'], img[src*='prog'], img[src*='exhi']")
                print(f"Found {len(images)} exhibition-related images")

                if images:
                    for i, img in enumerate(images[:5], 1):
                        parent = img.find_parent(['div', 'li', 'article'])
                        print(f"\n  Image {i}:")
                        print(f"  Src: {img.get('src', 'N/A')}")
                        if parent:
                            print(f"  Parent tag: {parent.name}")
                            print(f"  Parent classes: {parent.get('class', [])}")
                            # 부모의 부모도 확인
                            grandparent = parent.find_parent(['ul', 'div'])
                            if grandparent:
                                print(f"  Grandparent tag: {grandparent.name}")
                                print(f"  Grandparent classes: {grandparent.get('class', [])}")

        except Exception as e:
            print(f"\n[ERROR] {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(analyze_exhibition_structure())
