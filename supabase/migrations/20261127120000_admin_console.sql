-- specs/019 A3~A6: 관리자 화면 개편에 필요한 칸과 집계 함수. 더하기만 한다(기존 칸·줄을 바꾸지 않는다, 동의 칸 채우기 제외).
-- 되돌리기:
--   ALTER TABLE public.events DROP COLUMN IF EXISTS hidden_reason, DROP COLUMN IF EXISTS hidden_by, DROP COLUMN IF EXISTS hidden_at,
--     DROP COLUMN IF EXISTS keep_visible, DROP COLUMN IF EXISTS edited_at;
--   ALTER TABLE public.whitelist DROP COLUMN IF EXISTS consent, DROP COLUMN IF EXISTS consent_at, DROP COLUMN IF EXISTS consent_evidence, DROP COLUMN IF EXISTS paused_reason;
--   DROP FUNCTION IF EXISTS public.admin_push_stats(); DROP FUNCTION IF EXISTS public.admin_member_stats();

-- 1) 행사 숨김 기록 (A4). 지금까지 숨김(status='HIDDEN')은 이유가 DB에 없고 PC의 백업 파일에만 있었다.
--    keep_visible: 운영자가 되돌린 행사 — 중복 정리가 다시 숨기지 않는다.
--    events 는 공개 행을 누구나 읽는 표다 → hidden_by 에는 메일 주소를 넣지 않고 «운영자»·«자동: 중복 정리» 같은 갈래만 적는다.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hidden_reason text CHECK (hidden_reason IS NULL OR char_length(hidden_reason) <= 300);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hidden_by text CHECK (hidden_by IS NULL OR char_length(hidden_by) <= 120);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS keep_visible boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- 2) 출처 (A5). role·score·score_detail 은 운영 DB에는 있는데 마이그레이션 기록에 없었다 → 기록을 맞춘다(있으면 그대로).
ALTER TABLE public.whitelist ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.whitelist ADD COLUMN IF NOT EXISTS score integer;
ALTER TABLE public.whitelist ADD COLUMN IF NOT EXISTS score_detail text;
--    동의 단계: none 없음 · temporary 임시(그 행사 한 건) · standing 상시(앞으로의 소식까지) · withdrawn 철회
ALTER TABLE public.whitelist ADD COLUMN IF NOT EXISTS consent text NOT NULL DEFAULT 'none'
    CHECK (consent IN ('none', 'temporary', 'standing', 'withdrawn'));
ALTER TABLE public.whitelist ADD COLUMN IF NOT EXISTS consent_at date;
ALTER TABLE public.whitelist ADD COLUMN IF NOT EXISTS consent_evidence text CHECK (consent_evidence IS NULL OR char_length(consent_evidence) <= 500);
--    쉬게 함: 값이 있으면 정기 실행이 건너뛰고 경고를 켜지 않는다
ALTER TABLE public.whitelist ADD COLUMN IF NOT EXISTS paused_reason text CHECK (paused_reason IS NULL OR char_length(paused_reason) <= 300);

--    지금까지 score_detail 끝에 글자로 적던 동의 표시(「상시동의:YYYY-MM-DD(근거)」「임시동의:YYYY-MM-DD(근거)」)를 칸으로 옮겨 적는다.
--    score_detail 의 글자는 지우지 않는다. 이미 칸에 값이 있는 줄은 건드리지 않는다.
UPDATE public.whitelist
   SET consent = 'standing',
       consent_at = substring(score_detail from '상시동의:(\d{4}-\d{2}-\d{2})')::date,
       consent_evidence = left(substring(score_detail from '상시동의:\d{4}-\d{2}-\d{2}\(([^)]*)\)'), 500)
 WHERE consent = 'none' AND score_detail LIKE '%상시동의:%';
UPDATE public.whitelist
   SET consent = 'temporary',
       consent_at = substring(score_detail from '임시동의:(\d{4}-\d{2}-\d{2})')::date,
       consent_evidence = left(substring(score_detail from '임시동의:\d{4}-\d{2}-\d{2}\(([^)]*)\)'), 500)
 WHERE consent = 'none' AND score_detail LIKE '%임시동의:%';

-- 3) 현황 숫자 (A6). 관리자만 부를 수 있고 숫자만 돌려준다(누가 구독했는지·누구에게 보냈는지는 돌려주지 않는다).
CREATE OR REPLACE FUNCTION public.admin_push_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
    RETURN jsonb_build_object(
        'devices', (SELECT count(*) FROM push_subscriptions),
        'users', (SELECT count(DISTINCT user_id) FROM push_subscriptions),
        'failing', (SELECT count(*) FROM push_subscriptions WHERE fail_count > 0),
        'sent', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', d, 'kind', kind, 'n', n) ORDER BY d DESC, kind), '[]'::jsonb)
                   FROM (SELECT (sent_at AT TIME ZONE 'Asia/Seoul')::date AS d, kind, count(*) AS n
                           FROM push_sent WHERE sent_at > now() - interval '30 days' GROUP BY 1, 2) s)
    );
END $$;

CREATE OR REPLACE FUNCTION public.admin_member_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
    RETURN jsonb_build_object(
        'members', (SELECT count(*) FROM profiles),
        'admins', (SELECT count(*) FROM profiles WHERE role = 'admin'),
        'new_7d', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '7 days'),
        'new_30d', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '30 days'),
        'with_region', (SELECT count(*) FROM profiles WHERE region IS NOT NULL AND region <> ''),
        'favorites', (SELECT count(*) FROM favorites),
        'favorite_users', (SELECT count(DISTINCT user_id) FROM favorites),
        'venue_follows', (SELECT count(*) FROM venue_follows),
        'venue_follow_users', (SELECT count(DISTINCT user_id) FROM venue_follows)
    );
END $$;

REVOKE ALL ON FUNCTION public.admin_push_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_member_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_push_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_member_stats() TO authenticated;
