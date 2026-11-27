-- specs/019 A0: orgs.partner_note 칸을 지운다(누구나 읽는 표에 메모 칸을 두지 않는다).
-- 프론트가 org_admin_notes 에 쓰도록 배포된 뒤에 적용한다. 적용 전 확인: SELECT count(*) FROM public.orgs WHERE partner_note IS NOT NULL; → 0
-- (0이 아니면 20261127100000 의 INSERT 가 옮겨 놓았는지 먼저 확인한다)
-- 되돌리기: ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS partner_note text CHECK (partner_note IS NULL OR char_length(partner_note) <= 200);

ALTER TABLE public.orgs DROP COLUMN IF EXISTS partner_note;
