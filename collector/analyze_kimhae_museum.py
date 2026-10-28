"""
국립김해박물관 웹사이트 구조 분석
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

async def analyze_website():
    # 화이트리스트에 등록된 정확한 URL 사용
    urls_to_try = [
        "https://gimhae.museum.go.kr/kr/html/sub02/020201.html",  # 화이트리스트 등록 URL (전시)
        "https://gimhae.museum.go.kr/kr/html/sub02/020202.html",  # 교육 (혹시 다른 페이지)
    ]

    for url in urls_to_try:
        print("=" * 80)
        print(f"[Analysis] Trying URL: {url}")
        print("=" * 80)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        async with aiohttp.ClientSession(headers=headers) as session:
            try:
                async with session.get(url, timeout=20) as response:
                    print(f"\n[HTTP] Status: {response.status}")

                    if response.status != 200:
                        print(f"[SKIP] Non-200 status, skipping this URL\n")
                        continue

                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')

                    print(f"\n[HTML] Length: {len(html)} characters")

                    # 다양한 선택자 테스트
                    selectors_to_test = [
                        ".board_list tbody tr",
                        "ul.list_type li",
                        ".table-list tr",
                        "ul.img_list li",
                        ".exhibit_list li",
                        ".exhibition_list li",
                        ".list li",
                        "article",
                        ".item",
                        ".post",
                        "tbody tr",
                        "table tr",
                        "tr",
                        "li",
                    ]

                    print("\n[Selectors] Testing various selectors:")
                    print("-" * 80)

                    found_any = False
                    for selector in selectors_to_test:
                        elements = soup.select(selector)
                        if elements and len(elements) > 0:
                            found_any = True
                            print(f"[OK] '{selector}': {len(elements)} found")
                            # 첫 번째 요소의 구조 확인
                            first = elements[0]
                            print(f"   First element tag: <{first.name}>")
                            if first.get('class'):
                                print(f"   Class: {first.get('class')}")
                            # 텍스트 미리보기
                            text = first.get_text(strip=True)[:100]
                            if text:
                                print(f"   Text: {text}...")
                            print()

                    # 링크 요소 확인
                    print("\n[Links] Analyzing <a> tags:")
                    print("-" * 80)
                    links = soup.select("a")
                    print(f"Total {len(links)} links found")

                    # href에 'detail' 또는 '전시' 관련 키워드가 있는 링크 찾기
                    relevant_links = []
                    for link in links:
                        href = link.get('href', '')
                        text = link.get_text(strip=True)
                        if any(keyword in href.lower() or keyword in text
                               for keyword in ['detail', 'view', '전시', 'exhibition', 'show', 'board']):
                            relevant_links.append({
                                'href': href,
                                'text': text[:50]
                            })

                    if relevant_links:
                        print(f"\nRelevant links found: {len(relevant_links)}")
                        for i, link in enumerate(relevant_links[:10], 1):  # 처음 10개만
                            print(f"   {i}. {link['text']}")
                            print(f"      -> {link['href']}")

                    # 성공한 경우 HTML 샘플 출력하고 종료
                    if found_any or len(relevant_links) > 0:
                        print("\n[HTML] Sample structure (first 2000 chars):")
                        print("-" * 80)
                        print(html[:2000])
                        print("\n[SUCCESS] Found working URL! Analysis complete.")
                        return  # 성공하면 다른 URL 시도하지 않음

                    print("[SKIP] No relevant content found, trying next URL...\n")

            except Exception as e:
                print(f"\n[ERROR] {e}")
                import traceback
                traceback.print_exc()
                print("\n")

if __name__ == "__main__":
    asyncio.run(analyze_website())
