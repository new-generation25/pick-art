"""
국립김해박물관 크롤링 테스트 스크립트
"""
import asyncio
import sys
from database import Database
from public_scraper import PublicScraper

# UTF-8 인코딩 강제 설정
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    sys.stderr.reconfigure(encoding='utf-8', line_buffering=True)

async def test_kimhae_museum():
    print("=" * 80)
    print("🏛️ 국립김해박물관 크롤링 테스트 시작")
    print("=" * 80)

    # Database 연결
    db = Database()

    # 크롤링 로그 생성
    log_entry = {
        "target_name": "국립김해박물관",
        "target_url": "https://gimhae.museum.go.kr/kr/html/sub02/020201.html",
        "status": "RUNNING",
        "requested_at": "now()"
    }

    try:
        log_result = db.supabase.table("crawl_logs").insert(log_entry).execute()
        log_id = log_result.data[0]['id'] if log_result.data else None
        print(f"📋 크롤링 로그 생성 완료: ID={log_id}")
    except Exception as e:
        print(f"⚠️ 로그 생성 실패: {e}")
        log_id = None

    # 테스트할 URL 목록 (국립김해박물관) - 화이트리스트에 등록된 정확한 URL 사용
    test_targets = [
        {
            'name': '국립김해박물관',
            'value': 'https://gimhae.museum.go.kr/kr/html/sub02/020201.html',  # 전시 페이지 (화이트리스트 등록된 URL)
            'target_type': 'website',
            'log_id': log_id
        }
    ]

    print(f"\n🎯 테스트 대상:")
    for target in test_targets:
        print(f"   - {target['name']}: {target['value']}")

    # PublicScraper 인스턴스 생성 및 실행
    scraper = PublicScraper(db)

    print(f"\n🚀 크롤링 시작...\n")
    await scraper.scrape(test_targets)

    print("\n" + "=" * 80)
    print("✅ 크롤링 테스트 완료")
    print("=" * 80)

    # 결과 확인
    print("\n📊 결과 확인:")
    try:
        # raw_posts에서 방금 수집된 데이터 확인
        recent_posts = db.supabase.table("raw_posts") \
            .select("id, source, content, status, created_at") \
            .eq("source", "국립김해박물관") \
            .order("created_at", desc=True) \
            .limit(5) \
            .execute()

        if recent_posts.data:
            print(f"\n✅ 최근 수집된 데이터 {len(recent_posts.data)}건:")
            for post in recent_posts.data:
                title = post.get('content', {}).get('title', 'No title')
                status = post.get('status', 'Unknown')
                print(f"   - [{status}] {title[:50]}...")
        else:
            print("\n⚠️ 수집된 데이터가 없습니다.")
            print("   가능한 원인:")
            print("   1. 모두 중복 데이터 (이미 수집됨)")
            print("   2. 웹사이트 구조 변경")
            print("   3. 선택자(selector) 불일치")
    except Exception as e:
        print(f"\n❌ 결과 확인 중 오류: {e}")

    # 크롤링 로그 최종 확인
    if log_id:
        try:
            log_check = db.supabase.table("crawl_logs") \
                .select("*") \
                .eq("id", log_id) \
                .execute()

            if log_check.data:
                log_data = log_check.data[0]
                print(f"\n📋 크롤링 로그 상태:")
                print(f"   - Status: {log_data.get('status')}")
                print(f"   - Summary: {log_data.get('result_summary')}")
                if log_data.get('detailed_log'):
                    print(f"\n📝 상세 로그:")
                    print(log_data.get('detailed_log'))
        except Exception as e:
            print(f"\n⚠️ 로그 확인 중 오류: {e}")

if __name__ == "__main__":
    asyncio.run(test_kimhae_museum())
