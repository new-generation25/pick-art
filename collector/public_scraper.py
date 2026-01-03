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

    async def scrape(self, dynamic_targets):
        """
        dynamic_targets: [{ 'name': '...', 'value': 'url', ... }]
        """
        if not dynamic_targets:
            print("⚠️ No targets provided to PublicScraper.")
            return

        async with aiohttp.ClientSession(headers={"User-Agent": "Mozilla/5.0"}) as session:
            for target in dynamic_targets:
                target_name = target.get('name', 'unknown')
                target_url = target.get('value') or target.get('url')
                if not target_url or not target_url.startswith("http"):
                    print(f"⏩ Skipping invalid URL: {target_url}")
                    continue

                print(f"🔍 [PublicScraper] Starting: {target_name} ({target_url})", flush=True)
                try:
                    async with session.get(target_url, timeout=15) as response:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # 1. 사이트별 특화 로직 (서부문화센터 등)
                        is_wgcc = "wgcc.ghct.or.kr" in target_url
                        if is_wgcc:
                            rows = soup.select("ul.img_list li")
                        else:
                            # 다양한 게시판 형태 지원 (tr, li 등)
                            rows = soup.select(".board_list tbody tr") or \
                                   soup.select("ul.list_type li") or \
                                   soup.select(".table-list tr") or \
                                   soup.select("div.list_item")
                        
                        total_found = len(rows)
                        print(f"  - Found {total_found} potential items in list", flush=True)
                        
                        new_count = 0
                        skip_count = 0
                        
                        for row in rows:
                            try:
                                if is_wgcc:
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
                                    
                                    base_url = "/".join(target_url.split("/")[:3])
                                    full_url = urljoin(base_url, href)
                                    title = link_elem.get_text(strip=True) or "제목 없음"
                                
                                # 중복 체크
                                if self.db.check_duplicate(full_url):
                                    skip_count += 1
                                    continue
                                
                                # 상세 페이지 수집
                                success = await self.scrape_detail(session, full_url, target_name, title)
                                if success:
                                    new_count += 1
                                    print(f"  ✅ [New] {title[:30]}")
                                    await asyncio.sleep(random.uniform(1, 2))
                                    
                            except Exception as row_err:
                                print(f"  ⚠️ Row parse error: {row_err}")
                                continue
                        
                        print(f"✨ [Done] Result: {new_count} new, {skip_count} skipped, {total_found - new_count - skip_count} failed")
                                
                except Exception as e:
                    print(f"❌ Error scraping {target_name}: {e}")

    async def scrape_detail(self, session, url, source, title):
        try:
            async with session.get(url, timeout=15) as response:
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # 본문 추출 (다양한 선택자)
                content_div = soup.select_one(".board_view_cont") or \
                              soup.select_one(".view_content") or \
                              soup.select_one("#content_body") or \
                              soup.select_one(".article_body")
                description = content_div.get_text(strip=True) if content_div else ""
                
                # 이미지 추출
                img_elements = soup.select("img")
                img_urls = []
                for img in img_elements:
                    src = img.get('src')
                    if src and not any(x in src for x in ['icon', 'emoji', 'common', 'logo']):
                        img_urls.append(urljoin(url, src))
                
                # AI 추출
                ai = AIExtractor()
                ai_input = f"제목: {title}\n본문: {description[:1000]}"
                ai_suggestion = await ai.extract_metadata(ai_input)
                
                # 이미지 업로드 및 저장
                thumbnail_url = None
                permanent_img_urls = []
                from utils import process_and_upload_image
                
                if img_urls:
                    t_url, p_url, p_hash = await process_and_upload_image(
                        self.db.supabase, 
                        img_urls[0], 
                        f"{source}_{random.randint(1000,9999)}"
                    )
                    if p_url:
                        thumbnail_url = t_url
                        permanent_img_urls.append(p_url)

                post_data = {
                    "source": source,
                    "source_id": url.split("/")[-1].split("?")[0], # URL 마지막 조각을 ID로 사용
                    "source_url": url,
                    "content": {
                        "title": title,
                        "description": description,
                        "ai_suggestion": ai_suggestion
                    },
                    "image_urls": permanent_img_urls,
                    "poster_thumbnail_url": thumbnail_url,
                    "status": "COLLECTED"
                }
                self.db.save_raw_post(post_data)
                return True
        except Exception as e:
            print(f"  ❌ Detail error: {e}")
            return False
