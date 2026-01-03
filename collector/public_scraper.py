import aiohttp
from bs4 import BeautifulSoup
from database import Database
import asyncio
import random
from urllib.parse import urljoin
from ai_extractor import AIExtractor
from datetime import datetime

class PublicScraper:
    def __init__(self, db: Database):
        self.db = db

    async def scrape(self, dynamic_targets):
        if not dynamic_targets: return

        async with aiohttp.ClientSession(headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}) as session:
            for target in dynamic_targets:
                target_name = target.get('name', 'unknown')
                original_url = target.get('value') or target.get('url')
                log_id = target.get('log_id')
                
                # 서부문화센터 URL 보정 (보통 잘못된 주소가 들어오는 경우가 많음)
                if "wgcc.ghct.or.kr" in original_url and "board/show" not in original_url:
                    target_url = "https://wgcc.ghct.or.kr/board/show01_01" # 공연 일정 기본값
                else:
                    target_url = original_url

                print(f"\n{'='*60}", flush=True)
                print(f"[Scraper] 🎯 Target: {target_name}", flush=True)
                print(f"[Scraper] 🔗 URL: {target_url}", flush=True)
                print(f"[Scraper] 📋 Log ID: {log_id}", flush=True)
                print(f"{'='*60}", flush=True)
                
                try:
                    async with session.get(target_url, timeout=20) as response:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        is_wgcc = "wgcc.ghct.or.kr" in target_url
                        rows = []
                        
                        if is_wgcc:
                            # 서부문화센터 특화: ul.img_list li 구조
                            rows = soup.select("ul.img_list li")
                            print(f"[Scraper] 🏛️ WGCC mode activated", flush=True)
                            print(f"[Scraper] 📊 Found {len(rows)} items using selector 'ul.img_list li'", flush=True)
                        else:
                            rows = soup.select(".board_list tbody tr") or soup.select("ul.list_type li") or soup.select(".table-list tr")
                            print(f"[Scraper] 📊 Found {len(rows)} items using generic selectors", flush=True)

                        total_found = len(rows)
                        new_count = 0
                        skip_count = 0
                        error_count = 0

                        if total_found == 0:
                            summary = f"❌ 데이터 없음: 선택자 불일치 (Found 0 items)"
                            print(f"[Scraper] {summary}", flush=True)
                            self._update_log(log_id, summary, "FAIL")
                            continue

                        print(f"[Scraper] 🔄 Processing {total_found} items...", flush=True)

                        for idx, row in enumerate(rows, 1):
                            try:
                                full_url = None
                                if is_wgcc:
                                    data_idx = row.attrs.get('data-idx')
                                    # URL 구조 분석: /board/detail/{메뉴코드}/{idx}?boardId={boardId}
                                    # 김해서부문화센터 메뉴코드는 현재 show01_01(공연) 또는 show02_01(전시)
                                    menu_code = "show01_01" if "show01_01" in target_url else "show02_01"
                                    # boardId는 보통 BOARD_000000111 등이나 idx만 있어도 접속 가능하도록 패턴 생성
                                    if data_idx:
                                        full_url = f"https://wgcc.ghct.or.kr/board/detail/{menu_code}/{data_idx}"

                                    title_elem = row.select_one(".txt p")
                                    title = title_elem.get_text(strip=True) if title_elem else "제목 없음"
                                    print(f"  [{idx}/{total_found}] 🎭 Title: {title[:50]}...", flush=True)
                                    print(f"  [{idx}/{total_found}] 🔗 URL: {full_url}", flush=True)
                                else:
                                    link_elem = row.select_one("a")
                                    if not link_elem: continue
                                    full_url = urljoin(target_url, link_elem.get('href'))
                                    title = link_elem.get_text(strip=True)
                                    print(f"  [{idx}/{total_found}] 📄 Title: {title[:50]}...", flush=True)

                                if not full_url or "/detail/" not in full_url:
                                    print(f"  [{idx}/{total_found}] ⚠️ Invalid URL format, skipping", flush=True)
                                    continue

                                if self.db.check_duplicate(full_url):
                                    print(f"  [{idx}/{total_found}] ⏭️ Duplicate, skipping", flush=True)
                                    skip_count += 1
                                    continue

                                # 상세 페이지 수집
                                print(f"  [{idx}/{total_found}] 🔍 Fetching detail page...", flush=True)
                                if await self.scrape_detail(session, full_url, target_name, title):
                                    print(f"  [{idx}/{total_found}] ✅ Successfully saved to database", flush=True)
                                    new_count += 1
                                    await asyncio.sleep(random.uniform(0.5, 1.5))
                                else:
                                    print(f"  [{idx}/{total_found}] ❌ Failed to save", flush=True)
                                    error_count += 1

                            except Exception as e:
                                print(f"  [{idx}/{total_found}] ⚠️ Error: {str(e)}", flush=True)
                                error_count += 1

                        final_summary = f"✅ 수집 완료: 발견 {total_found}건 (신규 {new_count}, 중복 {skip_count}, 실패 {error_count})"
                        print(f"\n{'='*60}", flush=True)
                        print(f"[Scraper] {final_summary}", flush=True)
                        print(f"{'='*60}\n", flush=True)
                        self._update_log(log_id, final_summary, "SUCCESS" if new_count > 0 or skip_count > 0 else "FAIL")
                                
                except Exception as e:
                    self._update_log(log_id, f"사이트 오류: {str(e)}", "FAIL")

    def _update_log(self, log_id, summary, status):
        if not log_id: return
        try:
            self.db.supabase.table("crawl_logs").update({
                "result_summary": summary, 
                "status": status,
                "finished_at": datetime.utcnow().isoformat()
            }).eq("id", log_id).execute()
        except: pass

    async def scrape_detail(self, session, url, source, title):
        try:
            print(f"      📥 Fetching HTML from: {url}", flush=True)
            async with session.get(url, timeout=20) as response:
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                content_div = soup.select_one(".board_view_cont") or soup.select_one(".view_content") or soup.select_one(".cont")
                description = content_div.get_text(strip=True) if content_div else ""
                print(f"      📝 Content extracted: {len(description)} characters", flush=True)

                img_elements = soup.select("img")
                img_urls = [urljoin(url, img.get('src')) for img in img_elements if img.get('src') and 'download' in img.get('src')]
                print(f"      🖼️ Found {len(img_urls)} images", flush=True)

                # 제목 정리: [기획], [특별] 등의 분류 태그 제거
                import re
                clean_title = re.sub(r'^\[.*?\]\s*', '', title).strip()
                print(f"      ✂️ Title cleaned: '{title}' → '{clean_title}'", flush=True)

                print(f"      🤖 Running AI metadata extraction...", flush=True)
                ai = AIExtractor()
                ai_suggestion = await ai.extract_metadata(f"제목: {clean_title}\n본문: {description[:1000]}")

                # 서부문화센터는 지역과 카테고리 강제 설정
                is_wgcc = 'wgcc.ghct.or.kr' in url
                if is_wgcc:
                    ai_suggestion['region'] = '김해'
                    ai_suggestion['category'] = '공연'
                    print(f"      🏛️ WGCC auto-classification: region=김해, category=공연", flush=True)

                print(f"      🤖 AI suggestion: category={ai_suggestion.get('category')}, region={ai_suggestion.get('region')}", flush=True)

                from utils import process_and_upload_image
                thumbnail_url = None
                p_url = None
                if img_urls:
                    print(f"      📤 Uploading image to storage...", flush=True)
                    t, p, _ = await process_and_upload_image(self.db.supabase, img_urls[0], f"wgcc_{random.randint(100,999)}")
                    thumbnail_url, p_url = t, p
                    print(f"      ✅ Image uploaded: thumbnail={bool(thumbnail_url)}, poster={bool(p_url)}", flush=True)

                post_data = {
                    "source": source,
                    "source_id": url.split("/")[-1],
                    "source_url": url,
                    "content": {
                        "title": clean_title,  # 정리된 제목 사용
                        "description": description,
                        "ai_suggestion": ai_suggestion
                    },
                    "image_urls": [p_url] if p_url else [],
                    "status": "COLLECTED"
                }

                print(f"      💾 Saving to database (status: COLLECTED)...", flush=True)
                result = self.db.save_raw_post(post_data)

                if result:
                    print(f"      ✅ Database save successful - raw_posts table updated", flush=True)
                    # raw_posts 테이블에 저장된 ID 확인
                    if hasattr(result, 'data') and result.data:
                        saved_id = result.data[0].get('id') if result.data else None
                        print(f"      📊 Saved with ID: {saved_id}, Status: COLLECTED", flush=True)
                    return True
                else:
                    print(f"      ❌ Database save returned None - check blacklist/whitelist", flush=True)
                    return False

        except Exception as e:
            print(f"      ❌ Detail error ({url}): {str(e)}", flush=True)
            import traceback
            print(f"      🔍 Traceback: {traceback.format_exc()}", flush=True)
            return False
