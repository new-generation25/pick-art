"""인스타 운영 기록(docs/insta/)의 글 파일을 구글드라이브 폴더로 복사한다. 이미지·영상은 복사하지 않는다.

docs/insta/ 는 로그인 정보가 섞일 수 있어 git 에서 빠져 있고, 이 PC 의 F: 외장 SSD 한 곳에만 있다.
그래서 정기 수집이 끝날 때마다 PC 밖(구글드라이브 동기화 폴더)에 사본을 남긴다.

  <대상>/latest/...            글 파일 전체(.json .html .md .txt .py)를 같은 경로로 덮어쓴다(5MB 넘는 파일 제외)
  <대상>/daily/YYYY-MM-DD/     최상위 기록 JSON(posted·dm·engaged·feedback·stats·runs …)만 날짜별로 남긴다

대상 폴더 기본값: G:\\내 드라이브\\01 project\\pick-art-backup\\insta  (환경 변수 INSTA_BACKUP_DIR 로 바꿀 수 있다)
대상 드라이브가 없으면(구글드라이브 꺼짐) 아무것도 쓰지 않고 SKIP 으로 끝난다. 대상 쪽 파일은 지우지 않는다.

사용: python tools/backup_insta.py   (collector 폴더에서. 마지막 줄이 한 줄 요약)
"""
import os
import shutil
import sys
from datetime import datetime, timedelta, timezone

SRC = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "insta"))
DEST = os.getenv("INSTA_BACKUP_DIR", r"G:\내 드라이브\01 project\pick-art-backup\insta")
TEXT_EXT = {".json", ".html", ".md", ".txt", ".py"}
MAX_BYTES = 5 * 1024 * 1024


def copy_if_changed(src, dst):
    """크기·수정 시각이 같으면 건너뛴다. 복사했으면 True."""
    if os.path.exists(dst):
        s, d = os.stat(src), os.stat(dst)
        if s.st_size == d.st_size and int(s.st_mtime) <= int(d.st_mtime):
            return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    return True


def main():
    drive = os.path.splitdrive(DEST)[0]
    if drive and not os.path.exists(drive + os.sep):
        print(f"⏭️ 인스타 기록 백업 건너뜀: {drive} 드라이브 없음")
        return 0
    if not os.path.isdir(SRC):
        print(f"⏭️ 인스타 기록 백업 건너뜀: 원본 폴더 없음 ({SRC})")
        return 0

    copied = same = big = 0
    latest = os.path.join(DEST, "latest")
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in files:
            if os.path.splitext(name)[1].lower() not in TEXT_EXT:
                continue
            src = os.path.join(root, name)
            if os.path.getsize(src) > MAX_BYTES:
                big += 1
                continue
            dst = os.path.join(latest, os.path.relpath(src, SRC))
            if copy_if_changed(src, dst):
                copied += 1
            else:
                same += 1

    today = datetime.now(timezone(timedelta(hours=9))).date().isoformat()
    daily = os.path.join(DEST, "daily", today)
    n_daily = 0
    for name in sorted(os.listdir(SRC)):
        src = os.path.join(SRC, name)
        if os.path.isfile(src) and name.endswith(".json"):
            copy_if_changed(src, os.path.join(daily, name))
            n_daily += 1

    print(f"✅ 인스타 기록 백업: 새로 복사 {copied} · 그대로 {same} · 5MB 초과 제외 {big} · 날짜별 기록 {n_daily}개 ({today})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
