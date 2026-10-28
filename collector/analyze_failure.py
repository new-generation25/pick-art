from database import Database
import asyncio
from dotenv import load_dotenv
import os

# .env.local 파일 로드 시도
if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def check_failed_log():
    db = Database()
    
    # '김해문화의전당(전시)'의 최신 로그 조회
    result = db.supabase.table("crawl_logs")\
        .select("*")\
        .eq("target_name", "김해문화의전당(전시)")\
        .order("started_at", desc=True)\
        .limit(1)\
        .execute()
        
    if result.data:
        log = result.data[0]
        print("\n" + "="*50)
        print(f"🚨 최신 크롤링 로그 분석: {log['target_name']}")
        print("="*50)
        print(f"🆔 ID: {log['id']}")
        print(f"⏰ 시작: {log['started_at']}")
        print(f"🏁 상태: {log['status']}")
        print(f"📝 결과: {log['result_summary']}")
        print(f"⚠️ 에러: {log.get('error_msg')}")
        print("-" * 50)
        print(f"📋 상세 로그:\n{log.get('detailed_log')}")
        print("="*50)
    else:
        print("❌ '경남문화관광정보' 로그가 없습니다.")

if __name__ == "__main__":
    asyncio.run(check_failed_log())
