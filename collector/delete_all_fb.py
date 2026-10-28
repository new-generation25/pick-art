from database import Database
import asyncio
from dotenv import load_dotenv
import os

if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def delete_all_fb():
    db = Database()
    try:
        # source가 facebook인 모든 COLLECTED 데이터 삭제
        db.supabase.table("raw_posts")\
            .delete()\
            .eq("source", "facebook")\
            .eq("status", "COLLECTED")\
            .execute()
        print("✅ All 'facebook' raw_posts (COLLECTED) have been deleted.")
    except Exception as e:
        print(f"❌ Error deleting data: {e}")

if __name__ == "__main__":
    asyncio.run(delete_all_fb())
