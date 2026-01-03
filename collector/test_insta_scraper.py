
import asyncio
import os
from dotenv import load_dotenv

# 환경변수 로드 (DB 연결 전 필수)
load_dotenv(".env.local")
if not os.getenv("SUPABASE_URL"):
    os.environ["SUPABASE_URL"] = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    os.environ["SUPABASE_KEY"] = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

from database import Database
from insta_scraper import InstaScraper

async def test_run():
    print("Testing InstaScraper with Instaloader...")
    db = Database()
    
    # Init scraper
    scraper = InstaScraper(db)
    
    # Run
    await scraper.scrape()
    
if __name__ == "__main__":
    try:
        asyncio.run(test_run())
    except Exception as e:
        print(f"Test failed: {e}")
