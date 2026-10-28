"""
실시간 로그 모니터링 스크립트
크롤러의 진행 상황을 실시간으로 확인할 수 있습니다.
"""
import os
import time
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local")

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def watch_logs():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not url or not key:
        print("❌ Supabase credentials not found!")
        return

    supabase = create_client(url, key)
    last_log_id = None

    print("=" * 80)
    print("📺 실시간 크롤링 로그 모니터 시작")
    print("=" * 80)
    print("Ctrl+C를 눌러 종료하세요.\n")

    try:
        while True:
            # 최신 로그 가져오기
            logs = supabase.table("crawl_logs").select("*").order("started_at", desc=True).limit(5).execute()

            if logs.data and logs.data[0]['id'] != last_log_id:
                clear_screen()
                last_log_id = logs.data[0]['id']

                print("=" * 80)
                print(f"📺 크롤링 로그 모니터 - 업데이트: {datetime.now().strftime('%H:%M:%S')}")
                print("=" * 80)

                for log in logs.data:
                    status_icon = {
                        "REQUESTED": "🔵",
                        "RUNNING": "🔄",
                        "SUCCESS": "✅",
                        "FAIL": "❌"
                    }.get(log.get('status'), "⚪")

                    print(f"\n{status_icon} [{log.get('status')}] {log.get('target_name')}")
                    print(f"   Started: {log.get('started_at', 'N/A')}")
                    if log.get('finished_at'):
                        print(f"   Finished: {log.get('finished_at')}")
                    if log.get('result_summary'):
                        print(f"   Result: {log.get('result_summary')}")
                    if log.get('error_msg'):
                        print(f"   Error: {log.get('error_msg')}")
                    print("   " + "-" * 74)

                # 현재 진행 중인 작업 확인
                running = [l for l in logs.data if l.get('status') == 'RUNNING']
                if running:
                    print(f"\n🔄 현재 진행 중: {len(running)}개")
                else:
                    print(f"\n✅ 대기 중 (진행 중인 작업 없음)")

                print("\n" + "=" * 80)

            time.sleep(2)  # 2초마다 확인

    except KeyboardInterrupt:
        print("\n\n👋 로그 모니터를 종료합니다.")

if __name__ == "__main__":
    watch_logs()
