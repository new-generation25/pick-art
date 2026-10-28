from database import Database
import asyncio
from dotenv import load_dotenv
import os

if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def list_recent_fb():
    db = Database()
    # 최근 10개 가져오기
    result = db.supabase.table("raw_posts")\
        .select("id, content")\
        .eq("source", "facebook")\
        .limit(10)\
        .execute()
        
    print(f"Found {len(result.data)} posts.")
    for post in result.data:
        content = post.get('content', {})
        title = content.get('title', 'N/A')
        cat = content.get('category', 'N/A')
        desc = content.get('description', '')[:30]
        print(f"ID: {post['id']} | Title: {title} | Cat: {cat} | Desc: {desc}...")

if __name__ == "__main__":
    asyncio.run(list_recent_fb())
