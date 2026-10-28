"""
서부문화센터 직접 크롤링 테스트
에러를 직접 확인합니다.
"""
import sys
import asyncio
from dotenv import load_dotenv
from database import Database
from public_scraper import PublicScraper

# Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(".env.local")

async def test_wgcc():
    print("="*80)
    print("서부문화센터 직접 크롤링 테스트")
    print("="*80)

    db = Database()
    scraper = PublicScraper(db)

    target = {
        'name': '김해서부문화센터',
        'value': 'https://wgcc.ghct.or.kr/board/show01_01',
        'target_type': 'website',
        'log_id': None  # 테스트용이라 log_id 없음
    }

    print(f"\n타겟: {target['name']}")
    print(f"URL: {target['value']}\n")

    try:
        await scraper.scrape([target])
        print("\n✅ 크롤링 완료!")
    except Exception as e:
        print(f"\n❌ 에러 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_wgcc())
