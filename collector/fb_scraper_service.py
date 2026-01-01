import asyncio
import random
from playwright.async_api import async_playwright
from database import Database
import re

class FacebookScraper:
    def __init__(self, db: Database):
        self.db = db

    async def scrape(self, targets):
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
                viewport={'width': 390, 'height': 844},
                locale="ko-KR",
                device_scale_factor=3
            )
            
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                })
            """)

            page = await context.new_page()

            for target in targets:
                # Convert to mobile URL
                url = target['value'].replace("www.facebook.com", "m.facebook.com")
                source_name = target['name']
                print(f"Scraping Mobile FB: {source_name} ({url})")
                
                try:
                    await page.goto(url, wait_until="networkidle")
                    await asyncio.sleep(random.uniform(3, 5))
                    
                    # 팝업 닫기 시도
                    try:
                        await page.click("div[aria-label='나중에 하기']", timeout=2000)
                    except: pass
                    
                    # 1. '더 보기' 버튼 전부 클릭하여 내용 펼치기
                    print("Unfolding 'See more'...")
                    try:
                        # 더 보기 버튼들을 찾아서 클릭 (Javascript로 처리이 더 빠르고 안정적)
                        await page.evaluate("""() => {
                            const buttons = document.querySelectorAll('span[data-sigil="more"], a[href*="click_more"]');
                            buttons.forEach(btn => btn.click());
                        }""")
                        await asyncio.sleep(2) # 펼쳐질 시간 대기
                    except Exception as e:
                        print(f"Error clicking see more: {e}")

                    # 스크롤 좀 더 해서 이미지 로딩 유도
                    for _ in range(3):
                        await page.mouse.wheel(0, 1000)
                        await asyncio.sleep(1)

                    posts = await page.evaluate("""() => {
                        // m.facebook.com story container selectors
                        // 다양한 선택자 시도
                        const articles = document.querySelectorAll('div.story_body_container, div[data-sigil="story-div"], article, div[role="article"]');
                        
                        return Array.from(articles).map(article => {
                            // 1. 본문 텍스트 정밀 추출 노력
                            // _5rgt: 일반적인 본문 컨테이너
                            // data-sigil="message-text": 다른 형태의 본문
                            let contentEl = article.querySelector('div._5rgt') || article.querySelector('span[data-sigil="expose"]');
                            
                            // 본문을 못 찾았으면 article 전체에서 잡동사니를 최대한 피해봄
                            if (!contentEl) contentEl = article;

                            let text = contentEl.innerText || "";
                            
                            // 2. 잡음 제거 (UI 텍스트 등)
                            text = text.replace(/(\.\.\.\s*)?더 보기/g, '')
                                       .replace(/번역 보기/g, '')
                                       .replace(/사진 설명 없음/g, '')
                                       .replace(/·/g, '') // 구분자 점 제거
                                       .trim();
                            
                            // 작성자 이름이나 시간이 섞여 들어갈 수 있으므로, 
                            // 줄바꿈 기준으로 너무 짧은 앞줄은 날려버리는 전략도 고려 가능하나 위험함.
                            // 일단 '더 보기' 제거가 가장 중요.

                            // 이미지 추출 (아이콘 제외, 가로·세로 300px 이상)
                            const imgs = Array.from(article.querySelectorAll('img'))
                                .filter(img => {
                                    const w = img.naturalWidth || img.width;
                                    const h = img.naturalHeight || img.height;
                                    return img.src && img.src.length > 20 && !img.src.includes('emoji') && !img.src.includes('data:image/svg') && w >= 300 && h >= 300;
                                })
                                .map(img => img.src);
                                
                            // 링크 추출
                            const linkTag = article.querySelector('a[href*="/story.php"], a[href*="/groups/"]');
                            let link = linkTag ? linkTag.href : window.location.href;
                            
                            console.log(`Extracted: ${text.substring(0, 30)}... [${imgs.length} imgs]`);

                            if (text.length < 5 && imgs.length === 0) return null;

                            return { text, images: imgs, link };
                        }).filter(post => post !== null); 
                    }""")

                    print(f"Found {len(posts)} potential posts")

                    from ai_extractor import AIExtractor
                    ai = AIExtractor()
                    from utils import process_and_upload_image

                    for post in posts[:5]:
                        if not post['text'] or len(post['text']) < 5:
                            continue
                        
                        post_link = post['link'] if post['link'] else f"{url}#{hash(post['text'][:20])}"
                        
                        if self.db.check_duplicate(post_link):
                            print(f"Duplicate found: {post_link}")
                            continue

                        print(f"Processing post: {post['text'][:30]}...")

                        # 1. Image Processing (Download first!)
                        permanent_img_urls = []
                        thumbnail_url = None

                        for i, img_url in enumerate(post['images'][:3]):
                            t_url, p_url, p_hash = await process_and_upload_image(
                                self.db.supabase, 
                                img_url, 
                                f"fb_{random.randint(1000,9999)}_{i}"
                            )
                            if p_url:
                                # Ensure localhost instead of 127.0.0.1 for browser compatibility
                                p_url = p_url.replace("127.0.0.1", "localhost")
                                if i == 0: thumbnail_url = t_url
                                permanent_img_urls.append(p_url)
                        
                        # 2. AI Analysis (Multimodal)
                        # Pass permanent URLs to AI
                        ai_suggestion = await ai.extract_metadata(post['text'], permanent_img_urls)
                        
                        # 3. Save
                        post_data = {
                            "source": "facebook",
                            "source_id": post_link,
                            "source_url": post_link,
                            "content": {
                                "title": ai_suggestion.get('title') if ai_suggestion else f"[{source_name}] 뉴스",
                                "description": post['text'],
                                "username": source_name,
                                "raw_img_urls": post['images'],
                                "ai_suggestion": ai_suggestion
                            },
                            "image_urls": permanent_img_urls,
                            "status": "PENDING"
                        }
                        self.db.save_raw_post(post_data)

                except Exception as e:
                    print(f"Error scraping {source_name}: {e}")

            await browser.close()
