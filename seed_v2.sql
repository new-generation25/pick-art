-- 다양한 지역과 분야의 행사 데이터 20개 및 구독자 10명 추가

-- 구독자 데이터
INSERT INTO public.subscribers (email, is_active) VALUES 
('user1@test.com', true), ('user2@test.com', true), ('user3@test.com', true), ('user4@test.com', false), ('user5@test.com', true),
('fan_art@apple.com', true), ('gimhae_mom@naver.com', true), ('jinju_boy@gmail.com', true), ('culture_lover@daum.net', true), ('admin_sub@artnav.kr', true)
ON CONFLICT (email) DO NOTHING;

-- 다양한 행사 데이터
INSERT INTO public.events (title, description, category, region, venue, event_date_start, event_date_end, price_info, poster_image_url, source, original_url, status) VALUES 
-- 창원 (5개)
('2024 창원 국제 사격 선수권 대회 기념 문화제', '세계 사격 선수들과 함께하는 문화 교류의 장', '축제', '창원', '창원국제사격장', '2024-05-01', '2024-05-07', '무료', 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3', 'manual', 'http://mock1.com', 'PUBLISHED'),
('창원 시립 교향악단 정기연주회', '봄의 왈츠를 주제로 한 클래식 공연', '공연', '창원', '성산아트홀 대검장', '2024-04-10', '2024-04-10', 'VIP 5만원', 'https://images.unsplash.com/photo-1541190990694-4a6125323e2b', 'gcf.or.kr', 'http://mock2.com', 'PUBLISHED'),
('가로수길 커피 축제', '창원 용호동 가로수길에서 펼쳐지는 향긋한 축제', '축제', '창원', '용호동 가로수길', '2024-10-05', '2024-10-06', '무료', 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf', 'manual', 'http://mock3.com', 'PUBLISHED'),
('경남 웹툰 페스티벌', '유명 웹툰 작가 사인회 및 전시', '전시', '창원', '경남웹툰캠퍼스', '2024-11-20', '2024-11-22', '무료', 'https://images.unsplash.com/photo-1612538498456-e861df91d4d0', 'manual', 'http://mock4.com', 'PUBLISHED'),
('로봇랜드 불꽃축제', '밤하늘을 수놓는 환상의 불꽃쇼', '행사', '창원', '로봇랜드', '2024-12-24', '2024-12-25', '입장료 별도', 'https://images.unsplash.com/photo-1496337589254-7e19d01cec44', 'manual', 'http://mock5.com', 'PUBLISHED'),

-- 김해 (4개)
('김해 가야금 축제', '천년의 소리 가야금을 만나다', '축제', '김해', '김해문화의전당', '2024-09-01', '2024-09-05', '무료', 'https://images.unsplash.com/photo-1514525253440-b393452e8d26', 'knjic.or.kr', 'http://mock6.com', 'PUBLISHED'),
('클레이아크 도자 체험전', '나만의 도자기를 만드는 특별한 시간', '전시', '김해', '클레이아크 미술관', '2024-03-01', '2024-06-30', '체험비 1만원', 'https://images.unsplash.com/photo-1561214115-f2f134cc4912', 'manual', 'http://mock7.com', 'PUBLISHED'),
('김해 천문대 별보기 행사', '도심 속에서 즐기는 별자리 여행', '행사', '김해', '김해천문대', '2024-08-10', '2024-08-12', '성인 5천원', 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3', 'manual', 'http://mock8.com', 'PUBLISHED'),
('수로왕릉 춘향대제', '가락국 시조 수로왕을 기리는 제례', '행사', '김해', '수로왕릉', '2024-04-20', '2024-04-20', '무료', 'https://images.unsplash.com/photo-1599305090598-fe179d501227', 'manual', 'http://mock9.com', 'PUBLISHED'),

-- 진주 (4개)
('진주 남강 유등축제', '물과 불과 빛의 향연', '축제', '진주', '남강 일원', '2024-10-01', '2024-10-15', '무료 (부교 이용료 별도)', 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3', 'manual', 'http://mock10.com', 'PUBLISHED'),
('경남 문화예술회관 기획 전시', '지역  작가 초대전', '전시', '진주', '경남문화예술회관', '2024-07-01', '2024-07-20', '무료', 'https://images.unsplash.com/photo-1545989253-02cc26577f88', 'manual', 'http://mock11.com', 'PUBLISHED'),
('진주성 수문장 교대식', '조선시대 수문장 교대 의식 재현', '행사', '진주', '진주성', '2024-03-01', '2024-11-30', '진주성 입장료', 'https://images.unsplash.com/photo-1583244532610-2a234e7c3eca', 'manual', 'http://mock12.com', 'PUBLISHED'),
('진주 오광대 탈춤 공연', '신명나는 우리 가락과 춤', '공연', '진주', '전통예술회관', '2024-05-05', '2024-05-05', '무료', 'https://images.unsplash.com/photo-1514525253440-b393452e8d26', 'manual', 'http://mock13.com', 'PUBLISHED'),

-- 통영 (3개)
('통영 국제 음악제', '아시아를 대표하는 현대 음악 축제', '축제', '통영', '통영국제음악당', '2024-03-29', '2024-04-07', '공연별 상이', 'https://images.unsplash.com/photo-1511192336575-5a79af67a629', 'manual', 'http://mock14.com', 'PUBLISHED'),
('동피랑 벽화마을 골목 축제', '벽화와 함께하는 소소한 골목 축제', '축제', '통영', '동피랑 마을', '2024-05-20', '2024-05-21', '무료', 'https://images.unsplash.com/photo-1561214115-f2f134cc4912', 'manual', 'http://mock15.com', 'PUBLISHED'),
('한산대첩 축제', '이순신 장군의 한산대첩을 기념하다', '축제', '통영', '강구안문화마당', '2024-08-11', '2024-08-15', '무료', 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3', 'manual', 'http://mock16.com', 'PUBLISHED'),

-- 기타 지역 (4개)
('거제 바다로 세계로', '여름 바다를 즐기는 최고의 축제', '축제', '거제', '구조라 해수욕장', '2024-07-28', '2024-07-30', '무료', 'https://images.unsplash.com/photo-1496337589254-7e19d01cec44', 'manual', 'http://mock17.com', 'PUBLISHED'),
('밀양 아리랑 대축제', '아리랑의 유네스코 등재 기념', '축제', '밀양', '영남루 일원', '2024-05-16', '2024-05-19', '무료', 'https://images.unsplash.com/photo-1545989253-02cc26577f88', 'manual', 'http://mock18.com', 'PUBLISHED'),
('남해 독일마을 맥주축제', '한국에서 즐기는 옥토버페스트', '축제', '남해', '독일마을', '2024-10-02', '2024-10-04', '입장료 무료', 'https://images.unsplash.com/photo-1514525253440-b393452e8d26', 'manual', 'http://mock19.com', 'PUBLISHED'),
('하동 야생차 문화축제', '천년의 향, 하동 녹차를 만나다', '축제', '하동', '야생차 박물관', '2024-05-04', '2024-05-06', '무료', 'https://images.unsplash.com/photo-1541190990694-4a6125323e2b', 'manual', 'http://mock20.com', 'PUBLISHED');
