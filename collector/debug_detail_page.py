"""
국립김해박물관 상세 페이지 구조 확인
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

async def analyze_detail_page():
    url = "https://gimhae.museum.go.kr/kr/html/sub02/020201.html?mode=V&mng_no=177"

    print("=" * 80)
    print(f"[Detail Page Analysis]")
    print(f"URL: {url}")
    print("=" * 80)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    async with aiohttp.ClientSession(headers=headers) as session:
        try:
            async with session.get(url, timeout=20) as response:
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                print(f"\n[HTTP] Status: {response.status}")
                print(f"[HTML] Length: {len(html)} characters\n")

                # 다양한 content selector 시도
                content_selectors = [
                    ".board_view_cont",
                    ".view_content",
                    ".cont",
                    "#contents",
                    ".contents",
                    ".detail_content",
                    ".view_area",
                    "article",
                ]

                print("[Testing Content Selectors]")
                print("-" * 80)

                for selector in content_selectors:
                    elem = soup.select_one(selector)
                    if elem:
                        text = elem.get_text(strip=True)
                        print(f"\n✓ '{selector}' FOUND")
                        print(f"  Length: {len(text)} characters")
                        print(f"  Preview: {text[:200]}...")

                # 실제 상세 내용이 있는 영역 찾기
                print("\n\n[Looking for Main Content Area]")
                print("-" * 80)

                # id나 class에 'view', 'content', 'detail' 포함된 요소 찾기
                candidates = soup.find_all(['div', 'section', 'article'],
                                          class_=lambda x: x and any(word in str(x).lower()
                                          for word in ['view', 'content', 'detail', 'info']))

                print(f"Found {len(candidates)} candidate elements\n")

                for i, elem in enumerate(candidates[:5], 1):
                    tag = elem.name
                    classes = elem.get('class', [])
                    elem_id = elem.get('id', '')
                    text = elem.get_text(strip=True)

                    print(f"{i}. <{tag}> class='{classes}' id='{elem_id}'")
                    print(f"   Text length: {len(text)} characters")
                    print(f"   Preview: {text[:150]}...")
                    print()

                # 날짜 정보 찾기
                print("\n[Looking for Date Information]")
                print("-" * 80)

                date_patterns = ['기간', 'period', 'date', '전시기간', '일시']
                for pattern in date_patterns:
                    elems = soup.find_all(text=lambda t: t and pattern in t.lower())
                    if elems:
                        print(f"\n'{pattern}' found in {len(elems)} places:")
                        for elem in elems[:3]:
                            parent = elem.find_parent(['li', 'p', 'div', 'span'])
                            if parent:
                                print(f"  {parent.get_text(strip=True)[:100]}")

        except Exception as e:
            print(f"\n[ERROR] {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(analyze_detail_page())
