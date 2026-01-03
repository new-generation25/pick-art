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
        if not dynamic_targets:
            return

        async with aiohttp.ClientSession(headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}) as session:
            for target in dynamic_targets:
                target_name = target.get('name', 'unknown')
                target_url = target.get('value') or target.get('url')
                log_id = target.get('log_id')
                
                print(f"\n[Scraper] Task Started: {target_name} ({target_url})", flush=True)
                
                try:
                    async with session.get(target_url, timeout=20) as response:
                        if response.status != 200:
                            raise Exception(f"HTTP Error: {response.status}")
                            
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # 1. 리스트 행 찾기 (서부문화센터 및 일반 게시판)
                        is_wgcc = "wgcc.ghct.or.kr" in target_url
                        rows = []
                        
                        if is_wgcc:
                            # 서부문화센터는 보통 ul.img_list li 또는 table tbody tr 사용
                            rows = soup.select("ul.img_list li") or soup.select(".board_list tbody tr")
                        else:
                            rows = soup.select(".board_list tbody tr") or \
                                   soup.select("ul.list_type li") or \
                                   soup.select(".table-list tr")
                        
                        total_found = len(rows)
                        new_count = 0
                        skip_count = 0
                        error_count = 0

                        if total_found == 0:
                            print(f"  ⚠️ No items found on the page. Check selectors.")
                            # 로그 업데이트
                            summary = "데이터 없음: 리스트 요소를 찾지 못함 (선택자 점검 필요)"
                            if log_id:
                                self.db.supabase.table("crawl_logs").update({
                                    "result_summary": summary, "status": "FAIL"
                                }).eq("id", log_id).execute()
                            continue

                        print(f"  - Found {total_found} items. Starting detail crawl...", flush=True)
                        
                        for row in rows:
                            try:
                                full_url = None
                                title = "제목 없음"

                                if is_wgcc:
                                    # 1) data-idx 방식
                                    data_idx = row.attrs.get('data-idx')
                                    if data_idx:
                                        full_url = f"https://wgcc.ghct.or.kr/board/detail/show01_01/{data_idx}?boardId=show01_01"
                                    
                                    # 2) 일반 a tag 방식
                                    link_elem = row.select_one("a")
                                    if link_elem and not full_url:
                                        href = link_elem.get('href')
                                        if href and href != "#":
                                            full_url = urljoin("https://wgcc.ghct.or.kr", href)
                                    
                                    title_elem = row.select_one("p") or row.select_one(".title") or row.select_one("a")
                                    title = title_elem.get_text(strip=True) if title_elem else "제목 없음"
                                else:
                                    link_elem = row.select_one("a")
                                    if not link_elem: continue
                                    href = link_elem.get('href')
                                    if not href or href == "#": continue
                                    base_url = "/".join(target_url.split("/")[:3])
                                    full_url = urljoin(base_url, href)
                                    title = link_elem.get_text(strip=True)

                                if not full_url: continue

                                # 중복 체크
                                if self.db.check_duplicate(full_url):
                                    skip_count += 1
                                    continue
                                
                                # 상세 페이지 수집
                                success = await self.scrape_detail(session, full_url, target_name, title)
                                if success:
                                    new_count += 1
                                    print(f"    ✅ [Collected] {title[:30]}")
                                    await asyncio.sleep(random.uniform(1, 2))
                                else:
                                    error_count += 1
                                    
                            except Exception as e:
                                print(f"    ❌ Row error: {e}")
                                error_count += 1

                        # 최종 로그 업데이트
                        final_summary = f"수집 완료: 발견 {total_found}건 (신규 {new_count}, 중복 {skip_count}, 실패 {error_count})"
                        print(f"  ✨ {final_summary}")
                        
                        if log_id:
                            self.db.supabase.table("crawl_logs").update({
                                "result_summary": final_summary, 
                                "status": "SUCCESS" if new_count > 0 or skip_count > 0 else "FAIL",
                                "finished_at": asyncio.get_event_loop().time() # Placeholder, will use proper isoformat below
                            }).eq("id", log_id).execute()
                                
                except Exception as e:
                    print(f"❌ Site Error ({target_name}): {e}")
                    if log_id:
                        self.db.supabase.table("crawl_logs").update({
                            "result_summary": f"오류 발생: {str(e)}", 
                            "status": "FAIL"
                        }).eq("id", log_id).execute()

    async def scrape_detail(self, session, url, source, title):
        try:
            async with session.get(url, timeout=20) as response:
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # 본문 선택자 다각화
                content_div = soup.select_one(".board_view_cont") or \
                              soup.select_one(".view_content") or \
                              soup.select_one(".cont") or \
                              soup.select_one(".article_body")
                description = content_div.get_text(strip=True) if content_div else ""
                
                # 이미지 추출
                img_elements = soup.select("img")
                img_urls = []
                for img in img_elements:
                    src = img.get('src')
                    if src and not any(x in src.lower() for x in ['icon', 'emoji', 'common', 'logo', 'button']):
                        img_urls.append(urljoin(url, src))
                
                # AI 분석
                ai = AIExtractor()
                ai_suggestion = await ai.extract_metadata(f"제목: {title}\n본문: {description[:1000]}")
                
                # 이미지 업로드
                thumbnail_url = None
                permanent_img_urls = []
                from utils import process_and_upload_image
                
                if img_urls:
                    t_url, p_url, p_hash = await process_and_upload_image(
                        self.db.supabase, img_urls[0], f"{source}_{random.randint(100,999)}"
                    )
                    if p_url:
                        thumbnail_url = t_url
                        permanent_img_urls.append(p_url)

                # 데이터 저장
                post_data = {
                    "source": source,
                    "source_id": f"wgcc_{random.randint(100000, 999999)}" if "wgcc" in url else url.split("/")[-1].split("?")[0],
                    "source_url": url,
                    "content": {
                        "title": title,
                        "description": description,
                        "ai_suggestion": ai_suggestion
                    },
                    "image_urls": permanent_img_urls,
                    "poster_thumbnail_url": thumbnail_url,
                    "status": "COLLECTED" # 이 값이 인박스에 노출되는 기준입니다.
                }
                self.db.save_raw_post(post_data)
                return True
        except Exception as e:
            print(f"    Detail error: {e}")
            return False
