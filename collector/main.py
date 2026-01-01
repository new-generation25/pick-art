import os
import asyncio
from dotenv import load_dotenv
from database import Database
from insta_scraper import InstaScraper
from public_scraper import PublicScraper
from fb_scraper_service import FacebookScraper
from notifier import TelegramNotifier
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime # added

# Load environment variables
load_dotenv(".env.local")

async def run_crawlers():
    print("🚀 Starting crawlers with dynamic configs...")
    db = Database()
    # 크롤링 시작 로그 기록 (이후 configs 로드 전)
    start_time = datetime.utcnow().isoformat()
    db.save_crawl_log({
        "target_name": "all",
        "started_at": start_time,
        "finished_at": None,
        "result_summary": f"시작 전 설정 {len([])}개",  # placeholder, will be updated after configs load
        "error_msg": None,
    })
    notifier = TelegramNotifier()
    
    try:
        # DB에서 설정 가져오기
        configs = db.get_crawler_configs()
        
        # whitelist 항목도 크롤링 대상으로 추가
        whitelist_items = db.get_whitelist()
        for item in whitelist_items:
            # type='website' 또는 instagram URL인 경우 추가
            target_type = 'website'
            if 'instagram.com' in item['value']:
                target_type = 'instagram'
            
            configs.append({
                'target_type': target_type,
                'value': item['value'],
                'name': item.get('name', 'Whitelist Source')
            })

        if not configs:
            print("⚠️ No active crawler configurations found.")
            return

        insta_targets = [c for c in configs if c['target_type'] == 'instagram']
        insta_targets = [c for c in configs if c['target_type'] == 'instagram']
        
        # 웹사이트 타겟 중 페이스북과 일반 분리
        all_web_targets = [c for c in configs if c['target_type'] == 'website']
        fb_targets = [c for c in all_web_targets if 'facebook.com' in c['value']]
        web_targets = [c for c in all_web_targets if 'facebook.com' not in c['value']]

        # 인스타그램 크롤러 실행
        if insta_targets:
            insta = InstaScraper(db)
            # 설정된 계정/해시태그 기반으로 크롤링 로직 수정 필요 (현재는 내부 hashtags 사용)
            # await insta.scrape_targets(insta_targets) 
            await insta.scrape() # 임시로 기존 방식 유지하되 데이터 저장 로직은 DB 연동됨
        
        # 공공기관 크롤러 실행
        if web_targets:
            public = PublicScraper(db)
            await public.scrape()

        # 페이스북 크롤러 실행
        if fb_targets:
            fb = FacebookScraper(db)
            await fb.scrape(fb_targets)
        
        # 크롤링 성공 로그 기록
        end_time = datetime.utcnow().isoformat()
        db.save_crawl_log({
            "target_name": "all",
            "started_at": start_time,
            "finished_at": end_time,
            "result_summary": f"크롤링 완료: {len(configs)}개 채널",
            "error_msg": None,
        })
        
        await notifier.send_message(f"✅ <b>크롤링 작업 완료</b>\n대상: {len(configs)}개 채널\n새로운 데이터가 인박스에 추가되었습니다.")
        
    except Exception as e:
        # 크롤링 실패 로그 기록
        end_time = datetime.utcnow().isoformat()
        db.save_crawl_log({
            "target_name": "all",
            "started_at": start_time,
            "finished_at": end_time,
            "result_summary": f"크롤링 실패: {len(configs)}개 채널 시도",
            "error_msg": str(e),
        })
        print(f"Crawler error: {e}")
        await notifier.send_error("Collector Main", str(e))
    
    print("✅ Crawling finished.")

async def check_keyword_notifications():
    """
    방금 발행된 이벤트들을 사용자 키워드와 매칭하여 알림을 생성합니다.
    """
    print("🔍 Scanning for keyword matches...")
    db = Database()
    
    try:
        # 1. 최근 15분 내 발행된 이벤트 가져오기
        from datetime import datetime, timedelta
        import pytz
        time_threshold = (datetime.now(pytz.utc) - timedelta(minutes=15)).isoformat()
        
        events_res = db.supabase.table("events")\
            .select("id, title, description")\
            .eq("status", "PUBLISHED")\
            .gte("published_at", time_threshold)\
            .execute()
        
        new_events = events_res.data
        if not new_events:
            print("No new events to match.")
            return

        # 2. 모든 사용자 키워드 가져오기
        keywords_res = db.supabase.table("keywords").select("*").execute()
        user_keywords = keywords_res.data
        
        notifications_count = 0
        for event in new_events:
            text_to_search = (event['title'] + " " + (event['description'] or "")).lower()
            
            for entry in user_keywords:
                keyword = entry['keyword'].lower()
                if keyword in text_to_search:
                    # 매칭 성공! 알림 로그 기록
                    db.supabase.table("notification_logs").insert([{
                        "email": entry['email'],
                        "event_id": event['id'],
                        "keyword": entry['keyword'],
                        "status": "SENT" # 실제 메일 발송 대행 서비스 연동 전 단계
                    }]).execute()
                    notifications_count += 1
        
        if notifications_count > 0:
            notifier = TelegramNotifier()
            await notifier.send_message(f"🔔 <b>키워드 알림 자동 발송</b>\n방금 발행된 행사에서 총 {notifications_count}건의 사용자 키워드 매칭이 발견되어 알림을 처리했습니다.")
            print(f"✅ Processed {notifications_count} keyword notifications.")

    except Exception as e:
        print(f"Error in keyword notification engine: {e}")

async def check_scheduled_events():
    """
    예약된 이벤트(SCHEDULED) 중 시간이 된 것들을 발행(PUBLISHED)으로 전환합니다.
    """
    print("⏰ Checking for scheduled events to publish...")
    db = Database()
    from datetime import datetime
    import pytz
    
    now = datetime.now(pytz.utc)
    
    # Supabase query for SCHEDULED events where scheduled_at <= now
    # Note: Use db.supabase directly if needed or add a method to Database class
    try:
        res = db.supabase.table("events")\
            .select("id, title")\
            .eq("status", "SCHEDULED")\
            .lte("scheduled_at", now.isoformat())\
            .execute()
        
        scheduled_events = res.data
        if scheduled_events:
            for event in scheduled_events:
                db.supabase.table("events")\
                    .update({"status": "PUBLISHED", "published_at": now.isoformat()})\
                    .eq("id", event['id'])\
                    .execute()
                print(f"🚀 Published scheduled event: {event['title']}")
            
            notifier = TelegramNotifier()
            await notifier.send_message(f"📢 <b>예약 발행 완료</b>\n총 {len(scheduled_events)}건의 행사가 자동으로 발행되었습니다.")
        else:
            print("No events to publish at this time.")
    except Exception as e:
        print(f"Error in scheduled publisher: {e}")

async def main():
    print("Gyeongnam Art Navigator - Collector Service Started")
    
    # 즉시 1회 실행
    await run_crawlers()
    await check_scheduled_events()

    # 스케줄러 설정
    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_crawlers, 'cron', hour='4,18')
    scheduler.add_job(check_scheduled_events, 'interval', minutes=10)   # 10분마다 예약 발행 체크
    scheduler.add_job(check_keyword_notifications, 'interval', minutes=10) # 10분마다 키워드 알림 체크
    scheduler.start()
    
    # 메인 루프 유지
    try:
        while True:
            await asyncio.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        pass

if __name__ == "__main__":
    asyncio.run(main())
