import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.local')

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("Error: Supabase credentials not found.")
else:
    supabase = create_client(url, key)
    # PENDING 상태인 데이터 삭제
    res = supabase.table("raw_posts").delete().eq("status", "PENDING").execute()
    print(f"Deleted PENDING posts count: {len(res.data) if res.data else 0}")
