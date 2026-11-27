-- 숨은 행사 찾기: 로그인 제보 + 활동 포인트 (specs/021-tip-points). 운영자 결정 2026-11-27 저녁:
--   «제보할때 로그인 하도록 하고. 제보 한건단 100포인트 적립», 적립은 확인돼 피카에 실릴 때.
--   point_ledger            : 포인트 적립 내역. 본인과 관리자만 읽는다. 넣고 빼는 길은 아래 트리거뿐이다(회원·익명이 고칠 수 없다)
--   적립                    : reports(kind=tip, 회원 제보)가 done 이 되면 +100, done 에서 벗어나면 그 줄을 지운다. 제보 한 건에 한 번
--                             leaflet_submissions(channel=kakao_bot)에 회원(user_id)이 이어져 있으면 published 가 될 때 같은 +100
--                             (지금은 카카오 제보의 user_id 가 늘 비어 있다 — 챗봇 사용자와 회원을 잇는 일은 specs/017 쪽에서 한다)
--   my_points()             : 내 합계·순위(포인트가 있는 회원 가운데)·그 회원 수. 다른 회원 값은 주지 않는다
--   admin_member_points()   : 관리자만. 회원별 합계
--   submit_tip(jsonb)       : 로그인하지 않으면 login_required. 20261127130000 의 익명 한도(40건/일) 분기는 없앤다
--   사진 올리기·실패 알림   : 그 제보를 보낸 회원 본인만
-- 되돌리기: DROP TRIGGER tip_points_reports ON public.reports; DROP TRIGGER tip_points_leaflets ON public.leaflet_submissions;
--           DROP FUNCTION public.tip_points_reports(); DROP FUNCTION public.tip_points_leaflets(); DROP FUNCTION public.apply_tip_points(uuid,text,uuid,boolean,boolean);
--           DROP FUNCTION public.my_points(); DROP FUNCTION public.admin_member_points(); DROP TABLE public.point_ledger;
--           submit_tip · tip_upload_allowed · tip_photo_failed · "Tip upload pending photo" 는 20261127130000 판으로

CREATE TABLE IF NOT EXISTS public.point_ledger (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount      integer NOT NULL CHECK (amount <> 0 AND amount BETWEEN -100000 AND 100000),
    reason      text NOT NULL CHECK (reason IN ('tip')),
    ref_table   text CHECK (ref_table IS NULL OR ref_table IN ('reports', 'leaflet_submissions')),
    ref_id      uuid,
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS point_ledger_ref_uniq ON public.point_ledger (reason, ref_table, ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS point_ledger_user_idx ON public.point_ledger (user_id, created_at DESC);

ALTER TABLE public.point_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Member read own points" ON public.point_ledger;
CREATE POLICY "Member read own points" ON public.point_ledger
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
-- INSERT·UPDATE·DELETE 정책 없음: 회원·관리자 모두 표를 직접 고치지 못한다. 아래 SECURITY DEFINER 트리거만 넣고 뺀다
REVOKE ALL ON public.point_ledger FROM anon;

-- 제보 한 건의 100포인트를 넣거나 뺀다(한 건에 한 번)
CREATE OR REPLACE FUNCTION public.apply_tip_points(p_user uuid, p_table text, p_id uuid, p_is_done boolean, p_was_done boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_user IS NULL THEN RETURN; END IF;
    IF p_is_done AND NOT p_was_done THEN
        INSERT INTO public.point_ledger (user_id, amount, reason, ref_table, ref_id, created_by)
        VALUES (p_user, 100, 'tip', p_table, p_id, auth.uid())
        ON CONFLICT DO NOTHING;
    ELSIF p_was_done AND NOT p_is_done THEN
        DELETE FROM public.point_ledger WHERE reason = 'tip' AND ref_table = p_table AND ref_id = p_id;
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_tip_points(uuid, text, uuid, boolean, boolean) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tip_points_reports() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.kind = 'tip' THEN
        PERFORM public.apply_tip_points(NEW.user_id, 'reports', NEW.id, NEW.status = 'done', TG_OP = 'UPDATE' AND OLD.status = 'done');
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tip_points_reports ON public.reports;
CREATE TRIGGER tip_points_reports AFTER INSERT OR UPDATE OF status ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.tip_points_reports();

-- 카카오톡 채널 제보: 회원이 이어진 줄만(리플렛 web·운영자가 옮겨 올린 kakao_chat 은 제보 포인트 대상이 아니다)
CREATE OR REPLACE FUNCTION public.tip_points_leaflets() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.channel = 'kakao_bot' THEN
        PERFORM public.apply_tip_points(NEW.user_id, 'leaflet_submissions', NEW.id, NEW.status = 'published', TG_OP = 'UPDATE' AND OLD.status = 'published');
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tip_points_leaflets ON public.leaflet_submissions;
CREATE TRIGGER tip_points_leaflets AFTER INSERT OR UPDATE OF status ON public.leaflet_submissions
    FOR EACH ROW EXECUTE FUNCTION public.tip_points_leaflets();

-- 내 포인트: 합계, 순위(포인트가 있는 회원 가운데), 포인트가 있는 회원 수
CREATE OR REPLACE FUNCTION public.my_points() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH t AS (SELECT user_id, sum(amount) AS s FROM public.point_ledger GROUP BY user_id HAVING sum(amount) > 0),
         me AS (SELECT s FROM t WHERE user_id = auth.uid())
    SELECT jsonb_build_object(
        'points', coalesce((SELECT s FROM me), 0),
        'rank', CASE WHEN EXISTS (SELECT 1 FROM me) THEN (SELECT count(*) + 1 FROM t WHERE s > (SELECT s FROM me)) END,
        'ranked', (SELECT count(*) FROM t));
$$;
REVOKE ALL ON FUNCTION public.my_points() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_points() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_member_points() RETURNS TABLE (user_id uuid, points bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT l.user_id, sum(l.amount)::bigint FROM public.point_ledger l WHERE public.is_admin() GROUP BY l.user_id;
$$;
REVOKE ALL ON FUNCTION public.admin_member_points() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_member_points() TO authenticated;

-- 제보 접수: 로그인 회원만. 돌려주는 값: {id, photo_path}
-- 오류(P0001): login_required · bad_title · bad_url · need_source · bad_date · need_consent · daily_limit · duplicate
CREATE OR REPLACE FUNCTION public.submit_tip(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    uid       uuid := auth.uid();
    new_id    uuid := gen_random_uuid();
    v_title   text := left(btrim(coalesce(p->>'title', '')), 120);
    v_url     text := left(btrim(coalesce(p->>'url', '')), 500);
    v_photo   boolean := coalesce(p->>'has_photo', '') = 'true';
    v_start   text := btrim(coalesce(p->>'date_start', ''));
    v_end     text := btrim(coalesce(p->>'date_end', ''));
    v_venue   text := left(btrim(coalesce(p->>'venue', '')), 120);
    v_region  text := left(btrim(coalesce(p->>'region', '')), 20);
    v_body    text := left(btrim(coalesce(p->>'body', '')), 2000);
    v_contact text := left(btrim(coalesce(p->>'reward_contact', '')), 100);
    v_consent text := left(btrim(coalesce(p->>'reward_consent', '')), 40);
    v_credit  text := left(btrim(coalesce(p->>'credit_name', '')), 30);
    v_path    text;
BEGIN
    IF uid IS NULL THEN RAISE EXCEPTION 'login_required' USING ERRCODE = 'P0001'; END IF;
    -- 사람 눈에 안 보이는 칸이 차 있으면 자동 프로그램이다: 넣지 않고 성공처럼 답한다
    IF btrim(coalesce(p->>'website', '')) <> '' THEN
        RETURN jsonb_build_object('id', NULL, 'photo_path', NULL);
    END IF;
    IF char_length(v_title) < 2 THEN RAISE EXCEPTION 'bad_title' USING ERRCODE = 'P0001'; END IF;
    IF v_url <> '' AND v_url !~* '^https?://[^[:space:]]+\.[^[:space:]]+$' THEN RAISE EXCEPTION 'bad_url' USING ERRCODE = 'P0001'; END IF;
    IF v_url = '' AND NOT v_photo THEN RAISE EXCEPTION 'need_source' USING ERRCODE = 'P0001'; END IF;
    IF (v_start <> '' AND v_start !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$') OR (v_end <> '' AND v_end !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$')
       OR (v_start <> '' AND v_end <> '' AND v_end < v_start) THEN
        RAISE EXCEPTION 'bad_date' USING ERRCODE = 'P0001';
    END IF;
    IF v_contact <> '' AND (v_consent = '' OR char_length(v_contact) < 5) THEN RAISE EXCEPTION 'need_consent' USING ERRCODE = 'P0001'; END IF;

    IF (SELECT count(*) FROM public.reports WHERE user_id = uid AND created_at > now() - interval '1 day') >= 10 THEN
        RAISE EXCEPTION 'daily_limit' USING ERRCODE = 'P0001';
    END IF;
    IF v_url <> '' AND EXISTS (SELECT 1 FROM public.reports
                               WHERE kind = 'tip' AND lower(tip->>'title') = lower(v_title) AND lower(tip->>'url') = lower(v_url)
                                 AND created_at > now() - interval '1 day') THEN
        RAISE EXCEPTION 'duplicate' USING ERRCODE = 'P0001';
    END IF;

    v_path := CASE WHEN v_photo THEN 'tips/' || new_id::text || '.jpg' END;
    INSERT INTO public.reports (id, kind, user_id, body, tip, photo_path, credit_name, reward_contact, reward_consent)
    VALUES (
        new_id, 'tip', uid,
        CASE WHEN char_length(v_body) >= 2 THEN v_body ELSE '(설명 없음)' END,
        jsonb_strip_nulls(jsonb_build_object(
            'title', v_title,
            'url', nullif(v_url, ''),
            'photo', CASE WHEN v_photo THEN true END,
            'date_start', nullif(v_start, ''),
            'date_end', coalesce(nullif(v_end, ''), nullif(v_start, '')),
            'venue', nullif(v_venue, ''),
            'region', nullif(v_region, ''))),
        v_path, nullif(v_credit, ''),
        nullif(v_contact, ''), CASE WHEN v_contact <> '' THEN v_consent END);
    RETURN jsonb_build_object('id', new_id, 'photo_path', v_path);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_tip(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_tip(jsonb) TO authenticated;

-- 사진 올리기 허용 판정: 그 경로를 가리키는 내 제보가 10분 안에 만들어졌고 아직 검토 대기
CREATE OR REPLACE FUNCTION public.tip_upload_allowed(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.reports
        WHERE photo_path = p_name AND kind = 'tip' AND status = 'new' AND user_id = auth.uid()
          AND created_at > now() - interval '10 minutes'
    );
$$;
REVOKE ALL ON FUNCTION public.tip_upload_allowed(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tip_upload_allowed(text) TO authenticated;

DROP POLICY IF EXISTS "Tip upload pending photo" ON storage.objects;
CREATE POLICY "Tip upload pending photo" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'leaflets' AND (storage.foldername(name))[1] = 'tips' AND public.tip_upload_allowed(name));

CREATE OR REPLACE FUNCTION public.tip_photo_failed(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.reports r
    SET photo_path = NULL, admin_note = '사진 올리기 실패'
    WHERE r.id = p_id AND r.kind = 'tip' AND r.status = 'new' AND r.photo_path IS NOT NULL AND r.user_id = auth.uid()
      AND r.created_at > now() - interval '10 minutes'
      AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'leaflets' AND o.name = r.photo_path);
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.tip_photo_failed(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tip_photo_failed(uuid) TO authenticated;
