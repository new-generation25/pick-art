import asyncio
import random
from playwright.async_api import async_playwright
from database import Database

class InstaScraper:
    def __init__(self, db: Database):
        self.db = db
        self.hashtags = ["#경남공연", "#창원전시", "#진주문화", "#김해예술", "#경남문화"]
        self.base_url = "https://www.instagram.com/explore/tags/"

    async def scrape(self):
        async with async_playwright() as p:
            # 브라우저 런칭 (헤드리스 모드 감지 회피 설정 포함)
            browser = await p.chromium.launch(headless=False) # 디버깅을 위해 일단 False, 실제 운영시 True 고려
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={'width': 1280, 'height': 800}
            )
            
            # webdriver 감지 회피
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                })
            """)

            page = await context.new_page()

            # 로그인 로직 (필요 시 구현, 현재는 비로그인 탐색 시도)
            # await self.login(page) 

            for tag in self.hashtags:
                tag_cleaned = tag.replace("#", "")
                url = f"{self.base_url}{tag_cleaned}/"
                print(f"Scraping hashtag: {tag}")
                
                try:
                    await page.goto(url, wait_until="networkidle")
                    await asyncio.sleep(random.uniform(3, 7)) # 랜덤 딜레이

                    # 게시물 링크 수집 (첫 페이지만 예시로 수집)
                    # 실제로는 스크롤 및 더 많은 로직 필요
                    hrefs = await page.evaluate("""() => {
                        const posts = document.querySelectorAll('a[href^="/p/"]');
                        return Array.from(posts).map(a => a.href);
                    }""")

                    unique_hrefs = list(set(hrefs))
                    print(f"Found {len(unique_hrefs)} posts for {tag}")

                    for post_url in unique_hrefs[:5]: # 테스트용 5개 제한
                        if self.db.check_duplicate(post_url):
                            print(f"Duplicate found: {post_url}")
                            continue
                        
                        await self.scrape_post_detail(page, post_url)
                        await asyncio.sleep(random.uniform(5, 10)) # 요청 간 딜레이

                except Exception as e:
                    print(f"Error scraping {tag}: {e}")

            await browser.close()

    async def scrape_post_detail(self, page, url):
        try:
            await page.goto(url, wait_until="networkidle")
            
            # 1. Metadata from Meta Tags (More stable)
            description = await page.evaluate("""() => {
                const meta = document.querySelector('meta[property="og:description"]');
                return meta ? meta.content : "";
            }""")
            
            # Clean description (Remove "Like, Comment..." parts if present)
            if " on Instagram:" in description:
                description = description.split("Instagram:")[1].strip()
            if description.startswith('"') and description.endswith('"'):
                description = description[1:-1]

            # AI Metadata Extraction
            from ai_extractor import AIExtractor
            ai = AIExtractor()
            ai_suggestion = await ai.extract_metadata(description)
            
            # 2. Image Extraction
            # Get all images that look like post images
            img_urls = await page.evaluate("""() => {
                const imgs = document.querySelectorAll('img[style*="object-fit: cover"]');
                return Array.from(imgs).map(img => img.src).filter(src => src.includes('https://'));
            }""")
            
            if not img_urls:
                # Fallback: OpenGraph image
                og_img = await page.evaluate("""() => {
                    const meta = document.querySelector('meta[property="og:image"]');
                    return meta ? [meta.content] : [];
                }""")
                img_urls = og_img

            # 3. Process and Save to Supabase
            source_id = url.split("/p/")[1].replace("/", "")
            
            # Permanent Storage (Supabase Storage)
            thumbnail_url = None
            permanent_img_urls = []
            img_hashes = []
            from utils import process_and_upload_image
            
            for i, img_url in enumerate(img_urls[:3]): # Max 3 images for MVP
                t_url, p_url, p_hash = await process_and_upload_image(
                    self.db.supabase, 
                    img_url, 
                    f"insta_{source_id}_{i}"
                )
                if p_url:
                    if i == 0: thumbnail_url = t_url
                    permanent_img_urls.append(p_url)
                    img_hashes.append(p_hash)

            if permanent_img_urls:
                post_data = {
                    "source": "instagram",
                    "source_id": source_id,
                    "source_url": url,
                    "content": {
                        "description": description,
                        "raw_img_urls": img_urls,
                        "ai_suggestion": ai_suggestion
                    },
                    "image_urls": permanent_img_urls,
                    "poster_thumbnail_url": thumbnail_url,
                    "images_hash": img_hashes,
                    "status": "COLLECTED"
                }
                self.db.save_raw_post(post_data)

        except Exception as e:
            print(f"Error scraping detail {url}: {e}")

    # async def login(self, page):
    #     ... 로그인 구현 ...
