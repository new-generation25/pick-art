from database import Database
import asyncio
from dotenv import load_dotenv
import os

if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def debug_names():
    db = Database()
    
    print("📋 [Whitelist] Names:")
    wl = db.supabase.table("whitelist").select("name").execute()
    wl_names = [item['name'] for item in wl.data]
    for name in wl_names:
        print(f"  - '{name}' (len={len(name)})")

    print("\n📋 [Manual Requests] Recent Target Names:")
    mr = db.supabase.table("manual_requests").select("target_name").order("created_at", desc=True).limit(5).execute()
    for req in mr.data:
        t_name = req['target_name']
        print(f"  - '{t_name}' (len={len(t_name)})")
        
        if t_name in wl_names:
            print("    ✅ Match found in whitelist")
        else:
            print("    ❌ NO MATCH in whitelist")
            # 근접 매치 찾기
            for w in wl_names:
                if w.strip() == t_name.strip():
                    print(f"    💡 But strict match failed due to whitespace? '{w}' vs '{t_name}'")

if __name__ == "__main__":
    asyncio.run(debug_names())
