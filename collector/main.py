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
    print(f"🚀 {'Manual request:' if specific_target else 'Routine'} crawler started at {datetime.now()}", flush=True)
    db = Database()
    start_time = datetime.utcnow().isoformat()
    
    try:
        configs = []
        if specific_target:
            configs = [specific_target]
        else:
            whitelist_items = db.get_whitelist()
            for item in whitelist_items:
                target_type = 'website'
                if 'instagram.com' in (item.get('value') or ''): target_type = 'instagram'
                configs.append({
                    'target_type': target_type,
                    'value': item['value'],
                    'name': item.get('name', 'Whitelist Source')
                })

        if not configs: return

        # 스크래퍼 실행 (로그는 스크래퍼 내부에서 각 log_id에 대해 상세히 기록함)
        if specific_target and specific_target.get('target_type') == 'website':
            public = PublicScraper(db)
            await public.scrape([specific_target])
        elif not specific_target:
            # 루틴 실행 시
            public = PublicScraper(db)
            await public.scrape([c for c in configs if c['target_type'] == 'website'])
            # ... 다른 스크래퍼들 (FB, Insta) ...
        
        # 전체 종료 알림 (루틴 시에만)
        if not specific_target:
            await notifier.send_message(f"✅ 정기 크롤링 완료")
        
    except Exception as e:
        print(f"Crawler error: {e}")
        if specific_target and specific_target.get('log_id'):
            db.supabase.table("crawl_logs").update({"status": "FAIL", "error_msg": str(e)}).eq("id", specific_target['log_id']).execute()

async def check_manual_requests():
    db = Database()
    try:
        # 10초 이내의 요청만 처리 (중복 방지)
        res = db.supabase.table("crawl_logs")\
            .select("*")\
            .eq("status", "REQUESTED")\
            .order("started_at")\
            .limit(1)\
            .execute()
        
        if res.data:
            req = res.data[0]
            print(f"🔔 Manual Request Found: {req['target_name']}")
            db.supabase.table("crawl_logs").update({"status": "RUNNING"}).eq("id", req['id']).execute()
            
            source_res = db.supabase.table("whitelist").select("*").or_(f"name.eq.\"{req['target_name']}\",value.eq.\"{req['target_name']}\"").limit(1).execute()
            
            if source_res.data:
                source = source_res.data[0]
                await run_crawlers({
                    'target_type': 'website',
                    'value': source['value'],
                    'name': source.get('name', req['target_name']),
                    'log_id': req['id']
                })
            else:
                db.supabase.table("crawl_logs").update({"status": "FAIL", "error_msg": "Source not found"}).eq("id", req['id']).execute()
    except Exception as e:
        print(f"Error checking manual requests: {e}")

async def main():
    print("Gyeongnam Art Navigator - Collector Service Started")
    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_crawlers, 'cron', hour='4,18')
    scheduler.add_job(check_manual_requests, 'interval', seconds=10) # 10초로 단축
    scheduler.start()
    while True: await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(main())
