import aiohttp
from bs4 import BeautifulSoup
from database import Database
import asyncio

class PublicScraper:
    def __init__(self, db: Database):
        self.db = db
        self.targets = [
            {
                "name": "gyeongnam_foundation",
                "url": "https://www.gncaf.or.kr/art/sub01_01.html", # 예시 URL
                "list_selector": ".board_list tr", # 예시
                "base_url": "https://www.gncaf.or.kr"
            }
        ]

    async def scrape(self):
        async with aiohttp.ClientSession(headers={"User-Agent": "Mozilla/5.0"}) as session:
            for target in self.targets:
                print(f"Scraping public site: {target['name']}")
                try:
                    async with session.get(target['url']) as response:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Board List Parsing
                        # Example: gncaf.or.kr uses table or div list
                        rows = soup.select(".board_list tbody tr") or soup.select("ul.list_type li")
                        
                        for row in rows:
                            link_elem = row.select_one("a")
                            if not link_elem: continue
                                
                            href = link_elem.get('href')
                            if not href.startswith("http"):
                                full_url = f"{target['base_url']}{href}"
                            else:
                                full_url = href
                                
                            if self.db.check_duplicate(full_url): continue
                                    
                            title = link_elem.get_text(strip=True)
                            
                            # Scrape Detail
                            await self.scrape_detail(session, full_url, target["name"], title)
                            await asyncio.sleep(random.uniform(1, 3))
                                
                except Exception as e:
                    print(f"Error scraping {target['name']}: {e}")

    async def scrape_detail(self, session, url, source, title):
        try:
            async with session.get(url) as response:
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # Content & Images
                content_div = soup.select_one(".board_view_cont") or soup.select_one(".view_content")
                description = content_div.get_text(strip=True) if content_div else ""
                
                # AI Metadata Extraction
                from ai_extractor import AIExtractor
                ai = AIExtractor()
                ai_input = f"제목: {title}\n본문: {description}"
                ai_suggestion = await ai.extract_metadata(ai_input)
                
                img_elements = soup.select(".board_view_cont img") or soup.select(".view_content img")
                img_urls = [img['src'] for img in img_elements if 'src' in img.attrs]
                img_urls = [urljoin(url, src) for src in img_urls]

                # Process first image for poster
                thumbnail_url = None
                permanent_img_urls = []
                img_hashes = []
                from utils import process_and_upload_image
                from urllib.parse import urljoin
                
                if img_urls:
                    source_id = url.split("=")[-1] # Simplified ID extraction
                    t_url, p_url, p_hash = await process_and_upload_image(
                        self.db.supabase, 
                        img_urls[0], 
                        f"{source}_{source_id}"
                    )
                    if p_url:
                        thumbnail_url = t_url
                        permanent_img_urls.append(p_url)
                        img_hashes.append(p_hash)

                post_data = {
                    "source": source,
                    "source_id": url.split("=")[-1],
                    "source_url": url,
                    "content": {
                        "title": title,
                        "description": description,
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

from urllib.parse import urljoin
import random

