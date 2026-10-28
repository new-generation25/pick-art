import aiohttp
import sys
import os
import io

# Force UTF-8 encoding for stdout/stderr to prevent cp949 errors on Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.detach(), encoding='utf-8')

import asyncio

import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from database import Database
from public_scraper import LogCollector
import random

from dotenv import load_dotenv
load_dotenv(".env.local")
API_KEY = os.getenv("KOPIS_API_KEY")
BASE_URL_LIST = "http://www.kopis.or.kr/openApi/restful/pblprfr"
BASE_URL_DETAIL = "http://www.kopis.or.kr/openApi/restful/pblprfr"

class KopisScraper:
    def __init__(self, db: Database):
        self.db = db
        self.log_collector = LogCollector(db=db)
    
    async def fetch_detail(self, session, mt20id):
        url = f"{BASE_URL_DETAIL}/{mt20id}"
        params = {"service": API_KEY}
        async with session.get(url, params=params) as response:
            if response.status != 200: return None
            text = await response.text()
            root = ET.fromstring(text)
            db = root.find("db")
            if db is None: return None
            
            # Extract fields
            description = db.findtext("sty") or ""
            poster = db.findtext("poster")
            
            # Extract Intro Images (styurls)
            styurls = []
            styurls_tag = db.find("styurls")
            if styurls_tag is not None:
                for styurl in styurls_tag.findall("styurl"):
                    if styurl.text:
                        styurls.append(styurl.text)
            
            # Logic for Description using AI
            # KOPIS descriptions are often technical or incomplete. 
            # Aggressively use AI to structure information.
            ai_used = False
            
            if styurls or description:
                self.log_collector.add(f"      🤖 Invoking AI Vision/Text analysis for better metadata...", flush_to_db=True)
                try:
                    from ai_extractor import AIExtractor
                    ai = AIExtractor()
                    
                    # Combine poster and styurls for comprehensive analysis
                    analysis_images = []
                    if poster: analysis_images.append(poster)
                    if styurls: analysis_images.extend(styurls)
                    
                    # Call AI to extract metadata/summary from images or text
                    # (Fixed parameter name from 'text_content' to 'text')
                    ai_suggestion = await ai.extract_metadata(
                        text=f"공연 제목: {db.findtext('prfnm')}\n기존 설명: {description}\n장소: {db.findtext('fcltynm')}",
                        image_urls=analysis_images[:5] # Analyze up to 5 key images
                    )
                    
                    if ai_suggestion and ai_suggestion.get('description'):
                        new_desc = ai_suggestion.get('description')
                        # 만약 AI가 생성한 설명이 더 구조적이라면 교체
                        description = new_desc
                        ai_used = True
                        self.log_collector.add(f"      ✅ AI Structured Analysis: {len(description)} chars")
                        
                        # AI가 추천한 값을 필드에 덮어쓰기 위해 저장 (scrape 함수에서 활용)
                        self.last_ai_suggestion = ai_suggestion
                    else:
                        self.log_collector.add(f"      ⚠️ AI Result empty. Keeping original.")
                except Exception as e:
                    self.log_collector.add(f"      ⚠️ AI Extraction failed or skipped: {e}")
            else:
                self.log_collector.add(f"      ℹ️ AI skipped: No description or images available to analyze.")

            return {
                "mt20id": db.findtext("mt20id"),
                "prfnm": db.findtext("prfnm"),
                "prfpdfrom": db.findtext("prfpdfrom"),
                "prfpdto": db.findtext("prfpdto"),
                "fcltynm": db.findtext("fcltynm"),
                "prfcast": db.findtext("prfcast"),
                "prfcrew": db.findtext("prfcrew"),
                "prfruntime": db.findtext("prfruntime"),
                "prfage": db.findtext("prfage"),
                "entrpsnm": db.findtext("entrpsnm"),
                "pcseguidance": db.findtext("pcseguidance"),
                "relateurls": [
                    {"name": r.findtext("relatenm"), "url": r.findtext("relateurl")}
                    for r in db.findall("./relates/relate")
                    if r.findtext("relateurl")
                ],
                "poster": poster,
                "sty": description,
                "genre": db.findtext("genrenm"),
                "description": description,
                "styurls": styurls,
                "ai_used": ai_used,
                "ai_suggestion": getattr(self, 'last_ai_suggestion', None)
            }

    def map_genre(self, kopis_genre):
        return "공연"

    def extract_region(self, fcltynm, default="경남"):
        """
        Extract Gyeongnam city name from facility name.
        """
        cities = ["창원", "김해", "진주", "양산", "거제", "통영", "사천", "밀양", "거창", "함안", "창녕", "고성", "하동", "합천", "남해", "함양", "산청", "의령"]
        if not fcltynm: return default
        
        for city in cities:
            if city in fcltynm:
                return city
        return default

    async def scrape(self, log_id=None):
        """
        Fetch performance data from KOPIS for Gyeongnam area (48)
        """
        # 만약 외부에서 log_id를 주지 않았다면 직접 생성
        if not log_id:
            try:
                log_entry = {
                    "target_name": "KOPIS (API)",
                    "status": "RUNNING",
                    "started_at": datetime.utcnow().isoformat(),
                    "result_summary": "KOPIS 수집 시작 중..."
                }
                res = self.db.supabase.table("crawl_logs").insert(log_entry).execute()
                if res.data:
                    log_id = res.data[0]['id']
            except Exception as e:
                print(f"⚠️ Failed to create crawl log: {e}")

        self.log_collector.set_log_id(log_id)
        
        self.log_collector.add(f"\n{'='*60}")
        self.log_collector.add(f"[KOPIS] 🎭 Starting KOPIS data collection (Log ID: {log_id})", flush_to_db=True)
        self.log_collector.add(f"[KOPIS] 📅 Target Region: Gyeongnam (48) -> Filter: 김해 Only")
        self.log_collector.add(f"{'='*60}", flush_to_db=True)
        
        if not API_KEY:
            self.log_collector.add(f"[KOPIS] ❌ API_KEY is missing!")
            if log_id:
                self.db.supabase.table("crawl_logs").update({"status": "FAIL", "result_summary": "API_KEY 누락"}).eq("id", log_id).execute()
            return
        
        # Date range: Today to +60 days
        start_date = datetime.now().strftime("%Y%m%d")
        end_date = (datetime.now() + timedelta(days=60)).strftime("%Y%m%d")
        
        params = {
            "service": API_KEY,
            "stdate": start_date,
            "eddate": end_date,
            "cpage": 1,
            "rows": 100, 
            "signgucode": 48 
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                self.log_collector.add(f"[KOPIS] 📥 Fetching list from {start_date} to {end_date}...")
                async with session.get(BASE_URL_LIST, params=params) as response:
                    if response.status != 200:
                        self.log_collector.add(f"[KOPIS] ❌ List API Error: {response.status}")
                        return
                    
                    text = await response.text()
                    root = ET.fromstring(text)
                    items = root.findall("db")
                    
                    total_found = len(items)
                    self.log_collector.add(f"[KOPIS] 📊 Found {total_found} items in Gyeongnam. Filtering for '김해'...", flush_to_db=True)
                    
                    new_count = 0
                    skip_count = 0
                    region_skip_count = 0
                    error_count = 0
                    
                    for idx, item in enumerate(items, 1):
                        try:
                            mt20id = item.findtext("mt20id")
                            prfnm = item.findtext("prfnm")
                            fcltynm = item.findtext("fcltynm") or "장소 정보 없음"
                            
                            # Filter: Only process if region is '김해'
                            region = self.extract_region(fcltynm)
                            if region != '김해':
                                # 김해가 아닌 경우 로그에 남기되 간략하게 표시 (너무 많을 수 있으므로 5개마다 한 줄씩 표시하거나 생략 가능)
                                # 여기서는 명확성을 위해 모든 지역 스킵 사유를 남깁니다.
                                self.log_collector.add(f"  [{idx}/{total_found}] ⏩ Skipping: {prfnm[:20]}... (Region: {region})")
                                region_skip_count += 1
                                continue

                            source_id = mt20id
                            self.log_collector.add(f"  [{idx}/{total_found}] 🎯 TARGET FOUND: {prfnm} @ {fcltynm}")
                            
                            # Check duplicates
                            detail_url = f"https://www.kopis.or.kr/home/perf/perf_view.do?pfm_id={mt20id}"
                            
                            if self.db.check_duplicate(detail_url) or self.db.check_duplicate_by_id(source_id):
                                self.log_collector.add(f"  [{idx}/{total_found}] ⏭️ DUPLICATE - Skipping")
                                skip_count += 1
                                continue
                            
                            # Fetch Detail
                            self.log_collector.add(f"  [{idx}/{total_found}] 📥 Fetching details for {mt20id}...")
                            detail_data = await self.fetch_detail(session, mt20id)
                            
                            if not detail_data:
                                self.log_collector.add(f"  [{idx}/{total_found}] ❌ Failed to fetch details")
                                error_count += 1
                                continue

                            # 원본보기 링크 결정: 전문 티켓사 -> 공식홈페이지 -> 네이버예약 순으로 우선순위 부여
                            relate_list = detail_data.get('relateurls', [])
                            final_source_url = detail_url # 기본값
                            
                            # 우선순위 키워드 정의
                            priority_keywords = ['예스24', '인터파크', '티켓링크', '멜론티켓', '옥션티켓', '공연장', '홈페이지', '공식']
                            
                            best_link = None
                            # 1단계: 티켓 전문 사이트 및 공식 사이트 찾기
                            for kw in priority_keywords:
                                for link_obj in relate_list:
                                    if kw in (link_obj.get('name') or ''):
                                        best_link = link_obj.get('url')
                                        break
                                if best_link: break
                            
                            # 2단계: 1단계 실패 시 아무 링크나 하나 선택 (네이버 예약 등)
                            if not best_link and relate_list:
                                best_link = relate_list[0].get('url')
                                
                            final_source_url = best_link or detail_url

                            # AI 추천 데이터가 있으면 우선 활용
                            ai_sug = detail_data.get('ai_suggestion') or {}
                            
                            # Save to DB
                            post_data = {
                                "source": "KOPIS",
                                "source_id": source_id,
                                "source_url": final_source_url,
                                "content": {
                                    "title": prfnm,
                                    "description": detail_data.get('description', ''),
                                    "ai_suggestion": {
                                        "category": ai_sug.get('category') or self.map_genre(detail_data.get('genre', '')),
                                        "region": ai_sug.get('region') or region,
                                        "venue": ai_sug.get('venue') or fcltynm,
                                        "date_start": ai_sug.get('date_start') or detail_data.get('prfpdfrom', '').replace('.', '-'),
                                        "date_end": ai_sug.get('date_end') or detail_data.get('prfpdto', '').replace('.', '-'),
                                        "runtime": ai_sug.get('runtime') or detail_data.get('prfruntime', ''),
                                        "age": ai_sug.get('age') or detail_data.get('prfage', ''),
                                        "price": ai_sug.get('price') or detail_data.get('pcseguidance', ''),
                                        "cast": ai_sug.get('cast') or detail_data.get('prfcast', ''),
                                        "crew": ai_sug.get('crew') or detail_data.get('prfcrew', ''),
                                        "poster_url": ai_sug.get('poster_url') or detail_data.get('poster', '')
                                    }
                                },
                                "image_urls": [detail_data.get('poster')] if detail_data.get('poster') else [],
                                "status": "COLLECTED"
                            }
                            
                            result = self.db.save_raw_post(post_data)
                            if result:
                                self.log_collector.add(f"  [{idx}/{total_found}] ✅ Saved to DB (AI used: {detail_data.get('ai_used', False)})", flush_to_db=True)
                                new_count += 1
                            else:
                                self.log_collector.add(f"  [{idx}/{total_found}] ❌ DB Save Failed")
                                error_count += 1
                                
                            await asyncio.sleep(0.5) # Polite delay
                            
                        except Exception as e:
                            self.log_collector.add(f"  [{idx}/{total_found}] ⚠️ Error: {e}")
                            error_count += 1
                            
                    summary = f"✅ KOPIS Crawl Finished: 전체 {total_found}건 중 김해 {total_found - region_skip_count}건 발견 (신규 {new_count}, 중복 {skip_count}, 지역불일치 {region_skip_count})"
                    self.log_collector.add(f"\n{'='*60}")
                    self.log_collector.add(summary)
                    self.log_collector.add(f"{'='*60}\n")
                    
                    if log_id:
                        self.db.supabase.table("crawl_logs").update({
                            "result_summary": summary,
                            "status": "SUCCESS", 
                            "finished_at": datetime.utcnow().isoformat(),
                            "detailed_log": self.log_collector.get_all()
                        }).eq("id", log_id).execute()

            except Exception as e:
                self.log_collector.add(f"Critical Error: {e}")
                import traceback
                self.log_collector.add(traceback.format_exc())
                if log_id:
                    self.db.supabase.table("crawl_logs").update({
                        "status": "FAIL",
                        "error_msg": str(e),
                        "detailed_log": self.log_collector.get_all()
                    }).eq("id", log_id).execute()

if __name__ == "__main__":
    from dotenv import load_dotenv
    import os
    
    # Load env from parent/frontend (adjusted path)
    # Actually Database class handles loading .env.local if present in cwd or similar.
    # But usually we run from project root.
    
    # Assuming running from e:/developement/pick-art/
    load_dotenv(".env.local")
    
    async def main():
        print("Testing KopisScraper...")
        db = Database()
        
        # Create a log entry first so UI can see it running
        log_entry = {
            "target_name": "KOPIS (Manual)",
            "status": "RUNNING",
            "started_at": datetime.utcnow().isoformat(),
            "result_summary": "수동 실행 시작..."
        }
        
        try:
            res = db.supabase.table("crawl_logs").insert(log_entry).execute()
            log_id = res.data[0]['id']
            print(f"Created Log ID: {log_id}")
            
            scraper = KopisScraper(db)
            await scraper.scrape(log_id=log_id)
            
        except Exception as e:
            print(f"Failed to initialize logging: {e}")
            # Fallback without logging to DB if DB fails
            scraper = KopisScraper(db)
            await scraper.scrape()
        
    asyncio.run(main())
