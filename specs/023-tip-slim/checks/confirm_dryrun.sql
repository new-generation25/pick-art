-- 관리자 «협약 확인»이 하는 저장을 관리자 권한과 로그인 없는 권한으로 차례로 돌려 보고, 끝에 예외로 모두 되돌린다
DO $outer$
DECLARE r jsonb := '{}'; admin_id uuid; ag record; oid uuid; n int;
BEGIN
  SELECT u.id INTO admin_id FROM auth.users u JOIN public.profiles p ON p.id = u.id WHERE p.role = 'admin' ORDER BY u.last_sign_in_at DESC NULLS LAST LIMIT 1;
  SELECT * INTO ag FROM public.partner_agreements WHERE status = 'new' ORDER BY created_at DESC LIMIT 1;
  r := r || jsonb_build_object('agreement', ag.org_name);
  -- 1) 로그인 없는 요청
  BEGIN
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    EXECUTE 'SET LOCAL ROLE anon';
    INSERT INTO public.orgs (name, norm_name, kind, insta_handle) VALUES ('ZZ dry ' || ag.org_name, 'zzdry', '단체', NULL);
    EXECUTE 'RESET ROLE';
    r := r || jsonb_build_object('anon_insert_org', 'INSERTED (bad)');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    r := r || jsonb_build_object('anon_insert_org', SQLERRM);
  END;
  -- 2) 관리자 요청: 화면이 하는 순서 그대로
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    r := r || jsonb_build_object('is_admin', public.is_admin());
    INSERT INTO public.orgs (name, norm_name, kind, insta_handle) VALUES ('ZZ dry ' || ag.org_name, 'zzdry', '단체', NULL) RETURNING id INTO oid;
    r := r || jsonb_build_object('admin_insert_org', 'ok');
    UPDATE public.orgs SET partner_since = current_date WHERE id = oid;
    GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('admin_update_org_rows', n);
    INSERT INTO public.org_admin_notes (org_id, note, updated_at) VALUES (oid, 'dry', now())
      ON CONFLICT (org_id) DO UPDATE SET note = EXCLUDED.note, updated_at = EXCLUDED.updated_at;
    r := r || jsonb_build_object('admin_org_note', 'ok');
    UPDATE public.partner_agreements SET status = 'confirmed', org_id = oid, handled_at = now() WHERE id = ag.id;
    GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('admin_update_agreement_rows', n);
    UPDATE public.whitelist SET consent = 'standing', consent_at = current_date, consent_evidence = 'dry'
      WHERE type = 'instagram' AND value ILIKE '%instagram.com/' || coalesce(ag.insta_handle, 'zz-none') || '%';
    GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('admin_update_whitelist_rows', n);
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    r := r || jsonb_build_object('admin_error', SQLERRM);
  END;
  RAISE EXCEPTION 'DRYCONFIRM %', r::text;
END $outer$;
