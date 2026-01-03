
from database import Database
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv(".env.local")
if not os.getenv("SUPABASE_URL"):
    os.environ["SUPABASE_URL"] = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    os.environ["SUPABASE_KEY"] = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

def test_insert():
    print("Testing DB insert...")
    try:
        db = Database()
        
        # 더미 데이터 생성
        dummy_data = {
            "source": "test_script",
            "source_id": f"test_{int(datetime.now().timestamp())}",
            "source_url": "http://test.com",
            "content": {"description": "DB Insert Test"},
            "image_urls": ["http://test.com/image.jpg"],
            "status": "COLLECTED"
        }
        
        print(f"Data to insert: {dummy_data}")
        
        # insert 시도
        res = db.supabase.table("raw_posts").insert(dummy_data).execute()
        
        print("Insert Result:", res)
        print("✅ Data successfully inserted!")
        
    except Exception as e:
        print(f"❌ Failed to insert: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_insert()
