
import os
from dotenv import load_dotenv
import time

# Load env from collector/.env.local (handling relative path)
env_path = os.path.join(os.getcwd(), 'collector', '.env.local')
load_dotenv(env_path)

from collector.database import Database

def trigger_test():
    print("🧪 TestSprite: Triggering Test Crawl...")
    try:
        db = Database()
        
        # 1. 대상 찾기 (KOPIS 또는 김해문화의전당)
        target_name = "KOPIS" # 기본 타겟
        w_res = db.supabase.table("whitelist").select("name").eq("name", "KOPIS").execute()
        
        if not w_res.data:
            print("⚠️ KOPIS not found, searching for any source...")
            w_res = db.supabase.table("whitelist").select("name").limit(1).execute()
            if w_res.data:
                target_name = w_res.data[0]['name']
            else:
                print("❌ No sources found in whitelist!")
                return

        print(f"🎯 Target: {target_name}")

        # 2. 요청 생성
        log_entry = {
            "target_name": target_name,
            "status": "REQUESTED",
            "started_at": None
        }
        res = db.supabase.table("crawl_logs").insert(log_entry).execute()
        
        if res.data:
            log_id = res.data[0]['id']
            print(f"✅ Created request. Log ID: {log_id}")
            print("⏳ Waiting for Collector to pick it up...")
            
            # 3. 폴링하여 상태 확인 (최대 30초)
            for i in range(10):
                time.sleep(3)
                check = db.supabase.table("crawl_logs").select("status").eq("id", log_id).single().execute()
                status = check.data['status']
                print(f"   [{i*3}s] Status: {status}")
                
                if status in ['RUNNING', 'SUCCESS', 'FAIL']:
                    if status == 'RUNNING':
                        print("🚀 Collector picked up the task! It is RUNNING.")
                        # RUNNING 상태만 확인하면 테스트 성공으로 간주 (오래 걸릴 수 있으므로)
                        return
                    else:
                        print(f"✨ Finished with status: {status}")
                        return
            print("⏰ Timeout waiting for collector start.")
        else:
            print("❌ Failed to insert log entry.")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    trigger_test()
