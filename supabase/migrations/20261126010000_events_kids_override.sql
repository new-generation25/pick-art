-- 아이와 같이 가기 좋은 곳 (specs/004-kids-friendly FR-009): 운영자가 행사별로 고친 아이 분류
--   NULL     : 규칙대로 (frontend/src/lib/kids.ts)
--   'target' : 아이 대상
--   'ok'     : 아이도 볼 수 있음
--   'none'   : 해당 없음
-- 쓰기는 기존 events RLS 그대로(관리자·service). 공개 행이면 익명도 읽는다(홈 분류에 필요).
-- 정기 수집은 이 칸을 쓰지 않는다(덮어쓰지 않음).
-- 되돌리기: ALTER TABLE public.events DROP COLUMN IF EXISTS kids_override;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS kids_override text
    CHECK (kids_override IS NULL OR kids_override IN ('target', 'ok', 'none'));
