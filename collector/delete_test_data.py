from database import Database
import asyncio
from dotenv import load_dotenv
import os

if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def delete_test_data():
    db = Database()
    target_id = "78b8e37f-7a9c-4eda-a77c-022dd99fd3d9"
    try:
        db.supabase.table("raw_posts").delete().eq("id", target_id).execute()
        print(f"✅ Deleted test data: {target_id}")
    except Exception as e:
        print(f"❌ Error deleting data: {e}")

if __name__ == "__main__":
    asyncio.run(delete_test_data())
