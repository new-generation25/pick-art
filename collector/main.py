import os
import re
import sys
import atexit
import asyncio
from dotenv import load_dotenv
from database import Database
from public_scraper import PublicScraper
from kopis_scraper import KopisScraper
from naver_blog_scraper import scrape_blog
from ai_extractor import AIExtractor
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timezone, timedelta

# Force unbuffered output for real-time logging and UTF-8 encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    sys.stderr.reconfigure(encoding='utf-8', line_buffering=True)
else:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)

# Load environment variables
load_dotenv(".env.local")

RUNNING_TIMEOUT = timedelta(minutes=30)
PID_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".running.pid")

def write_pid_file():
    """프론트 상태 API가 '아무 파이썬'이 아니라 이 수집기의 생존을 보도록 PID를 남긴다."""
    with open(PID_FILE, "w") as f:
        f.write(str(os.getpid()))
    atexit.register(remove_pid_file)

def remove_pid_file():
    try:
        with open(PID_FILE) as f:
            if f.read().strip() == str(os.getpid()):
                os.remove(PID_FILE)
    except FileNotFoundError:
        pass

def reclaim_running(db, older_than=None, reason="시간 초과"):
    """RUNNING으로 남은 crawl_logs를 FAIL로 마감한다. older_than이 없으면 전부."""
    q = db.supabase.table("crawl_logs").select("id, target_name").eq("status", "RUNNING")
    if older_than:
        q = q.lt("started_at", (datetime.now(timezone.utc) - older_than).isoformat())
    stale = q.execute().data or []
    for log in stale:
        db.supabase.table("crawl_logs").update({
            "status": "FAIL",
            "error_msg": reason,
            "finished_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", log['id']).execute()
        print(f"♻️ [Reclaim] {log['target_name']} (log {log['id']}) RUNNING → FAIL: {reason}", flush=True)
    return len(stale)

BLOG_REGIONS = "창원 진주 통영 사천 김해 밀양 거제 양산 의령 함안 창녕 고성 남해 하동 산청 함양 거창 합천".split()


INSTAGRAM_MARK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs", "instagram_last_run.txt")


def _kst_now():
    return datetime.now(timezone(timedelta(hours=9)))


def instagram_due(now=None, mark_path=INSTAGRAM_MARK):
    """오전 회차면 늘 돈다. 오후 회차는 그날(KST) 인스타 수집이 아직 성공하지 않았을 때만 돈다."""
    now = now or _kst_now()
    if now.hour < 12:
        return True
    try:
        with open(mark_path, encoding="utf-8") as f:
            return f.read().strip() != now.date().isoformat()
    except OSError:
        return True


def mark_instagram_done(now=None, mark_path=INSTAGRAM_MARK):
    os.makedirs(os.path.dirname(mark_path), exist_ok=True)
    with open(mark_path, "w", encoding="utf-8") as f:
        f.write((now or _kst_now()).date().isoformat())


async def run_tool(script, timeout_min=60, args=()):
    """collector/tools/<script> 를 별도 프로세스로 실행하고 결과 한 줄을 돌려준다."""
    here = os.path.dirname(os.path.abspath(__file__))
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "-u", os.path.join(here, "tools", script), *args,
        cwd=here, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout_min * 60)
    except asyncio.TimeoutError:
        proc.kill()
        return {"name": script, "status": "FAIL", "summary": f"❌ {timeout_min}분 안에 끝나지 않아 중단"}
    lines = [l for l in out.decode("utf-8", "replace").splitlines() if l.strip()]
    last = lines[-1][:200] if lines else ""
    if proc.returncode != 0:
        return {"name": script, "status": "FAIL", "summary": f"❌ 실패(종료 코드 {proc.returncode}): {last}"}
    return {"name": script, "status": "SUCCESS", "summary": f"✅ {last}"}


def quiet_runs(configs):
    """원래 행사가 드문 출처: 정의의 expect.quiet_runs_ok, 없고 min_rows 0(빈 목록 허용)이면 6회(사흘)"""
    from source_loader import find_for_url
    out = {}
    for c in configs:
        if c['target_type'] != 'website':
            continue
        d = find_for_url(c['value'])
        if not d:
            continue
        e = d.get('expect') or {}
        n = e.get('quiet_runs_ok') or (6 if e.get('min_rows', 1) == 0 else None)
        if n:
            out[c['name']] = n
    return out


async def run_crawlers(specific_target=None):
    print(f"🚀 {'Manual request:' if specific_target else 'Routine'} crawler started at {datetime.now()}", flush=True)
    db = Database()
    start_time = datetime.now(timezone.utc).isoformat()
    # 실행 기록(ops_log)의 run_at: 로그 파일 이름(scheduled_YYYYMMDD_HHmm)과 같은 분 단위 한국 시각
    run_at = _kst_now().replace(second=0, microsecond=0).isoformat()
    
    try:
        configs = []
        paused_sources = []
        if specific_target:
            configs = [specific_target]
        else:
            whitelist_items = db.get_whitelist()
            for item in whitelist_items:
                # 관리자 화면에서 «쉬게 함»으로 둔 출처(whitelist.paused_reason, specs/019 A5)는 읽지 않고 이유만 보고한다
                if (item.get('paused_reason') or '').strip() and 'instagram.com' not in (item.get('value') or ''):
                    paused_sources.append({"name": item.get('name') or item.get('value'), "status": "SUCCESS",
                                           "summary": f"⏸️ 일시 중지: {item['paused_reason'].strip()}"})
                    continue
                value = item.get('value') or ''
                target_type = 'website'
                if 'instagram.com' in value: target_type = 'instagram'
                elif 'facebook.com' in value: target_type = 'facebook'
                elif item.get('type') == 'naver_blog' or 'blog.naver.com' in value: target_type = 'naver_blog'
                configs.append({
                    'target_type': target_type,
                    'value': item['value'],
                    'name': item.get('name', 'Whitelist Source')
                })

        if not configs: return

        # 스크래퍼 실행 (로그는 스크래퍼 내부에서 각 log_id에 대해 상세히 기록함)
        if specific_target and specific_target.get('target_type') == 'website':
            public = PublicScraper(db)
            await public.scrape([specific_target])
        elif not specific_target:
            # 루틴 실행 시: website만 수집한다. 나머지 유형은 건너뛴 것으로 센다
            public = PublicScraper(db)
            results = await public.scrape([c for c in configs if c['target_type'] == 'website'])
            # KOPIS(공연 API)는 화이트리스트와 무관하게 정기 크롤마다 돈다
            results.append(await KopisScraper(db).scrape())
            results += paused_sources
            # 지자체 공식 블로그(RSS + 본문의 📅/📍 블록, AI 없음). 발행은 아래 자동 공개가 맡는다
            for c in configs:
                if c['target_type'] != 'naver_blog':
                    continue
                try:
                    blog_id = re.search(r"blog\.naver\.com/([\w-]+)", c['value']).group(1)
                    region = next((r for r in BLOG_REGIONS if r in c['name']), "경남")
                    res = await scrape_blog(blog_id, region, c['name'], db)
                    if not res['found'] and res.get('roundups') == 0:
                        # 월간 「행사 모음」 글이 없는 블로그(단체·기관 블로그의 낱개 행사 글)는 이 수집 방식이 읽지 못한다.
                        # 발견 0건 경고 대신 미구현으로 건너뛴 것으로 적는다(2026-11-27, 경고 19건 정리)
                        results.append({"name": c['name'], "status": "SUCCESS",
                                        "summary": "⏭️ 블로그 건너뜀: 최근 50개 글에 월간 행사 모음 글이 없음 — 낱개 행사 글 수집은 미구현"})
                        continue
                    results.append({"name": c['name'], "status": "SUCCESS",
                                    "summary": f"✅ 블로그 행사 {len(res['found'])}건 (신규 {res['new']}, 중복 {res['dup']})"})
                except Exception as e:
                    results.append({"name": c['name'], "status": "FAIL", "summary": f"❌ 블로그 수집 실패: {e}"})
            skipped = {}
            for c in configs:
                if c['target_type'] not in ('website', 'naver_blog'):
                    skipped[c['target_type']] = skipped.get(c['target_type'], 0) + 1

            # 검증(날짜·열리는 링크·중복)을 통과한 것만 오늘~60일 뒤 범위에서 공개한다. AUTO_PUBLISH=off 면 인박스 검토로 남긴다
            publish_line = "• 자동 공개: 꺼짐 (AUTO_PUBLISH=off)"
            if os.getenv("AUTO_PUBLISH", "on").lower() != "off":
                from tools.publish_verified import main as publish_verified
                today = datetime.now(timezone(timedelta(hours=9))).date()
                try:
                    publish_line = "• 자동 공개: " + await publish_verified(today.isoformat(), (today + timedelta(days=60)).isoformat(), False)
                except Exception as e:
                    publish_line = f"• 자동 공개 실패: {e}"

            # 인스타그램(하루 한 번, 오전 루틴): 새 게시물 → raw_posts REVIEW(주간 검토로만 공개), 계정 재채점·탐색.
            # 이 PC의 로그인 프로필(collector/.cache/ig_profile)이 필요하고 오래 걸리므로 별도 프로세스로 돌리고,
            # 실패하거나 시간을 넘겨도 루틴은 계속한다. INSTAGRAM_DAILY=off 면 건너뛴다.
            # 오전 회차를 놓친 날(08:20에 PC가 꺼져 있던 날 등)은 오후 회차가 대신 돈다: 그날 수집이 성공했는지는 표시 파일로 안다
            if os.getenv("INSTAGRAM_DAILY", "on").lower() != "off" and instagram_due():
                for script in ("collect_instagram.py", "discover_instagram.py"):
                    r = await run_tool(script, timeout_min=90)
                    results.append(r)
                    if script == "collect_instagram.py" and r["status"] == "SUCCESS":
                        mark_instagram_done()

            # 인스타 후보(REVIEW) 정리(specs/003 R2): 끝난 것 EXPIRED·이미 공개된 것 DUPLICATE, 남은 것에 무더기
            # (공개 후보·동의 필요·사람 판단). 인스타 수집을 건너뛴 회차에도 돈다. 실패해도 루틴은 계속한다
            triage = await run_tool("triage_review.py", timeout_min=10, args=["--apply"])
            review_line = "• REVIEW 정리: " + triage["summary"].replace("✅ ✅ REVIEW 정리: ", "✅ ", 1)
            # 관리자가 인박스 «공개 후보»에서 승인한 것(content.publish_approved_at)만 같은 검증(날짜·링크·중복)을 거쳐
            # 공개한다. 검증에 걸리면 REVIEW 로 두고 review_reason 을 남긴다. AUTO_PUBLISH=off 면 함께 멈춘다
            if os.getenv("AUTO_PUBLISH", "on").lower() != "off":
                from tools.publish_verified import publish_approved
                today = datetime.now(timezone(timedelta(hours=9))).date()
                try:
                    review_line += "\n• 승인 후보 공개: " + await publish_approved(
                        today.isoformat(), (today + timedelta(days=60)).isoformat())
                except Exception as e:
                    review_line += f"\n• 승인 후보 공개 실패: {e}"
            else:
                review_line += "\n• 승인 후보 공개: 꺼짐 (AUTO_PUBLISH=off)"

            # 내 주변 행사(specs/002): 새로 공개된 행사의 장소 좌표 채우기. 실패해도 루틴은 계속한다
            geo = await run_tool("geocode_venues.py", timeout_min=20)
            geo_line = f"• 장소 좌표: {geo['summary']}"
            # 포스터 지문(specs/014): 새 행사의 포스터 SHA-256 을 채운다. 안내 그림이면 DB 가 글자 포스터 표시를 켠다
            fp = await run_tool("poster_fingerprint.py", timeout_min=15, args=["--apply"])
            geo_line += f"\n• 포스터 지문: {fp['summary']}"
            # 안내 그림이 포스터로 들어온 행사는 원본 페이지 본문의 진짜 포스터로 바꾼다(정의 파일 detail.body 가 있는 출처만)
            rf = await run_tool("refill_placeholder_posters.py", timeout_min=10, args=["--apply"])
            geo_line += f"\n• 안내 그림 포스터 바꾸기: {rf['summary']}"
            # 세부 갈래(specs/015): 새 행사·세부가 빈 행사를 규칙으로 판정. 애매한 것은 운영자 검토 대기로
            gn = await run_tool("classify_genre.py", timeout_min=10, args=["--apply"])
            geo_line += f"\n• 세부 갈래: {gn['summary']}"
            # 공개 후 중복 점검(2026-11-26): 공개 행 전체를 (시작일·지역)으로 묶어 견주고, 같은 행사면 순위 낮은 쪽을 백업 후 숨긴다
            dd = await run_tool("dedupe_published.py", timeout_min=10, args=["--apply"])
            geo_line += f"\n• 공개 후 중복 점검: {dd['summary']}"
            # 휴대폰 알림(specs/018): 찜한 행사 전날·금요일 주말 요약·찜한 장소 새 행사. 같은 알림은 두 번 보내지 않는다
            ps = await run_tool("send_push.py", timeout_min=5)
            geo_line += f"\n• 휴대폰 알림: {ps['summary']}"

            # 인스타 운영 기록(docs/insta, git 밖) 글 파일을 구글드라이브 폴더로 복사. 실패해도 루틴은 계속한다
            backup = await run_tool("backup_insta.py", timeout_min=10)
            backup_line = f"• 인스타 기록 백업: {backup['summary']}"

            # 인스타 리포트 숫자를 관리자 대시보드용 ops_snapshots 로 올린다. 실패해도 루틴은 계속한다
            snap = await run_tool("publish_ops_snapshots.py", timeout_min=10)
            backup_line += f"\n• 대시보드 스냅숏: {snap['summary']}"

            # 사이트 방문 수(Vercel Web Analytics 합계)를 대시보드용으로 올린다(specs/011). 실패해도 루틴은 계속한다
            visits = await run_tool("publish_site_visits.py", timeout_min=5)
            backup_line += f"\n• 사이트 방문: {visits['summary']}"

            # 피카 인스타에 소개한 행사 → events.insta_post_url·insta_posted_at (posted.json 을 읽기만 한다)
            synced = await run_tool("sync_insta_posts.py", timeout_min=10)
            backup_line += f"\n• 인스타 게시 반영: {synced['summary']}"

            # 새로 공개된 행사에 주최·주관 기관·단체를 잇는다(specs/012, orgs·event_orgs). 실패해도 루틴은 계속한다
            orgs = await run_tool("link_orgs.py", timeout_min=20, args=["--apply"])
            backup_line += f"\n• 단체 연결: {orgs['summary']}"

            # 전체 종료 알림: 처리·실패·건너뜀을 숫자로 남긴다
            failed = [r for r in results if r['status'] != 'SUCCESS']
            n_blog = sum(1 for c in configs if c['target_type'] == 'naver_blog')
            lines = [f"{'⚠️' if failed else '✅'} 정기 크롤링 완료 — 출처 {len(results)}곳 처리 (웹사이트 {len(results) - 1 - n_blog} + KOPIS + 블로그 {n_blog}, 실패 {len(failed)})"]
            lines += [f"• {r['name']}: {r['summary']}" for r in results]
            for t, n in skipped.items():
                lines.append(f"• {t} {n}곳 건너뜀 (미구현)")
            lines.append(publish_line)
            lines.append(review_line)
            lines.append(geo_line)
            lines.append(backup_line)
            lines.append(f"• AI 추출: {'켜짐' if AIExtractor().enabled else '꺼짐 (기본값 사용)'}")

            # 실행 기록·이상 판정(specs/003 R1): 출처별 숫자를 ops_snapshots 에 남기고 경고를 켜고 끈다.
            # 결과는 로그와 관리자 «현황»에서 본다(텔레그램 알림은 2026-11-27 없앰).
            try:
                import ops_log
                blog_names = {c['name'] for c in configs if c['target_type'] == 'naver_blog'}
                rows = ops_log.to_rows(results, run_at, blog_names, publish_line)
                res = ops_log.record(db, rows, quiet=quiet_runs(configs))
                lines.append("• 실행 기록: " + ops_log.summary_line(res))
                # 관리자 «현황»의 회차 요약(specs/019 A6): 이 회차의 단계별 한 줄을 남긴다. 실패해도 루틴은 계속한다
                try:
                    step_lines = [l for block in (publish_line, review_line, geo_line, backup_line) for l in block.split("\n")]
                    ops_log.record_steps(db, run_at, step_lines, head=lines[0])
                except Exception as e:
                    lines.append(f"• 회차 요약 저장 실패: {e}")
            except Exception as e:
                lines.append(f"• 실행 기록 실패: {e}")
            message = "\n".join(lines)
            print(message, flush=True)
        
    except Exception as e:
        print(f"Crawler error: {e}")
        if specific_target and specific_target.get('log_id'):
            db.supabase.table("crawl_logs").update({"status": "FAIL", "error_msg": str(e)}).eq("id", specific_target['log_id']).execute()

async def check_manual_requests():
    db = Database()
    try:
        # 오래 RUNNING으로 남은 요청은 결과를 기록하지 못한 것으로 보고 마감
        reclaim_running(db, RUNNING_TIMEOUT, f"시간 초과: {int(RUNNING_TIMEOUT.total_seconds() // 60)}분 안에 결과가 기록되지 않음")

        # 중복 실행 방지: 같은 대상이 이미 RUNNING 상태인지 확인
        running_check = db.supabase.table("crawl_logs")\
            .select("target_name")\
            .eq("status", "RUNNING")\
            .execute()

        running_targets = [log['target_name'] for log in running_check.data] if running_check.data else []

        # REQUESTED 상태 중 RUNNING이 아닌 대상만 처리
        res = db.supabase.table("crawl_logs")\
            .select("*")\
            .eq("status", "REQUESTED")\
            .order("started_at")\
            .limit(5)\
            .execute()

        if res.data:
            for req in res.data:
                # 이미 실행 중이면 건너뛰기
                if req['target_name'] in running_targets:
                    print(f"⏭️ [Manual Request] {req['target_name']} already running, skipping", flush=True)
                    # REQUESTED 상태를 CANCELLED로 변경
                    db.supabase.table("crawl_logs").update({
                        "status": "CANCELLED",
                        "result_summary": "이미 실행 중인 크롤링이 있어 취소됨",
                        "finished_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", req['id']).execute()
                    continue

                print(f"\n{'='*60}", flush=True)
                print(f"🔔 [Manual Request] Detected: {req['target_name']}", flush=True)
                print(f"🔔 [Manual Request] Log ID: {req['id']}", flush=True)
                print(f"{'='*60}", flush=True)

                db.supabase.table("crawl_logs").update({
                    "status": "RUNNING",
                    "started_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", req['id']).execute()
                print(f"✅ [Manual Request] Status updated to RUNNING", flush=True)

                source_res = db.supabase.table("whitelist")\
                    .select("*")\
                    .or_(f"name.eq.{req['target_name']},value.eq.{req['target_name']}")\
                    .limit(1)\
                    .execute()

                if source_res.data:
                    source = source_res.data[0]
                    print(f"✅ [Manual Request] Source found in whitelist: {source.get('name')}", flush=True)
                    print(f"🚀 [Manual Request] Starting crawler...\n", flush=True)
                    running_targets.append(req['target_name'])  # 실행 중 목록에 추가
                    try:
                        await run_crawlers({
                            'target_type': 'website',
                            'value': source['value'],
                            'name': source.get('name', req['target_name']),
                            'log_id': req['id']
                        })
                    finally:
                        # 스크래퍼가 결과를 기록하지 못했으면 RUNNING으로 남기지 않는다
                        after = db.supabase.table("crawl_logs").select("status").eq("id", req['id']).single().execute()
                        if after.data and after.data.get('status') == 'RUNNING':
                            db.supabase.table("crawl_logs").update({
                                "status": "FAIL",
                                "error_msg": "수집기가 결과를 기록하지 않고 끝남",
                                "finished_at": datetime.now(timezone.utc).isoformat()
                            }).eq("id", req['id']).execute()
                            print(f"❌ [Manual Request] Log {req['id']} was left RUNNING → FAIL", flush=True)
                else:
                    print(f"❌ [Manual Request] Source not found in whitelist!", flush=True)
                    db.supabase.table("crawl_logs").update({
                        "status": "FAIL",
                        "error_msg": "Source not found",
                        "finished_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", req['id']).execute()
    except Exception as e:
        print(f"❌ [Manual Request] Error: {e}", flush=True)
        import traceback
        print(f"🔍 [Manual Request] Traceback: {traceback.format_exc()}", flush=True)

async def main():
    print("=" * 80, flush=True)
    print("🎨 Gyeongnam Art Navigator - Collector Service", flush=True)
    print("=" * 80, flush=True)
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"🔄 Checking for manual requests every 10 seconds...", flush=True)
    print(f"📅 Scheduled crawls: 04:00 and 18:00 daily", flush=True)
    print("=" * 80 + "\n", flush=True)

    write_pid_file()

    # 수집기는 한 대만 돈다: 시작 시점의 RUNNING은 이전 프로세스가 남긴 것
    reclaim_running(Database(), reason="수집기 재시작으로 중단됨")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_crawlers, 'cron', hour='4,18')
    scheduler.add_job(check_manual_requests, 'interval', seconds=10) # 10초로 단축
    scheduler.start()

    print("✅ Scheduler started. Waiting for requests...\n", flush=True)

    while True:
        await asyncio.sleep(10)

if __name__ == "__main__":
    # --once: 정기 수집을 한 번 돌리고 끝낸다 (Windows 작업 스케줄러가 08:20·15:00에 run_once.ps1로 부른다)
    if "--once" in sys.argv:
        asyncio.run(run_crawlers())
    else:
        asyncio.run(main())
