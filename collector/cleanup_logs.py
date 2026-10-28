from dotenv import load_dotenv
import asyncio
from datetime import datetime
from database import Database

load_dotenv(".env.local")

async def cleanup_stuck_logs():
    db = Database()
    print("Checking for stuck RUNNING logs...")
    
    # 1. Get all RUNNING logs
    res = db.supabase.table("crawl_logs").select("*").eq("status", "RUNNING").execute()
    stuck_logs = res.data
    
    if not stuck_logs:
        print("No stuck logs found.")
        return

    print(f"Found {len(stuck_logs)} stuck logs.")
    
    for log in stuck_logs:
        log_id = log['id']
        target = log['target_name']
        started = log['started_at']
        
        print(f" - Cleaning up: {target} (ID: {log_id}) started at {started}")
        
        # Update to FAIL or TIMEOUT
        db.supabase.table("crawl_logs").update({
            "status": "FAIL",
            "result_summary": "Process terminated abnormally or timed out",
            "finished_at": datetime.utcnow().isoformat()
        }).eq("id", log_id).execute()
        
    print("Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(cleanup_stuck_logs())
