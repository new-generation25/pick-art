from database import Database
import asyncio
from dotenv import load_dotenv
import os

if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def check_whitelist():
    db = Database()
    name = "김해문화의전당(전시)"
    
    print(f"🔍 Checking whitelist for: '{name}'")
    
    res = db.supabase.table("whitelist").select("*").eq("name", name).execute()
    
    if res.data:
        print("✅ Found:", res.data[0])
    else:
        print("❌ Not found!")
        # 전체 리스트 출력해서 유사한 게 있는지 확인
        all_wl = db.supabase.table("whitelist").select("name").execute()
        print("📋 Current whitelist items:", [i['name'] for i in all_wl.data])

if __name__ == "__main__":
    asyncio.run(check_whitelist())
