import asyncio
from database import Database
from public_scraper import PublicScraper
from dotenv import load_dotenv
import os

if os.path.exists('.env.local'):
    load_dotenv('.env.local')
else:
    load_dotenv()

async def debug_public():
    print("🚀 Starting Public Scraper Debug...")
    db = Database()
    scraper = PublicScraper(db)
    
    target = {
        'value': 'https://gasc.ghct.or.kr/board/exhibition01',
        'name': '김해문화의전당(전시)',
        'target_type': 'website',
        'log_id': 'DEBUG_PUBLIC'
    }
    
    await scraper.scrape([target])

if __name__ == "__main__":
    asyncio.run(debug_public())
