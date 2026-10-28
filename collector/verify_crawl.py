"""
크롤링 검증 스크립트
서부문화센터 크롤링 결과를 확인하고 데이터베이스 상태를 점검합니다.
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Fix Windows console encoding for emoji support
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(".env.local")

def verify_crawl():
    print("=" * 80)
    print("크롤링 검증 스크립트 시작")
    print("=" * 80)

    # Supabase 연결
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not url or not key:
        print("❌ Supabase credentials not found!")
        return

    supabase = create_client(url, key)

    print("\n1️⃣ Whitelist 확인")
    print("-" * 80)
    whitelist = supabase.table("whitelist").select("*").execute()
    for item in whitelist.data:
        print(f"  ✓ Name: {item.get('name')}")
        print(f"    Value: {item.get('value')}")
        print(f"    Auto-publish: {item.get('auto_publish')}")
        print()

    print("\n2️⃣ 최근 크롤링 로그 확인 (최근 5개)")
    print("-" * 80)
    logs = supabase.table("crawl_logs").select("*").order("started_at", desc=True).limit(5).execute()
    for log in logs.data:
        print(f"  📋 Target: {log.get('target_name')}")
        print(f"     Status: {log.get('status')}")
        print(f"     Started: {log.get('started_at')}")
        print(f"     Result: {log.get('result_summary')}")
        if log.get('error_msg'):
            print(f"     Error: {log.get('error_msg')}")
        print()

    print("\n3️⃣ raw_posts 테이블 확인 (최근 10개)")
    print("-" * 80)
    raw_posts = supabase.table("raw_posts").select("*").order("collected_at", desc=True).limit(10).execute()

    if not raw_posts.data:
        print("  ⚠️ raw_posts 테이블에 데이터가 없습니다!")
    else:
        for post in raw_posts.data:
            print(f"  📄 ID: {post.get('id')}")
            print(f"     Title: {post.get('content', {}).get('title', 'N/A')}")
            print(f"     Source: {post.get('source')}")
            print(f"     Status: {post.get('status')}")
            print(f"     URL: {post.get('source_url')}")
            print(f"     Collected: {post.get('collected_at')}")
            print()

    print("\n4️⃣ 인박스 대상 (COLLECTED/PENDING 상태) 확인")
    print("-" * 80)
    inbox = supabase.table("raw_posts").select("*").or_("status.eq.COLLECTED,status.eq.PENDING").order("collected_at", desc=True).execute()

    if not inbox.data:
        print("  ⚠️ 인박스에 표시될 데이터가 없습니다!")
        print("  💡 Tip: status가 COLLECTED 또는 PENDING인 데이터만 인박스에 표시됩니다.")
    else:
        print(f"  ✅ 총 {len(inbox.data)}개의 항목이 인박스에 표시됩니다:")
        for post in inbox.data[:5]:  # 최근 5개만
            print(f"     - [{post.get('status')}] {post.get('content', {}).get('title', 'N/A')}")

    print("\n5️⃣ 통계 요약")
    print("-" * 80)
    collected = supabase.table("raw_posts").select("id", count="exact").eq("status", "COLLECTED").execute()
    pending = supabase.table("raw_posts").select("id", count="exact").eq("status", "PENDING").execute()
    published = supabase.table("raw_posts").select("id", count="exact").eq("status", "PUBLISHED").execute()
    rejected = supabase.table("raw_posts").select("id", count="exact").eq("status", "REJECTED").execute()

    print(f"  📊 COLLECTED: {collected.count}")
    print(f"  📊 PENDING: {pending.count}")
    print(f"  📊 PUBLISHED: {published.count}")
    print(f"  📊 REJECTED: {rejected.count}")
    print(f"  📊 인박스 표시 대상: {collected.count + pending.count}")

    print("\n" + "=" * 80)
    print("✅ 검증 완료")
    print("=" * 80)

if __name__ == "__main__":
    verify_crawl()
