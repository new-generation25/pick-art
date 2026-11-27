    -- 운영 DB 되돌림 시험의 시험 부분(specs/022). make_dryrun.py 가 마이그레이션과 묶어 한 문장(DO 블록)으로 만든다.
    -- 끝의 RAISE EXCEPTION 이 결과를 내보내면서 이 문장이 한 일을 모두 되돌린다(남는 변경 없음).
    SELECT p.id INTO uid FROM public.profiles p WHERE coalesce(p.role, 'user') <> 'admin' ORDER BY p.created_at LIMIT 1;
    SELECT p.id INTO uid2 FROM public.profiles p WHERE p.id <> uid ORDER BY p.created_at LIMIT 1;
    mine := uid::text || '/11111111-2222-3333-4444-555555555555.jpg';
    theirs := uid2::text || '/11111111-2222-3333-4444-555555555555.jpg';

    -- t1 회원 기록의 사진 칸: 자기 경로만
    UPDATE public.profiles SET avatar_path = mine WHERE id = uid;
    r := r || jsonb_build_object('t1_own_path_saved', (SELECT avatar_path = mine FROM public.profiles WHERE id = uid));
    BEGIN UPDATE public.profiles SET avatar_path = theirs WHERE id = uid; r := r || '{"t1_other_path_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t1_other_path_blocked":true}'; END;
    BEGIN UPDATE public.profiles SET avatar_path = uid::text || '/x.png' WHERE id = uid; r := r || '{"t1_bad_format_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t1_bad_format_blocked":true}'; END;

    -- t2 저장소: 회원은 자기 폴더에만 넣고·읽고·지운다
    PERFORM set_config('request.jwt.claim.sub', uid::text, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('avatars', mine, uid); r := r || '{"t2_own_folder_insert":true}';
    EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('t2_own_folder_insert', false, 't2_err', left(SQLERRM, 80)); END;
    BEGIN INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('avatars', theirs, uid); r := r || '{"t2_other_folder_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t2_other_folder_blocked":true}'; END;
    r := r || jsonb_build_object('t2_own_rows_visible', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars'));
    RESET ROLE;

    -- t3 다른 회원: 내 파일 줄을 못 읽고 못 지운다
    PERFORM set_config('request.jwt.claim.sub', uid2::text, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := r || jsonb_build_object('t3_other_sees_rows', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars'));
    -- (지우기는 SQL 로 시험할 수 없다: Supabase 가 저장소 표의 직접 DELETE 를 막는다. 지우기 권한은 배포 뒤 저장소 API 로 확인한다)
    BEGIN UPDATE public.profiles SET avatar_path = NULL WHERE id = uid; GET DIAGNOSTICS n1 = ROW_COUNT; r := r || jsonb_build_object('t3_other_profile_update_rows', n1);
    EXCEPTION WHEN OTHERS THEN r := r || '{"t3_other_profile_update_rows":0}'; END;
    RESET ROLE;

    -- t4 익명: 넣기·읽기 불가
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
    BEGIN INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', mine || 'x'); r := r || '{"t4_anon_insert_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t4_anon_insert_blocked":true}'; END;
    BEGIN r := r || jsonb_build_object('t4_anon_sees_rows', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars'));
    EXCEPTION WHEN OTHERS THEN r := r || '{"t4_anon_sees_rows":0}'; END;
    RESET ROLE;

    -- t5 버킷 설정, 저장공간 함수에 반영
    r := r || jsonb_build_object(
        't5_bucket_private', (SELECT NOT public AND file_size_limit = 1048576 FROM storage.buckets WHERE id = 'avatars'),
        't5_storage_usage_defined', (SELECT prosrc LIKE '%public.profiles WHERE avatar_path IS NOT NULL%' FROM pg_proc WHERE proname = 'storage_usage' AND pronamespace = 'public'::regnamespace));
    RAISE EXCEPTION 'AVTEST %', r::text;
