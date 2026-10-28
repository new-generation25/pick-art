import asyncio
import aiohttp
from bs4 import BeautifulSoup

async def inspect_gasc():
    url = "https://gasc.ghct.or.kr/board/exhibition01"
    headers = {"User-Agent": "Mozilla/5.0"}
    async with aiohttp.ClientSession(headers=headers) as session:
        async with session.get(url) as response:
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')
            
            print(f"URL: {url}")
            print("Potentially interesting selectors found:")
            
            # 게시판 목록일 가능성이 높은 요소들
            candidates = soup.select("ul.img_list li")
            print(f"- ul.img_list li count: {len(candidates)}")
            
            if candidates:
                first = candidates[0]
                print("First item HTML snippet:")
                print(first.prettify()[:500])
                
                link = first.select_one("a")
                if link:
                    print("Link href:", link.get('href'))
            
            candidates = soup.select("div.board_list")
            print(f"- div.board_list count: {len(candidates)}")

            # 클래스 이름들 수집
            classes = set()
            for tag in soup.find_all(True):
                if tag.get('class'):
                    classes.update(tag.get('class'))
            
            print(f"Total classes found: {len(classes)}")
            print("Sample classes:", list(classes)[:20])

if __name__ == "__main__":
    asyncio.run(inspect_gasc())
