import asyncio
from database import Database
from fb_scraper_service import FacebookScraper
from dotenv import load_dotenv
import os

# .env.local 파일 로드 시도
if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def debug_facebook():
    print("🚀 Starting Facebook Debug Scraper...")
    db = Database()
    scraper = FacebookScraper(db)
    
    # 경남문화관광정보 URL
    target = {
        'value': 'https://www.facebook.com/groups/1392471560910155',
        'name': '경남문화관광정보_DEBUG',
        'log_id': 'DEBUG_RUN'
    }
    
    await scraper.scrape([target])

if __name__ == "__main__":
    asyncio.run(debug_facebook())
