import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local")
load_dotenv(env_path)

class CrawlVerifier:
    def __init__(self):
        url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            print("❌ Error: Missing Supabase credentials in .env.local")
            sys.exit(1)
        self.supabase: Client = create_client(url, key)

    def verify_latest_logs(self, limit=5):
        print(f"🔍 Verifying latest {limit} crawl logs...\n")
        
        try:
            res = self.supabase.table("crawl_logs").select("*").order("started_at", desc=True).limit(limit).execute()
            logs = res.data

            if not logs:
                print("📝 No crawl logs found.")
                return

            for log in logs:
                status_icon = "✅" if log['status'] == "SUCCESS" else "❌" if log['status'] == "FAIL" else "⏳"
                print(f"{status_icon} [{log['status']}] Target: {log['target_name']}")
                print(f"   - Log ID: {log['id']}")
                print(f"   - Time: {log['started_at']}")
                
                if log['status'] == "FAIL":
                    print(f"   - ⚠️ Error: {log.get('error_msg', 'Unknown Error')}")
                
                if log['status'] == "SUCCESS":
                    # Check if data actually exists in events or ai_suggestion
                    # (This part depends on how logs are linked to results)
                    summary = log.get('result_summary', '')
                    print(f"   - Result: {summary if summary else 'No summary available'}")

                print("-" * 50)

        except Exception as e:
            print(f"❌ Verification failed: {e}")

    def check_data_quality(self):
        print("\n📊 Data Quality Check (Raw Posts & Recent Events)...")
        try:
            # 1. Raw Posts check (Inbox equivalent)
            raw_res = self.supabase.table("raw_posts").select("count", count="exact").execute()
            print(f"📥 Total Raw Posts: {raw_res.count} items")

            # 2. Null field check in recent events
            recent_events = self.supabase.table("events").select("*").order("created_at", desc=True).limit(10).execute()
            if recent_events.data:
                null_counts = {"image": 0, "date": 0, "location": 0}
                for ev in recent_events.data:
                    if not ev.get('image_url'): null_counts["image"] += 1
                    if not ev.get('date_start'): null_counts["date"] += 1
                    if not ev.get('location'): null_counts["location"] += 1
                
                print(f"⚠️ Quality Issues in last 10 events:")
                print(f"   - Missing Images: {null_counts['image']}")
                print(f"   - Missing Dates: {null_counts['date']}")
                print(f"   - Missing Locations: {null_counts['location']}")
            else:
                print("📝 No events found to check quality.")

        except Exception as e:
            print(f"❌ Quality check failed: {e}")

if __name__ == "__main__":
    verifier = CrawlVerifier()
    verifier.verify_latest_logs()
    verifier.check_data_quality()
