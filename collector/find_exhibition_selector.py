"""
국립김해박물관 전시 항목 정확한 셀렉터 찾기
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

async def find_correct_selector():
    url = "https://gimhae.museum.go.kr/kr/html/sub02/020201.html"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    async with aiohttp.ClientSession(headers=headers) as session:
        try:
            async with session.get(url, timeout=20) as response:
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                print("=" * 80)
                print("[Strategy] Working backwards from thumb-box")
                print("=" * 80)

                # thumb-box에서 시작해서 위로 올라가면서 리스트 컨테이너 찾기
                thumb_box = soup.select_one("div.thumb-box")
                if not thumb_box:
                    print("[ERROR] No thumb-box found!")
                    return

                # thumb-box의 부모를 찾아 올라가기
                current = thumb_box.parent  # <a class="itema">
                print(f"\n[Parent 1] {current.name} class='{current.get('class')}'")

                current = current.parent  # 실제 exhibition item
                print(f"[Parent 2] {current.name} class='{current.get('class')}' id='{current.get('id')}'")

                # 이 레벨의 형제들 찾기
                parent_selector = f"{current.name}"
                if current.get('class'):
                    parent_selector += f".{'.'.join(current.get('class'))}"
                if current.get('id'):
                    parent_selector = f"{current.name}#{current.get('id')}"

                # 부모의 부모 확인
                grandparent = current.parent
                print(f"[Parent 3] {grandparent.name} class='{grandparent.get('class')}' id='{grandparent.get('id')}'")

                # 이 grandparent 안에 있는 exhibition items 찾기
                gp_selector = f"{grandparent.name}"
                if grandparent.get('id'):
                    gp_selector = f"{grandparent.name}#{grandparent.get('id')}"
                elif grandparent.get('class'):
                    gp_selector += f".{'.'.join(grandparent.get('class'))}"

                # 실제 exhibition items 찾기
                test_selectors = [
                    f"{gp_selector} > div.item",
                    f"#{grandparent.get('id')} > div.item" if grandparent.get('id') else None,
                    f"{gp_selector} div.item",
                    "div#accodion > div.item",
                    "div.ui-accordion-group > div#accodion > div.item",
                ]

                print(f"\n[Testing] Potential selectors:")
                print("-" * 80)

                for selector in test_selectors:
                    if selector:
                        results = soup.select(selector)
                        print(f"  '{selector}' -> {len(results)} items")

                        if results and len(results) > 5:  # exhibition list should have several items
                            print(f"\n  [CANDIDATE] This looks like the exhibition list!")
                            print(f"  Showing first 2 items:")

                            for i, item in enumerate(results[:2], 1):
                                print(f"\n    Item {i}:")
                                link = item.select_one("a")
                                img = item.select_one("img")
                                title = item.select_one("p.title, .tit, strong")

                                if link:
                                    print(f"      Link: {link.get('href', 'N/A')[:80]}")
                                if img:
                                    print(f"      Image: {img.get('src', 'N/A')[:80]}")
                                if title:
                                    print(f"      Title: {title.get_text(strip=True)[:80]}")

                                # HTML 미리보기
                                print(f"\n      HTML preview:")
                                print(f"      {item.prettify()[:600]}...")

        except Exception as e:
            print(f"\n[ERROR] {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(find_correct_selector())
