from database import Database
import asyncio
from dotenv import load_dotenv
import os

if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def list_failed_logs():
    db = Database()
    # 최근 10개 로그 중 status가 FAIL인 것 조회
    result = db.supabase.table("crawl_logs")\
        .select("*")\
        .order("started_at", desc=True)\
        .limit(10)\
        .execute()
        
    print(f"🔍 Recent Logs Analysis ({len(result.data)} items):")
    for log in result.data:
        if log['status'] != 'COMPLETED':  # FAIL, RUNNING 등
            print(f"\nTarget: {log['target_name']}")
            print(f"Status: {log['status']}")
            print(f"Error: {log.get('error_msg')}")
            # 상세 로그 앞부분과 뒷부분 출력
            detail = log.get('detailed_log', '') or ''
            lines = detail.split('\n')
            print("--- Log Head ---")
            print('\n'.join(lines[:5]))
            print("--- Log Tail ---")
            print('\n'.join(lines[-5:]))

if __name__ == "__main__":
    asyncio.run(list_failed_logs())
