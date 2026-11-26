-- specs/016 보완: 입력 칸 최소화(운영자 11/26 «/partners를 예술가·작은 단체용으로 다듬고 끝에 동의 칸»).
--   필수 칸은 단체·활동 이름, 공식 SNS·누리집, 담당 연락처만. 대표자는 선택으로 돌린다(개인 예술가는 대표자 = 본인).
-- 되돌리기: UPDATE public.partner_agreements SET representative = org_name WHERE representative IS NULL;
--           ALTER TABLE public.partner_agreements ALTER COLUMN representative SET NOT NULL;
ALTER TABLE public.partner_agreements ALTER COLUMN representative DROP NOT NULL;
ALTER TABLE public.partner_agreements DROP CONSTRAINT IF EXISTS partner_agreements_representative_check;
ALTER TABLE public.partner_agreements ADD CONSTRAINT partner_agreements_representative_check
    CHECK (representative IS NULL OR char_length(btrim(representative)) BETWEEN 1 AND 60);
