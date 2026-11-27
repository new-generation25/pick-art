    -- 아래는 운영 DB 되돌림 시험의 시험 부분이다. make_dryrun.py 가 마이그레이션과 묶어 한 문장(DO 블록)으로 만든다.
    -- 끝의 RAISE EXCEPTION 이 결과를 내보내면서 이 문장이 한 일을 모두 되돌린다(남는 변경 없음).
    SELECT id INTO uid FROM auth.users ORDER BY created_at LIMIT 1;
    SELECT u.id INTO uid2 FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id <> uid AND coalesce(p.role, 'user') <> 'admin' ORDER BY u.created_at LIMIT 1;  -- 관리자가 아닌 다른 회원
    SELECT id INTO anon_row FROM public.reports WHERE kind = 'tip' AND user_id IS NULL AND status <> 'done' LIMIT 1;
    n0 := (SELECT count(*) FROM public.point_ledger);

    -- t1 로그인 없이 접수 → 거절
    BEGIN PERFORM public.submit_tip('{"title":"[시험] 익명","url":"https://example.com/pt/1"}'::jsonb); r := r || '{"t1_anon_rejected":false}';
    EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('t1_anon_rejected', SQLERRM = 'login_required'); END;
    SET LOCAL ROLE anon;
    BEGIN PERFORM public.submit_tip('{"title":"[시험] 익명 역할","url":"https://example.com/pt/1b"}'::jsonb); r := r || '{"t1_anon_role_no_execute":false}';
    EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('t1_anon_role_no_execute', SQLSTATE = '42501'); END;
    BEGIN PERFORM count(*) FROM public.point_ledger; r := r || '{"t1_anon_ledger_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t1_anon_ledger_blocked":true}'; END;
    RESET ROLE;

    -- t2 회원 접수(사진 포함), 직접 적립 시도는 막힘
    PERFORM set_config('request.jwt.claim.sub', uid::text, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    j := public.submit_tip('{"title":"[시험] 포인트 제보","has_photo":"true","url":"https://example.com/pt/2"}'::jsonb);
    pid := (j->>'id')::uuid;
    r := r || jsonb_build_object('t2_member_tip', EXISTS (SELECT 1 FROM public.reports WHERE id = pid AND user_id = uid AND status = 'new'),
                                 't2_upload_allowed_owner', public.tip_upload_allowed(j->>'photo_path'),
                                 't2_points_before', public.my_points());
    BEGIN INSERT INTO public.point_ledger (user_id, amount, reason) VALUES (uid, 100000, 'tip'); r := r || '{"t2_member_direct_insert_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t2_member_direct_insert_blocked":true}'; END;
    RESET ROLE;

    -- t3 반영함 → +100, 다시 저장해도 한 번, 되돌리면 빠짐
    UPDATE public.reports SET status = 'done', handled_at = now() WHERE id = pid;
    r := r || jsonb_build_object('t3_credit_on_done', (SELECT count(*) = 1 AND sum(amount) = 100 FROM public.point_ledger WHERE ref_table = 'reports' AND ref_id = pid AND user_id = uid));
    UPDATE public.reports SET status = 'done', admin_note = '다시 저장' WHERE id = pid;
    r := r || jsonb_build_object('t3_no_double', (SELECT count(*) FROM public.point_ledger WHERE ref_id = pid) = 1);
    UPDATE public.reports SET status = 'rejected' WHERE id = pid;
    r := r || jsonb_build_object('t3_revoked_on_reject', (SELECT count(*) FROM public.point_ledger WHERE ref_id = pid) = 0);
    UPDATE public.reports SET status = 'new' WHERE id = pid;
    UPDATE public.reports SET status = 'done' WHERE id = pid;
    r := r || jsonb_build_object('t3_credit_again_once', (SELECT count(*) FROM public.point_ledger WHERE ref_id = pid) = 1);

    -- t4 내 포인트·순위, 내 내역만 읽힘
    SET LOCAL ROLE authenticated;
    r := r || jsonb_build_object('t4_my_points', public.my_points(),
                                 't4_my_ledger_rows', (SELECT count(*) FROM public.point_ledger),
                                 't4_admin_fn_rows', (SELECT count(*) FROM public.admin_member_points()),
                                 't4_is_admin', public.is_admin());
    RESET ROLE;
    IF uid2 IS NOT NULL THEN
        PERFORM set_config('request.jwt.claim.sub', uid2::text, true);
        PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid2, 'role', 'authenticated')::text, true);
        SET LOCAL ROLE authenticated;
        r := r || jsonb_build_object('t4_other_is_admin', public.is_admin(),
                                     't4_other_sees_rows', (SELECT count(*) FROM public.point_ledger WHERE user_id = uid),
                                     't4_other_upload_blocked', NOT public.tip_upload_allowed(j->>'photo_path'),
                                     't4_other_admin_fn_rows', (SELECT count(*) FROM public.admin_member_points()),
                                     't4_other_my_points', public.my_points());
        RESET ROLE;
    END IF;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- t5 로그인 없이 온 예전 제보를 반영함으로 닫아도 포인트 없음
    IF anon_row IS NOT NULL THEN
        n1 := (SELECT count(*) FROM public.point_ledger);
        UPDATE public.reports SET status = 'done' WHERE id = anon_row;
        r := r || jsonb_build_object('t5_anon_row_no_points', (SELECT count(*) FROM public.point_ledger) = n1);
    END IF;

    -- t6 카카오 제보: 회원이 이어진 줄이 published 가 되면 +100 (지금 제약은 kakao_bot 에 회원을 못 넣게 하므로 시험 안에서만 푼다)
    ALTER TABLE public.leaflet_submissions DROP CONSTRAINT IF EXISTS leaflet_submissions_sender_check;
    INSERT INTO public.leaflet_submissions (user_id, channel, image_kind, rights_version, note, status)
    VALUES (uid, 'kakao_bot', 'photo', 'test', '[시험] 카카오 제보', 'read') RETURNING id INTO lid;
    r := r || jsonb_build_object('t6_kakao_none_before', (SELECT count(*) FROM public.point_ledger WHERE ref_id = lid) = 0);
    UPDATE public.leaflet_submissions SET status = 'published' WHERE id = lid;
    r := r || jsonb_build_object('t6_kakao_credit', (SELECT count(*) = 1 AND sum(amount) = 100 FROM public.point_ledger WHERE ref_table = 'leaflet_submissions' AND ref_id = lid AND user_id = uid));
    INSERT INTO public.leaflet_submissions (user_id, channel, image_kind, rights_version, note, status, image_path)
    VALUES (uid, 'web', 'file', 'test', '[시험] 리플렛', 'read', uid::text || '/x.jpg') RETURNING id INTO lid2;
    UPDATE public.leaflet_submissions SET status = 'published' WHERE id = lid2;
    r := r || jsonb_build_object('t6_web_leaflet_no_points', (SELECT count(*) FROM public.point_ledger WHERE ref_id = lid2) = 0);

    r := r || jsonb_build_object('ledger_before', n0, 'ledger_in_test', (SELECT count(*) FROM public.point_ledger) - n0);
    RAISE EXCEPTION 'PTTEST %', r::text;
