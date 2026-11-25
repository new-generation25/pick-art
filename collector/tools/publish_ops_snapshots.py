"""인스타 운영 리포트 숫자를 Supabase ops_snapshots 에 올린다. 앱 관리자 대시보드(/admin)가 이것을 읽는다.

순서
  1. tools/insta_report.py 를 실행해 docs/insta/report/*.json 을 새로 만든다(--no-build 면 건너뛴다)
  2. metrics · daily · runs · stats 네 파일을 ops_snapshots(name='insta_<파일이름>') 에 덮어쓴다
     activity.json(한 줄 = 활동 하나, 250KB 넘음)은 대시보드에 쓰지 않아 올리지 않는다

쓰기는 collector/.env.local 의 service 키로 한다(RLS 우회). 표는 관리자만 읽을 수 있다.
사용: python tools/publish_ops_snapshots.py [--no-build]   (collector 폴더에서. 마지막 줄이 한 줄 요약)
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402

REPORT = os.path.normpath(os.path.join(HERE, "..", "docs", "insta", "report"))
NAMES = ("metrics", "daily", "runs", "stats")


def main():
    if "--no-build" not in sys.argv:
        r = subprocess.run([sys.executable, "-u", os.path.join(HERE, "tools", "insta_report.py")],
                           cwd=HERE, capture_output=True, text=True, encoding="utf-8",
                           env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        if r.returncode != 0:
            last = (r.stdout + r.stderr).strip().splitlines()[-1:] or [""]
            print(f"❌ 인스타 리포트 만들기 실패: {last[0][:200]}")
            return 1

    db = Database()
    now = datetime.now(timezone.utc).isoformat()
    sent = []
    for name in NAMES:
        path = os.path.join(REPORT, f"{name}.json")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        db.supabase.table("ops_snapshots").upsert(
            {"name": f"insta_{name}", "data": data, "updated_at": now}, on_conflict="name").execute()
        sent.append(f"{name} {len(data.get('rows', []))}줄")

    # 올라갔는지 읽어서 확인한다(쓴 것만 센다)
    got = db.supabase.table("ops_snapshots").select("name,updated_at").in_(
        "name", [f"insta_{n}" for n in NAMES]).execute().data or []
    fresh = [g["name"] for g in got if g["updated_at"][:19] == now[:19]]
    if len(fresh) != len(sent):
        print(f"❌ 운영 스냅숏 확인 실패: 올린 {len(sent)}개 중 읽힌 {len(fresh)}개")
        return 1
    print(f"✅ 운영 스냅숏 {len(sent)}개 올림 ({', '.join(sent)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
