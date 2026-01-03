import os
import sys
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

# Force unbuffered output for real-time logging and UTF-8 encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    sys.stderr.reconfigure(encoding='utf-8', line_buffering=True)
else:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)

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
        # 중복 실행 방지: 같은 대상이 이미 RUNNING 상태인지 확인
        running_check = db.supabase.table("crawl_logs")\
            .select("target_name")\
            .eq("status", "RUNNING")\
            .execute()

        running_targets = [log['target_name'] for log in running_check.data] if running_check.data else []

        # REQUESTED 상태 중 RUNNING이 아닌 대상만 처리
        res = db.supabase.table("crawl_logs")\
            .select("*")\
            .eq("status", "REQUESTED")\
            .order("started_at")\
            .limit(5)\
            .execute()

        if res.data:
            for req in res.data:
                # 이미 실행 중이면 건너뛰기
                if req['target_name'] in running_targets:
                    print(f"⏭️ [Manual Request] {req['target_name']} already running, skipping", flush=True)
                    # REQUESTED 상태를 CANCELLED로 변경
                    db.supabase.table("crawl_logs").update({
                        "status": "CANCELLED",
                        "result_summary": "이미 실행 중인 크롤링이 있어 취소됨",
                        "finished_at": datetime.now().isoformat()
                    }).eq("id", req['id']).execute()
                    continue

                print(f"\n{'='*60}", flush=True)
                print(f"🔔 [Manual Request] Detected: {req['target_name']}", flush=True)
                print(f"🔔 [Manual Request] Log ID: {req['id']}", flush=True)
                print(f"{'='*60}", flush=True)

                db.supabase.table("crawl_logs").update({"status": "RUNNING"}).eq("id", req['id']).execute()
                print(f"✅ [Manual Request] Status updated to RUNNING", flush=True)

                source_res = db.supabase.table("whitelist")\
                    .select("*")\
                    .or_(f"name.eq.{req['target_name']},value.eq.{req['target_name']}")\
                    .limit(1)\
                    .execute()

                if source_res.data:
                    source = source_res.data[0]
                    print(f"✅ [Manual Request] Source found in whitelist: {source.get('name')}", flush=True)
                    print(f"🚀 [Manual Request] Starting crawler...\n", flush=True)
                    running_targets.append(req['target_name'])  # 실행 중 목록에 추가
                    await run_crawlers({
                        'target_type': 'website',
                        'value': source['value'],
                        'name': source.get('name', req['target_name']),
                        'log_id': req['id']
                    })
                else:
                    print(f"❌ [Manual Request] Source not found in whitelist!", flush=True)
                    db.supabase.table("crawl_logs").update({
                        "status": "FAIL",
                        "error_msg": "Source not found",
                        "finished_at": datetime.now().isoformat()
                    }).eq("id", req['id']).execute()
    except Exception as e:
        print(f"❌ [Manual Request] Error: {e}", flush=True)
        import traceback
        print(f"🔍 [Manual Request] Traceback: {traceback.format_exc()}", flush=True)

async def main():
    print("=" * 80, flush=True)
    print("🎨 Gyeongnam Art Navigator - Collector Service", flush=True)
    print("=" * 80, flush=True)
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"🔄 Checking for manual requests every 10 seconds...", flush=True)
    print(f"📅 Scheduled crawls: 04:00 and 18:00 daily", flush=True)
    print("=" * 80 + "\n", flush=True)

    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_crawlers, 'cron', hour='4,18')
    scheduler.add_job(check_manual_requests, 'interval', seconds=10) # 10초로 단축
    scheduler.start()

    print("✅ Scheduler started. Waiting for requests...\n", flush=True)

    while True:
        await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(main())
