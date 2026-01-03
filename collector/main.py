import os
import asyncio
from dotenv import load_dotenv
from database import Database
from insta_scraper import InstaScraper
from public_scraper import PublicScraper
from fb_scraper_service import FacebookScraper
from notifier import TelegramNotifier
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
import pytz

# Load environment variables
load_dotenv(".env.local")
notifier = TelegramNotifier()

async def run_crawlers(specific_target=None):
    """
    특정 타겟 또는 전체 타겟 크롤링 수행
    specific_target: { 'target_type': 'website', 'value': 'url', 'name': 'name' } 형태
    """
    print(f"🚀 {'Manual request:' if specific_target else 'Routine'} crawler started at {datetime.now()}", flush=True)
    db = Database()
    start_time = datetime.utcnow().isoformat()
    
    try:
        configs = []
        if specific_target:
            configs = [specific_target]
        else:
            # DB에서 정기 설정 가져오기 (whitelist 기반)
            whitelist_items = db.get_whitelist()
            for item in whitelist_items:
                target_type = 'website'
                if 'instagram.com' in (item.get('value') or ''):
                    target_type = 'instagram'
                
                configs.append({
                    'target_type': target_type,
                    'value': item['value'],
                    'name': item.get('name', 'Whitelist Source')
                })

        if not configs:
            print("⚠️ No active crawler configurations found.")
            return

        insta_targets = [c for c in configs if c.get('target_type') == 'instagram']
        all_web_targets = [c for c in configs if c.get('target_type') in ['website', 'webpage', 'source']]
        fb_targets = [c for c in all_web_targets if 'facebook.com' in (c.get('value') or '')]
        web_targets = [c for c in all_web_targets if 'facebook.com' not in (c.get('value') or '')]

        # 1. 인스타그램
        if insta_targets:
            insta = InstaScraper(db)
            await insta.scrape() 
        
        # 2. 공공기관/홈페이지 (서부문화센터 등)
        if web_targets:
            public = PublicScraper(db)
            await public.scrape(web_targets)

        # 3. 페이스북
        if fb_targets:
            fb = FacebookScraper(db)
            await fb.scrape(fb_targets)
        
        # 결과 로그 업데이트
        end_time = datetime.utcnow().isoformat()
        log_id = specific_target.get('log_id') if specific_target else None
        
        log_data = {
            "target_name": specific_target.get('name', 'all') if specific_target else "all",
            "started_at": start_time,
            "finished_at": end_time,
            "result_summary": f"크롤링 완료: {len(configs)}개 소스",
            "status": "SUCCESS"
        }

        if log_id:
            db.supabase.table("crawl_logs").update(log_data).eq("id", log_id).execute()
        else:
            db.save_crawl_log(log_data)
        
        # 알림 (루틴 실행 시에만)
        if not specific_target:
            await notifier.send_message(f"✅ <b>크롤링 작업 완료</b>\n신규 게시물 확인 바랍니다.")
        
    except Exception as e:
        print(f"Crawler error: {e}")
        end_time = datetime.utcnow().isoformat()
        error_log = {
            "status": "FAIL",
            "error_msg": str(e),
            "finished_at": end_time
        }
        if specific_target and specific_target.get('log_id'):
            db.supabase.table("crawl_logs").update(error_log).eq("id", specific_target['log_id']).execute()
        await notifier.send_error("Collector Main", str(e))

async def check_manual_requests():
    """
    crawl_logs 테이블에서 REQUESTED 상태인 항목을 찾아 즉시 실행합니다.
    """
    db = Database()
    try:
        res = db.supabase.table("crawl_logs")\
            .select("*")\
            .eq("status", "REQUESTED")\
            .order("started_at")\
            .limit(1)\
            .execute()
        
        requests = res.data
        if requests:
            req = requests[0]
            print(f"🔔 Manual Request Found: {req['target_name']}")
            
            # 1. 상태를 RUNNING으로 먼저 변경 (중복 실행 방지)
            db.supabase.table("crawl_logs").update({"status": "RUNNING"}).eq("id", req['id']).execute()
            
            # 2. 해당 소스 정보 찾기 (whitelist에서 value 찾기)
            # target_name이 URL이거나 이름일 수 있음. 여기서는 value(URL)를 기준으로 매칭 시도
            source_res = db.supabase.table("whitelist").select("*").or_(f"name.eq.{req['target_name']},value.eq.{req['target_name']}").limit(1).execute()
            
            if source_res.data:
                source = source_res.data[0]
                target_type = 'website'
                if 'instagram.com' in source['value']: target_type = 'instagram'
                elif 'facebook.com' in source['value']: target_type = 'facebook'

                target_config = {
                    'target_type': target_type,
                    'value': source['value'],
                    'name': source.get('name', 'Requested Source'),
                    'log_id': req['id']
                }
                
                # 3. 크롤링 실행
                await run_crawlers(specific_target=target_config)
            else:
                db.supabase.table("crawl_logs").update({
                    "status": "FAIL", 
                    "error_msg": "화이트리스트에서 해당 소스를 찾을 수 없습니다."
                }).eq("id", req['id']).execute()
                
    except Exception as e:
        print(f"Error checking manual requests: {e}")

async def main():
    print("Gyeongnam Art Navigator - Collector Service Started")
    
    # 1. 즉시 루틴 실행
    # await run_crawlers() # 필요 시 주석 해제

    # 2. 스케줄러 설정
    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_crawlers, 'cron', hour='4,18')
    scheduler.add_job(check_manual_requests, 'interval', seconds=30) # 30초마다 수동 요청 체크 (중요!)
    scheduler.start()
    
    # 메인 루프 유지
    try:
        while True:
            await asyncio.sleep(10)
    except (KeyboardInterrupt, SystemExit):
        pass

if __name__ == "__main__":
    asyncio.run(main())
