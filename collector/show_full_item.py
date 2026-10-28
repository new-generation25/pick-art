"""
국립김해박물관 전시 항목 전체 HTML 구조 확인
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

async def show_full_item():
    url = "https://gimhae.museum.go.kr/kr/html/sub02/020201.html"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    async with aiohttp.ClientSession(headers=headers) as session:
        try:
            async with session.get(url, timeout=20) as response:
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                # div.item 찾기
                items = soup.select("div.item")
                print(f"\n[Found] {len(items)} div.item elements")
                print("=" * 80)

                # 처음 3개 항목의 전체 HTML 출력
                for i, item in enumerate(items[:3], 1):
                    print(f"\n\nItem {i} - Full HTML:")
                    print("-" * 80)
                    print(item.prettify())
                    print("-" * 80)

                    # 구조 분석
                    print(f"\nItem {i} - Structure Analysis:")
                    link = item.select_one("a")
                    img = item.select_one("img")
                    title = item.select_one("p.title, .title, h3, h4, strong")
                    date_elem = item.select_one("p.date, .date, span.date")
                    desc = item.select_one("p.desc, .desc, .description")

                    if link:
                        print(f"  Link href: {link.get('href')}")
                    if img:
                        print(f"  Image src: {img.get('src')}")
                    if title:
                        print(f"  Title: {title.get_text(strip=True)}")
                    if date_elem:
                        print(f"  Date: {date_elem.get_text(strip=True)}")
                    if desc:
                        print(f"  Description: {desc.get_text(strip=True)[:100]}")

                    # 모든 p 태그 확인
                    all_p = item.select("p")
                    if all_p:
                        print(f"\n  All <p> tags in this item:")
                        for p in all_p:
                            p_class = p.get('class', [])
                            p_text = p.get_text(strip=True)[:80]
                            print(f"    <p class='{p_class}'>{p_text}</p>")

        except Exception as e:
            print(f"\n[ERROR] {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(show_full_item())
