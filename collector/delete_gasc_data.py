from database import Database
import asyncio
from dotenv import load_dotenv
import os

if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def delete_gasc():
    db = Database()
    try:
        # gasc 포함된 url 삭제 (status가 COLLECTED인 것만)
        # like 문법은 Supabase에서 .like('source_url', '%gasc%')
        db.supabase.table("raw_posts")\
            .delete()\
            .like("source_url", "%gasc.ghct.or.kr%")\
            .eq("status", "COLLECTED")\
            .execute()
        print("✅ GASC test data deleted.")
    except Exception as e:
        print(f"❌ Error deleting data: {e}")

if __name__ == "__main__":
    asyncio.run(delete_gasc())
