import aiohttp
from bs4 import BeautifulSoup
from database import Database
import asyncio
import random
from urllib.parse import urljoin
from ai_extractor import AIExtractor

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

    async def scrape(self, dynamic_targets=None):
        targets_to_run = dynamic_targets if dynamic_targets else self.targets
        
        async with aiohttp.ClientSession(headers={"User-Agent": "Mozilla/5.0"}) as session:
            for target in targets_to_run:
                target_name = target.get('name', 'unknown')
                target_url = target.get('url') or target.get('value')
                if not target_url or not target_url.startswith("http"): continue

                print(f"Scraping public site: {target_name} ({target_url})", flush=True)
                try:
                    async with session.get(target_url) as response:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Board List Parsing
                        is_wgcc = "wgcc.ghct.or.kr" in target_url
                        if is_wgcc:
                            rows = soup.select("ul.img_list li")
                        else:
                            rows = soup.select(".board_list tbody tr") or soup.select("ul.list_type li") or soup.select(".table-list tr")
                        
                        print(f"  - Found {len(rows)} items in list", flush=True)
                        
                        for row in rows:
                            if is_wgcc:
                                # data-idx와 data-board-id를 사용하여 URL 생성
                                data_idx = row.attrs.get('data-idx')
                                if not data_idx: continue
                                full_url = f"https://wgcc.ghct.or.kr/board/detail/show01_01/{data_idx}?boardId=show01_01"
                                title_elem = row.select_one("p")
                                title = title_elem.get_text(strip=True) if title_elem else "제목 없음"
                            else:
                                link_elem = row.select_one("a")
                                if not link_elem: continue
                                    
                                href = link_elem.get('href')
                                if not href or href == "#": continue
                                
                                base_url = target.get('base_url') or "/".join(target_url.split("/")[:3])
                                full_url = urljoin(base_url, href)
                                title = link_elem.get_text(strip=True)
                                
                            if self.db.check_duplicate(full_url): 
                                print(f"  - Skipping duplicate: {title[:20]}...", flush=True)
                                continue
                                    
                            print(f"  * New event found: {title}", flush=True)
                            # Scrape Detail
                            await self.scrape_detail(session, full_url, target_name, title)
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
                ai = AIExtractor()
                ai_input = f"제목: {title}\n본문: {description}"
                print(f"  - Extracting AI metadata for: {title[:20]}...")
                ai_suggestion = await ai.extract_metadata(ai_input)
                
                img_elements = soup.select(".board_view_cont img") or soup.select(".view_content img")
                img_urls = [img['src'] for img in img_elements if 'src' in img.attrs]
                img_urls = [urljoin(url, src) for src in img_urls]

                # Process first image for poster
                thumbnail_url = None
                permanent_img_urls = []
                img_hashes = []
                from utils import process_and_upload_image
                
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

