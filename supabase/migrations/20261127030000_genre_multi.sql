-- specs/015 보완: 전시 세부에 «여러 갈래» 추가 (문화정보 수집 세션 요청, 사용자 «전시판정 제안대로» 2026-11-26)
--   미술대전 입상작전·협회/지부/회원전·정기전·졸업전·문화학교 작품전·단체/그룹전·소장품전·아트페어처럼 여러 매체가 섞인 전시
-- 되돌리기: 아래 CHECK 를 20261127020000_genre.sql 의 목록(여러 갈래 없음)으로 다시 만든다(먼저 «여러 갈래» 행을 NULL 로)
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_subcategory_valid;
ALTER TABLE public.events ADD CONSTRAINT events_subcategory_valid CHECK (
    subcategory IS NULL OR
    (category = '공연' AND subcategory IN ('연극','뮤지컬','클래식·오페라','국악·전통연희','대중음악','무용','서커스·마술','복합·기타')) OR
    (category = '전시' AND subcategory IN ('회화·드로잉','사진','조각·설치','미디어','공예','디자인·건축','서예','역사·박물관','여러 갈래','기타')) OR
    (category = '축제' AND subcategory IN ('문화예술축제','지역축제')) OR
    (category = '행사' AND subcategory IN ('강연·북토크','상영회','마켓','기타')) OR
    (category = '체험' AND subcategory IN ('체험·워크숍','교육·강좌'))
);
