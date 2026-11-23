"""피카 인스타 예약 회차마다 쓴 토큰과 걸린 시간을 docs/insta/runs.json 에 남긴다.

근거는 Claude Code 세션 기록(~/.claude/projects/F--projects-pick-art/*.jsonl)이다.
첫 사용자 메시지가 <scheduled-task name="pick-art-insta-..."> 로 시작하는 세션을 회차로 본다.
그 세션이 띄운 에이전트 기록(<세션>/subagents/*.jsonl)도 합친다.
응답마다 남는 usage(입력·캐시 쓰기·캐시 읽기·출력)를 message.id 별로 한 번씩 더한다.

사용 (collector 폴더에서, PYTHONIOENCODING=utf-8):
  python tools/insta_runs.py              모든 회차를 다시 세어 runs.json 을 고치고, 최근 회차를 보여 준다
  python tools/insta_runs.py --last 5     보여 줄 줄 수
  python tools/insta_runs.py --add <jsonl> [<jsonl>...] --task <이름>   예약이 아닌 수동 실행(에이전트 기록들)을 한 회차로 더한다

돌고 있는 회차는 status=running(마지막 기록이 10분 안)으로 적히고, 다음에 다시 돌리면 끝난 값으로 고쳐진다.
"""
import argparse
import glob
import json
import os
import re
import sys
from datetime import datetime, timezone

PROJ = os.path.expanduser(r"~/.claude/projects/F--projects-pick-art")
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "docs", "insta", "runs.json"))
TAG = re.compile(r'<scheduled-task name="(pick-art-insta-[^"]+)"')
KEYS = ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens")


def first_task(path):
    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            if d.get("type") != "user":
                continue
            c = d.get("message", {}).get("content")
            s = c if isinstance(c, str) else json.dumps(c, ensure_ascii=False)
            m = TAG.search(s[:2000])
            return m.group(1) if m else None
    return None


def measure(files):
    tot = dict.fromkeys(KEYS, 0)
    seen, turns, ts = set(), 0, []
    for p in files:
        with open(p, encoding="utf-8", errors="ignore") as f:
            for line in f:
                try:
                    d = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if d.get("timestamp"):
                    ts.append(d["timestamp"])
                m = d.get("message")
                if not isinstance(m, dict) or not m.get("usage"):
                    continue
                mid = m.get("id") or id(d)
                if mid in seen:
                    continue
                seen.add(mid)
                turns += 1
                for k in KEYS:
                    tot[k] += m["usage"].get(k) or 0
    if not ts:
        return None
    t0 = datetime.fromisoformat(min(ts).replace("Z", "+00:00"))
    t1 = datetime.fromisoformat(max(ts).replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    kst = lambda t: t.astimezone(timezone.utc).astimezone(datetime.now().astimezone().tzinfo).strftime("%Y-%m-%d %H:%M")
    return {
        "start": kst(t0), "end": kst(t1), "minutes": round((t1 - t0).total_seconds() / 60, 1),
        "status": "running" if (now - t1).total_seconds() < 600 else "done",
        "turns": turns, "agents": max(0, len(files) - 1),
        "input": tot["input_tokens"], "cache_write": tot["cache_creation_input_tokens"],
        "cache_read": tot["cache_read_input_tokens"], "output": tot["output_tokens"],
        "avg_context": round((tot["input_tokens"] + tot["cache_creation_input_tokens"] + tot["cache_read_input_tokens"]) / turns) if turns else 0,
    }


def load():
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            return json.load(f)
    return []


def save(rows):
    rows.sort(key=lambda r: r["start"])
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(tmp, OUT)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--last", type=int, default=3)
    ap.add_argument("--add", nargs="+", help="수동 실행 기록(jsonl) 경로들 — 한 회차로 합친다")
    ap.add_argument("--task", help="--add 때 회차 이름")
    a = ap.parse_args()

    rows = {r["session"]: r for r in load()}
    if a.add:
        if not a.task:
            sys.exit("--add 에는 --task 가 필요하다")
        sid = "manual:" + "+".join(os.path.splitext(os.path.basename(x))[0] for x in a.add)
        r = measure(a.add)
        if r:
            r["agents"] = len(a.add)
            rows[sid] = {"session": sid, "task": a.task, "manual": True, **r}
    for p in glob.glob(os.path.join(PROJ, "*.jsonl")):
        task = first_task(p)
        if not task:
            continue
        sid = os.path.splitext(os.path.basename(p))[0]
        if rows.get(sid, {}).get("status") == "done":
            continue  # 끝난 회차는 다시 세지 않는다
        files = [p] + sorted(glob.glob(os.path.join(PROJ, sid, "subagents", "*.jsonl")))
        r = measure(files)
        if r:
            rows[sid] = {"session": sid, "task": task, **r}
    out = list(rows.values())
    save(out)
    keep = ("task", "start", "minutes", "status", "turns", "agents", "cache_read", "output", "avg_context")
    print(json.dumps({"file": OUT, "runs": len(out),
                      "last": [{k: r.get(k) for k in keep} for r in sorted(out, key=lambda r: r["start"])[-a.last:]]},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
