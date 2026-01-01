-- 종합 테스트 데이터 주입

-- 1. 정보출처 (Source Management)
INSERT INTO public.whitelist (type, value, name, auto_publish) VALUES 
('source', 'gcf.or.kr', '경남문화예술진흥원', true),
('source', 'knjic.or.kr', '경남문화예술정보', true),
('user', '@gn_culture', '경남문화 공식 인스타', true),
('source', 'art.gyeongnam.go.kr', '경남도립미술관', true)
ON CONFLICT (value) DO NOTHING;

INSERT INTO public.blacklist (type, value, name, reason) VALUES 
('user', '@ad_bot_99', '광고성 계정', 'Spamming ads'),
('source', 'fake-news-art.com', '허위 정보 사이트', 'Fake events')
ON CONFLICT (value) DO NOTHING;

-- 2. 뉴스레터 구독자
INSERT INTO public.subscribers (email, is_active) VALUES 
('kim@daum.net', true),
('lee@naver.com', true),
('park@gmail.com', true),
('admin@artnav.kr', true)
ON CONFLICT (email) DO NOTHING;

-- 3. 관심 키워드
INSERT INTO public.keywords (email, keyword) VALUES 
('kim@daum.net', '창원'),
('kim@daum.net', '오케스트라'),
('lee@naver.com', '전시회'),
('park@gmail.com', '무료강연')
ON CONFLICT (email, keyword) DO NOTHING;

-- 4. 수집 원본 (Inbox용)
INSERT INTO public.raw_posts (source, source_id, source_url, content, status) VALUES 
('gcf.or.kr', 'p_001', 'https://gcf.or.kr/notice/1', '{"title": "[검토필요] 제1회 경남 청년 작가 초대전", "body": "창원 가로수길에서 펼쳐지는 청년 작가들의 열정..."}', 'PENDING'),
('knjic.or.kr', 'p_002', 'https://knjic.or.kr/event/205', '{"title": "진주 남강 유등 축제 자원봉사자 모집", "body": "축제를 빛내줄 소중한 분들을 모십니다."}', 'COLLECTED')
ON CONFLICT (source, source_id) DO NOTHING;

-- 5. 발행된 행사 (Main/Details용)
INSERT INTO public.events (title, description, category, region, venue, event_date_start, price_info, poster_image_url, source, original_url, status) VALUES 
('2024 경남 K-필하모닉 정기연주회', '경남을 대표하는 오케스트라의 웅장한 선율을 감상하세요.', '공연', '창원', '성산아트홀', '2024-12-25', 'R석 5만원 / S석 3만원', 'https://images.unsplash.com/photo-1541190990694-4a6125323e2b?q=80&w=600', 'gcf.or.kr', 'https://gcf.or.kr/1', 'PUBLISHED'),
('이건희 컬렉션: 한국 근현대 미술 특별전', '국립현대미술관 소장 이건희 컬렉션이 경남을 찾아옵니다.', '전시', '창원', '경남도립미술관', '2024-11-01', '무료', 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?q=80&w=600', 'art.gyeongnam.go.kr', 'https://art.gyeongnam.go.kr/1', 'PUBLISHED'),
('김해 가야 문화 축제', '가야의 숨결을 느낄 수 있는 경남 최대의 역사 체험 축제', '축제', '김해', '수릉원 일대', '2024-10-15', '무료 체험 위주', 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=600', 'knjic.or.kr', 'https://knjic.or.kr/1', 'PUBLISHED'),
('청년 예술가와 함께하는 토크 콘서트', '지역에서 활동하는 청년 작가들의 진솔한 이야기', '강연', '진주', '경상국립대 7홀', '2024-12-01', '사전 예약 시 무료', 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=600', 'manual', 'https://artnav.kr/manual/1', 'PUBLISHED');
