from database import Database
import asyncio
import json
from dotenv import load_dotenv
import os

# .env.local 파일 로드 시도
if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def check_latest_fb_post():
    db = Database()
    
    # 특정 ID (Step 484 로그에서 확인된 최신 수집 데이터)
    target_id = "78b8e37f-7a9c-4eda-a77c-022dd99fd3d9"
    
    result = db.supabase.table("raw_posts")\
        .select("*")\
        .eq("id", target_id)\
        .execute()
        
    if result.data:
        post = result.data[0]
        content = post.get('content', {})
        
        print("\n" + "="*50)
        print("🔍 최신 Facebook 수집 데이터 검증")
        print("="*50)
        print(f"🆔 ID: {post['id']}")
        print(f"🔗 URL: {post['source_url']}")
        print("-" * 50)
        print(f"📝 [Description (Saved)]:\n{content.get('description')}")
        print("-" * 50)
        print(f"🤖 [AI Suggestion]:\n{json.dumps(content.get('ai_suggestion'), indent=2, ensure_ascii=False)}")
        print("="*50)
    else:
        print("❌ 저장된 Facebook 데이터가 없습니다.")

if __name__ == "__main__":
    asyncio.run(check_latest_fb_post())
