import os
from database import Database
from dotenv import load_dotenv

load_dotenv(".env.local")

db = Database()

def check_recent_logs():
    print("Fetching recent crawl_logs...")
    res = db.supabase.table("crawl_logs").select("*").order("started_at", desc=True).limit(5).execute()
    
    for log in res.data:
        print(f"[{log.get('status')}] {log.get('target_name')} (ID: {log.get('id')})")
        print(f"   Summary: {log.get('result_summary')}")
        print(f"   Updated: {log.get('started_at')} -> {log.get('finished_at')}")
        detail = log.get('detailed_log')
        if detail:
            print(f"   Last Log Line: {detail.splitlines()[-1] if detail.splitlines() else 'Empty'}")
        print("-" * 40)

if __name__ == "__main__":
    check_recent_logs()
