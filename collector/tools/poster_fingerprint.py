"""행사 포스터 파일의 지문(SHA-256)을 events.poster_sha256 에 채운다(specs/014).

안내 그림(포스터 자리에 올라온 «공연 이미지 준비 중» 같은 그림)은 파일 이름이 행사마다 달라도 내용이 같다.
지문이 placeholder_images 에 있으면 DB 트리거가 events.poster_placeholder 를 true 로 맞추고,
공개 화면은 그 행사를 글자 포스터로 보인다. 이 도구는 지문만 적는다. 공개 상태·포스터 주소는 건드리지 않는다.

대상: 공개(PUBLISHED)·검토(REVIEW) 행사 중 poster_image_url 이 있고 poster_sha256 이 빈 것.
      피카 저장소(posters 버킷) 주소와 바깥 주소(KOPIS 등) 모두 읽는다. http(s) 가 아닌 값은 건너뛴다.

쓰기는 collector/.env.local 의 service 키로 한다(RLS 우회). 키는 출력하지 않는다.
사용(collector 폴더에서, 마지막 줄이 한 줄 요약):
  python tools/poster_fingerprint.py              미리보기: 채울 수만 센다
  python tools/poster_fingerprint.py --apply      지문을 적는다
  python tools/poster_fingerprint.py --report     같은 지문을 3개 넘는 공개 행사가 쓰는 그림(«안내 그림 후보») 목록
  python tools/poster_fingerprint.py --mark <sha256> --note "메모"   안내 그림으로 표시(관리자 화면과 같은 일)
"""
import argparse
import hashlib
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import requests

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402

def rows_without_hash(sb):
    out, off = [], 0
    while True:
        d = (sb.table("events").select("id,poster_image_url,status")
             .in_("status", ["PUBLISHED", "REVIEW"]).is_("poster_sha256", "null")
             .not_.is_("poster_image_url", "null").order("id").range(off, off + 999).execute().data)
        out += d
        if len(d) < 1000:
            return out
        off += 1000


def fingerprint(url):
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return hashlib.sha256(r.content).hexdigest(), len(r.content)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--mark")
    ap.add_argument("--note", default=None)
    a = ap.parse_args()
    sb = Database().supabase

    if a.mark:
        sha = a.mark.strip().lower()
        n = len(sb.table("events").select("id").eq("poster_sha256", sha).execute().data)
        sb.table("placeholder_images").upsert({"sha256": sha, "note": (a.note or "")[:120] or None}).execute()
        print(f"안내 그림 표시: {sha[:12]}… (이 지문을 쓰는 행사 {n}건)")
        return

    if a.report:
        rows, off = [], 0
        while True:
            d = (sb.table("events").select("poster_sha256,poster_image_url,title")
                 .eq("status", "PUBLISHED").not_.is_("poster_sha256", "null").range(off, off + 999).execute().data)
            rows += d
            if len(d) < 1000:
                break
            off += 1000
        marked = {r["sha256"] for r in sb.table("placeholder_images").select("sha256").execute().data}
        groups = {}
        for r in rows:
            groups.setdefault(r["poster_sha256"], []).append(r)
        cands = sorted(((k, v) for k, v in groups.items() if len(v) > 3), key=lambda kv: -len(kv[1]))
        for k, v in cands:
            print(f"{k[:12]}… {len(v)}건 {'[표시됨]' if k in marked else ''} 예: {v[0]['title'][:30]} {v[0]['poster_image_url']}")
        print(f"안내 그림 후보 {len(cands)}개 (같은 지문 4건 이상), 표시됨 {sum(1 for k, _ in cands if k in marked)}개")
        return

    todo = rows_without_hash(sb)
    ours = [r for r in todo if (r["poster_image_url"] or "").startswith(("http://", "https://"))]
    skipped = len(todo) - len(ours)
    if not a.apply:
        print(f"미리보기: 지문 채울 행사 {len(ours)}건 (주소가 아니라 건너뜀 {skipped}건). --apply 로 적는다")
        return

    done = failed = 0

    def work(r):
        try:
            sha, _ = fingerprint(r["poster_image_url"])
            sb.table("events").update({"poster_sha256": sha}).eq("id", r["id"]).execute()
            return True
        except Exception as e:  # 한 건 실패해도 나머지는 계속
            print(f"  실패 {r['id']}: {type(e).__name__}", flush=True)
            return False

    with ThreadPoolExecutor(max_workers=6) as ex:
        for ok in ex.map(work, ours):
            done += ok
            failed += (not ok)
    n_ph = len(sb.table("events").select("id").eq("poster_placeholder", True).in_("status", ["PUBLISHED", "REVIEW"]).execute().data)
    print(f"포스터 지문: 채움 {done}건, 실패 {failed}건, 주소 아님 {skipped}건 · 안내 그림 행사 {n_ph}건")


if __name__ == "__main__":
    main()
