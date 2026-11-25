-- 운영 대시보드(/admin)용 스냅숏: 이 PC에만 있는 운영 기록을 요약해 올려 두는 자리
--   name       : 'insta_metrics', 'insta_daily', 'insta_runs' 처럼 묶음 이름 하나
--   data       : 그 묶음의 JSON (insta_report.py 가 만든 {rows, meta})
--   updated_at : 마지막으로 올린 시각
-- 쓰기는 수집기(service 키, RLS 우회)만 한다. 읽기는 관리자만. 익명·일반 회원은 읽을 수 없다.
-- 되돌리기: DROP TABLE public.ops_snapshots;

CREATE TABLE IF NOT EXISTS public.ops_snapshots (
    name        text PRIMARY KEY,
    data        jsonb NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ops_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read ops_snapshots" ON public.ops_snapshots;
CREATE POLICY "Admin read ops_snapshots" ON public.ops_snapshots
    FOR SELECT TO authenticated USING (public.is_admin());
