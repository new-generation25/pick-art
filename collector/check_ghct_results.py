from database import Database
import asyncio
from dotenv import load_dotenv
import os

if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def check_ghct_results():
    db = Database()
    # '문화'가 포함된 최신 수집 데이터 확인 (전당, 서부센터 모두 포함)
    result = db.supabase.table("raw_posts")\
        .select("*")\
        .like("source", "%문화%")\
        .order("id", desc=True)\
        .limit(10)\
        .execute()
        
    print(f"🔍 Found {len(result.data)} recent posts containing '문화'")
    for post in result.data:
        content = post.get('content', {})
        title = content.get('title', 'N/A')
        print(f"ID: {post['id']} | Source: {post['source']} | Title: {title}")

if __name__ == "__main__":
    asyncio.run(check_ghct_results())
