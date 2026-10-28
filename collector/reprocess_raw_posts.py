import os
import asyncio
from dotenv import load_dotenv
from database import Database
from ai_extractor import AIExtractor
from datetime import datetime

# Load env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local")
load_dotenv(env_path)

async def reprocess():
    db = Database()
    ai = AIExtractor()
    
    print("🚀 Starting Reprocessing: raw_posts -> events (CANDIDATE)")
    
    try:
        # 1. Fetch COLLECTED raw posts
        res = db.supabase.table("raw_posts").select("*").eq("status", "COLLECTED").execute()
        raw_posts = res.data
        
        if not raw_posts:
            print("📝 No unprocessed raw posts found.")
            return

        print(f"📦 Found {len(raw_posts)} raw posts to process.\n")

        for idx, post in enumerate(raw_posts, 1):
            try:
                content = post.get('content', {})
                title = content.get('title', 'Untitled')
                description = content.get('description', '')
                image_urls = post.get('image_urls', [])
                
                print(f"[{idx}/{len(raw_posts)}] Processing: {title[:30]}...")
                
                # 2. Extract Metadata via AI
                ai_suggestion = await ai.extract_metadata(
                    f"제목: {title}\n본문: {description}",
                    image_urls=image_urls[:3] if image_urls else None
                )
                
                if not ai_suggestion:
                    print(f"  ⚠️ AI failed for '{title}', skipping or using default")
                    continue

                # 3. Prepare Event Data
                event_data = {
                    "raw_post_id": post['id'],
                    "title": ai_suggestion.get('title') or title,
                    "description": ai_suggestion.get('description') or description,
                    "category": ai_suggestion.get('category') or '기타',
                    "region": ai_suggestion.get('region') or '기타',
                    "venue": ai_suggestion.get('venue'),
                    "event_date_start": ai_suggestion.get('date_start'),
                    "event_date_end": ai_suggestion.get('date_end'),
                    "price_info": ai_suggestion.get('price_details'),
                    "is_free": ai_suggestion.get('is_free', False),
                    "poster_image_url": image_urls[0] if image_urls else "",
                    "source": post['source'],
                    "original_url": post['source_url'],
                    "status": "CANDIDATE",
                    "created_at": datetime.now().isoformat()
                }

                # 4. Insert into events
                insert_res = db.supabase.table("events").insert(event_data).execute()
                
                if insert_res.data:
                    # 5. Update raw_post status
                    db.supabase.table("raw_posts").update({"status": "PROCESSED"}).eq("id", post['id']).execute()
                    print(f"  ✅ Converted to CANDIDATE event.")
                else:
                    print(f"  ❌ Failed to save event.")

            except Exception as e:
                print(f"  ❌ Error processing post {post['id']}: {e}")

        print("\n✨ Reprocessing Complete!")

    except Exception as e:
        print(f"❌ Critical Error: {e}")

if __name__ == "__main__":
    asyncio.run(reprocess())
