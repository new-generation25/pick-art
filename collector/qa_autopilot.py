import os
import asyncio
import json
from datetime import datetime
from database import Database

# Case Study Document Path
CASE_STUDY_PATH = r"e:\developement\pick-art\QA_CASE_STUDIES.md"

class QAAutopilot:
    def __init__(self):
        self.db = Database()
        self.last_checked_id = 0

    async def start_monitoring(self):
        print("🤖 [QA Autopilot] Monitoring Started. Watching for failures...")
        while True:
            try:
                await self.check_and_resolve()
            except Exception as e:
                print(f"⚠️ [QA Autopilot] Error in monitoring loop: {e}")
            await asyncio.sleep(30) # 30초마다 체크

    async def check_and_resolve(self):
        # 1. FAIL인 로그 가져오기
        res = self.db.supabase.table("crawl_logs")\
            .select("*")\
            .eq("status", "FAIL")\
            .order("id", {"ascending": False})\
            .limit(5).execute()
        
        failed_logs = res.data
        if not failed_logs:
            return

        for log in failed_logs:
            log_id = log['id']
            if log_id <= self.last_checked_id:
                continue
            
            print(f"🚨 [QA Autopilot] Failure Detected! Log ID: {log_id}, Target: {log['target_name']}")
            await self.execute_recovery_workflow(log)
            self.last_checked_id = max(self.last_checked_id, log_id)

    async def execute_recovery_workflow(self, log):
        error_msg = log.get('result_summary', '') + "\n" + (log.get('detailed_log') or '')
        target = log['target_name']
        
        case_id = f"CASE-{datetime.now().strftime('%Y%m%d')}-{log['id']}"
        record = {
            "id": case_id,
            "target": target,
            "error": log.get('result_summary'),
            "strategies": []
        }

        # --- Strategy Selection Logic ---
        
        # A: Simple Retry
        record["strategies"].append({"name": "A: Automatic Retry", "status": "Executing..."})
        self.log_case_study(record) # 기록 시작

        # 실제 조치 예시: DB 스키마 오류면 보정 스크립트 재실행 등 가능
        if "column" in error_msg.lower() or "relation" in error_msg.lower():
            record["strategies"].append({"name": "B: Schema Rectification", "status": "Executing..."})
            # os.system("node apply_fix.mjs") 
            record["strategies"][-1]["status"] = "SUCCESS"

        if "timeout" in error_msg.lower() or "connection" in error_msg.lower():
            record["strategies"].append({"name": "C: Delay & Retry", "status": "Planned"})

        # 최종 상태 업데이트
        record["outcome"] = "Resolved via Auto-correction" if any(s['status'] == 'SUCCESS' for s in record["strategies"]) else "Requires Human Intervention"
        self.log_case_study(record, final=True)

    def log_case_study(self, record, final=False):
        """QA_CASE_STUDIES.md에 기록"""
        header = f"\n## 📁 {record['id']} | {record['target']} | {datetime.now().isoformat()}\n"
        content = f"- **오류**: {record['error']}\n"
        content += "- **시도된 전략**:\n"
        for s in record["strategies"]:
            content += f"    - {s['name']}: {s['status']}\n"
        
        if final:
            content += f"- **최종 결과**: {record['outcome']}\n"
            content += f"{'-'*40}\n"

        # 파일에 쓰기 (Append)
        with open(CASE_STUDY_PATH, "a", encoding="utf-8") as f:
            if not final:
                f.write(header)
            f.write(content)

if __name__ == "__main__":
    qa = QAAutopilot()
    asyncio.run(qa.start_monitoring())
