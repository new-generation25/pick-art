-- 기존 데이터 충돌 방지 및 대규모 데이터 주입 (source_id 추가 버전)

-- 1. 아직 검토 대기중인 데이터 (Inbox에 뜰 것들) - 20개
INSERT INTO public.raw_posts (source, source_id, source_url, content, collected_at, status) VALUES
('instagram', 'insta_1', 'https://instgarm.com/gimhae_art/1', '{"title": "[김해] 클레이아크 기획전", "body": "흙과 불이 만나는 예술의 세계로 초대합니다. 아이들과 함께 오세요!", "username": "gimhae_art"}', NOW() - INTERVAL '1 hour', 'PENDING'),
('busan_cultural_foundation', 'bcf_101', 'https://bscf.or.kr/notice/101', '{"title": "부산-경남 교류 음악회", "body": "부산과 경남의 예술가들이 함께하는 하모니. 무료 입장입니다."}', NOW() - INTERVAL '2 hour', 'PENDING'),
('instagram', 'insta_33', 'https://instgarm.com/changwon_indie/33', '{"title": "창원 인디밴드 페스타", "body": "이번 주말, 상남동 분수광장에서 펼쳐지는 인디 음악의 향연!", "username": "indi_cw"}', NOW() - INTERVAL '3 hour', 'PENDING'),
('gyeongnam_art', 'gn_55', 'https://gnart.or.kr/event/55', '{"title": "경남 청년 작가 100인전", "body": "지역의 신진 작가들을 응원해주세요. 도립미술관 제1전시실."}', NOW() - INTERVAL '4 hour', 'PENDING'),
('instagram', 'insta_12', 'https://instgarm.com/tongyoung_sea/12', '{"title": "통영 밤바다 야경 투어", "body": "해설사와 함께 걷는 통영의 밤. 사전 예약 필수.", "username": "ty_night"}', NOW() - INTERVAL '5 hour', 'PENDING'),
('jinju_castle', 'jj_1', 'https://jinju.go.kr/castle/news/1', '{"title": "진주성 달빛 기행", "body": "보름달이 뜨는 밤, 진주성의 숨겨진 이야기를 들려드립니다."}', NOW() - INTERVAL '6 hour', 'PENDING'),
('instagram', 'insta_88', 'https://instgarm.com/geoje_wind/88', '{"title": "거제 바람의 언덕 버스킹", "body": "바람과 음악이 있는 낭만적인 오후.", "username": "wind_hill"}', NOW() - INTERVAL '7 hour', 'PENDING'),
('changwon_si', 'cw_99', 'https://changwon.go.kr/culture/99', '{"title": "창원 조각 비엔날레 미리보기", "body": "올해 비엔날레의 주요 작품을 산책로에서 미리 만나보세요."}', NOW() - INTERVAL '8 hour', 'PENDING'),
('instagram', 'insta_5', 'https://instgarm.com/miryang_arirang/5', '{"title": "밀양 아리랑 전수 교실", "body": "누구나 쉽게 배우는 우리 가락. 무료 강습.", "username": "arirang_master"}', NOW() - INTERVAL '9 hour', 'PENDING'),
('hadong_tea', 'hd_22', 'https://hadong.go.kr/tea/22', '{"title": "하동 야생차 다도 체험", "body": "천년의 차향을 느끼며 마음을 다스리는 시간."}', NOW() - INTERVAL '10 hour', 'PENDING'),
('instagram', 'insta_dance_1', 'https://instgarm.com/gimhae_dance/1', '{"title": "김해 스트릿 댄스 배틀", "body": "젊음의 열기! 댄스 경연 대회 참가자 모집.", "username": "dance_crew"}', NOW() - INTERVAL '11 hour', 'PENDING'),
('instagram', 'insta_air_2', 'https://instgarm.com/sacheon_air/2', '{"title": "사천 에어쇼 기념 사진전", "body": "창공을 가르는 멋진 순간들을 사진으로 담았습니다.", "username": "sc_air"}', NOW() - INTERVAL '12 hour', 'PENDING'),
('instagram', 'insta_temple_3', 'https://instgarm.com/yangsan_temple/3', '{"title": "통도사 템플스테이", "body": "산사에서의 하룻밤, 나를 찾아떠나는 여행.", "username": "tongdosa"}', NOW() - INTERVAL '13 hour', 'PENDING'),
('instagram', 'insta_lotus_4', 'https://instgarm.com/hamann_lotus/4', '{"title": "함안 연꽃 테마파크 야간 개장", "body": "연꽃 향기 가득한 여름 밤의 산책.", "username": "haman_gun"}', NOW() - INTERVAL '14 hour', 'PENDING'),
('instagram', 'insta_german_5', 'https://instgarm.com/namhae_german/5', '{"title": "독일마을 소시지 만들기", "body": "정통 독일 소시지를 직접 만들어 보세요.", "username": "german_vil"}', NOW() - INTERVAL '15 hour', 'PENDING'),
('instagram', 'insta_bridge_6', 'https://instgarm.com/uieryoung_bridge/6', '{"title": "의령 구름다리 걷기 대회", "body": "아찔한 구름다리 위에서 즐기는 가을 풍경.", "username": "uieryoung"}', NOW() - INTERVAL '16 hour', 'PENDING'),
('instagram', 'insta_dino_7', 'https://instgarm.com/goseong_dino/7', '{"title": "고성 공룡 엑스포 티켓 할인", "body": "얼리버드 티켓 오픈! 최대 50% 할인 혜택.", "username": "dino_world"}', NOW() - INTERVAL '17 hour', 'PENDING'),
('instagram', 'insta_upo_8', 'https://instgarm.com/changnyeong_u/8', '{"title": "우포늪 생태 탐방", "body": "살아있는 자연사 박물관 우포늪으로 오세요.", "username": "upo_wetland"}', NOW() - INTERVAL '18 hour', 'PENDING'),
('instagram', 'insta_movie_9', 'https://instgarm.com/hapcheon_movie/9', '{"title": "합천 영상테마파크 공포 체험", "body": "더위를 날려버릴 오싹한 공포 체험.", "username": "movie_town"}', NOW() - INTERVAL '19 hour', 'PENDING'),
('instagram', 'insta_medi_10', 'https://instgarm.com/sancheong_medi/10', '{"title": "산청 한방 약초 축제", "body": "건강과 힐링을 위한 최고의 선택.", "username": "medi_fest"}', NOW() - INTERVAL '20 hour', 'PENDING')
ON CONFLICT (source, source_id) DO NOTHING;


-- 2. 이미 발행된 데이터 (Events 테이블과 Raw_posts 테이블 동기화) - 30개

DO $$
DECLARE
    i INT;
    new_raw_id UUID;
    titles TEXT[] := ARRAY[
        '제15회 창원 가고파 국화축제', '2024 진주 남강 유등축제', '통영 한산대첩 축제', '김해 가야 문화 축제', 
        '밀양 아리랑 대축제', '거제 바다로 세계로', '남해 독일마을 맥주축제', '하동 야생차 문화축제', 
        '산청 한방 약초 축제', '함안 아라문화제', '창녕 낙동강 유채 축제', '고성 공룡 세계 엑스포',
        '사천 와룡 문화제', '양산 삽량 문화축전', '의령 의병 제전', '함양 산삼 축제',
        '거창 한마당 대축제', '합천 대야 문화제', '경남 고성 둠벙 축제', '마산 어시장 축제',
        '진해 군항제', '통영 국제 음악제', '김해 분청 도자기 축제', '창원 K-POP 월드 페스티벌',
        '진주 개천예술제', '사천 에어쇼', '남해 마늘 한우 축제', '하동 섬진강 재첩 축제',
        '거제 대구 수산물 축제', '양산 원동 매화 축제'
    ];
    regions TEXT[] := ARRAY['창원', '진주', '통영', '김해', '밀양', '거제', '남해', '하동', '산청', '함안', '창녕', '고성', '사천', '양산', '의령', '함양', '거창', '합천', '고성', '창원', '창원', '통영', '김해', '창원', '진주', '사천', '남해', '하동', '거제', '양산'];
    categories TEXT[] := ARRAY['축제', '축제', '축제', '행사', '공연', '축제', '축제', '체험', '축제', '행사', '축제', '전시', '행사', '축제', '행사', '축제', '축제', '행사', '체험', '축제', '축제', '공연', '전시', '공연', '공연', '전시', '축제', '체험', '축제', '축제'];
BEGIN
    FOR i IN 1..30 LOOP
        -- 2-1. Raw Post 생성 (PUBLISHED 상태)
        INSERT INTO public.raw_posts (source, source_id, source_url, content, collected_at, status)
        VALUES (
            'manual_upload', 
            'manual_event_' || i,
            'http://artnav.kr/event/' || i, 
            json_build_object('title', titles[i], 'body', titles[i] || '에 여러분을 초대합니다. 즐거운 시간 되세요!'), 
            NOW() - (i || ' days')::INTERVAL, 
            'PUBLISHED'
        ) 
        ON CONFLICT (source, source_id) DO NOTHING
        RETURNING id INTO new_raw_id;

        -- 이미 존재해서 new_raw_id가 null일 경우를 대비해 조회
        IF new_raw_id IS NULL THEN
            SELECT id INTO new_raw_id FROM public.raw_posts WHERE source = 'manual_upload' AND source_id = 'manual_event_' || i;
        END IF;

        -- 2-2. Event 생성 (위의 Raw Post와 연결)
        -- 이벤트도 중복 방지를 위해 source_original_url 조건 등을 체크하거나, 그냥 INSERT (데모라 허용)
        INSERT INTO public.events (
            title, description, category, region, venue, 
            event_date_start, event_date_end, 
            poster_image_url, source, original_url, 
            status, raw_post_id, published_at
        ) VALUES (
            titles[i], 
            titles[i] || ' - 경남의 아름다운 문화 축제에 초대합니다. 가족, 연인, 친구와 함께 즐거운 추억을 만드세요.',
            categories[i],
            regions[i],
            regions[i] || ' 일원',
            (CURRENT_DATE + (i || ' days')::INTERVAL), 
            (CURRENT_DATE + (i + 5 || ' days')::INTERVAL),
            'https://picsum.photos/seed/' || i || '/400/600', 
            'manual',
            'http://artnav.kr/event/' || i,
            'PUBLISHED',
            new_raw_id,
            NOW()
        );
    END LOOP;
END $$;
