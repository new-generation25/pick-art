"""운영 DB 되돌림 시험 SQL 만들기 (specs/021).

마이그레이션과 dryrun_tests.sql 을 한 문장(DO 블록)으로 묶는다. 끝에서 RAISE EXCEPTION 으로 결과를 내보내므로
그 문장이 한 일(표·함수·시험 줄)은 모두 되돌아간다. SQL 편집기에 붙여 실행하고 오류 글 안의 PTTEST {...} 를 읽는다.

  python specs/021-tip-points/checks/make_dryrun.py  →  specs/021-tip-points/checks/dryrun.sql
"""
import io
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

mig = io.open(os.path.join(ROOT, "supabase", "migrations", "20261127140000_points.sql"), encoding="utf-8").read().replace("\r\n", "\n")
tests = io.open(os.path.join(HERE, "dryrun_tests.sql"), encoding="utf-8").read().replace("\r\n", "\n")
assert "$mig$" not in mig and "$outer$" not in mig

out = (
    "DO $outer$\n"
    "DECLARE\n"
    "    r jsonb := '{}'::jsonb;\n"
    "    j jsonb;\n"
    "    n0 int; n1 int;\n"
    "    uid uuid; uid2 uuid;\n"
    "    pid uuid; anon_row uuid; lid uuid; lid2 uuid;\n"
    "BEGIN\n"
    "    PERFORM set_config('lock_timeout', '3s', true);\n"
    "    EXECUTE $mig$\n" + mig + "\n$mig$;\n" + tests + "END\n$outer$;\n"
)
io.open(os.path.join(HERE, "dryrun.sql"), "w", encoding="utf-8", newline="\n").write(out)
print(out.count("\n"), "lines")
