-- 장소의 구·군 (specs/010-region-pages, 운영자 11/26 「부산 구 단위 페이지도 진행해」)
--   venues.district : 부산 16개 구·군 이름(예: 「해운대구」). 장소 주소에서 가른다. 모르면 NULL
--   public_venues 뷰 끝에 district 를 더한다(끝에만 더하므로 CREATE OR REPLACE 로 된다). 읽기 전용 권한은 다시 건다
-- 되돌리기: 뷰를 예전 일곱 칸(id,name,region,lat,lng,closed_days,capacity)으로 다시 만들고 ALTER TABLE public.venues DROP COLUMN district;

ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS district text
    CHECK (district IS NULL OR district IN (
        '중구','서구','동구','영도구','부산진구','동래구','남구','북구',
        '해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'));

CREATE OR REPLACE VIEW public.public_venues AS
    SELECT id, name, region, lat, lng, closed_days, capacity, district
    FROM public.venues
    WHERE geo_status = 'confirmed';

REVOKE ALL ON public.public_venues FROM public, anon, authenticated;
GRANT SELECT ON public.public_venues TO anon, authenticated;

COMMENT ON VIEW public.public_venues IS '공개 화면용: 좌표가 확인된 장소만 (id, name, region, lat, lng, closed_days, capacity, district)';
