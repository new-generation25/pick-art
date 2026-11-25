-- 피카가 본 이유 · 장소 정보 (specs/009-pica-note-venue-info)
--   events.pica_note     : 상세 위쪽 「피카가 본 이유」 한 줄(120자). 관리자가 쓴다. 비면 보이지 않는다
--   venues.closed_days   : 휴관일 원문(예: 「매주 월요일, 1월 1일」). 전시 상세에 보인다. 공식 안내로 확인한 것만
--   venues.capacity      : 객석 수(공연장 수용 인원). 공연 상세에 보인다. 공식 안내로 확인한 것만
--   public_venues 뷰에 두 칸을 더한다(끝에만 더하므로 CREATE OR REPLACE 로 된다). 읽기 전용 권한은 다시 건다
-- 되돌리기: 뷰를 예전 다섯 칸으로 다시 만들고 ALTER TABLE … DROP COLUMN 세 줄

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS pica_note text
    CHECK (pica_note IS NULL OR char_length(pica_note) <= 120);

ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS closed_days text
    CHECK (closed_days IS NULL OR char_length(closed_days) <= 80);
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS capacity integer
    CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 100000);

CREATE OR REPLACE VIEW public.public_venues AS
    SELECT id, name, region, lat, lng, closed_days, capacity
    FROM public.venues
    WHERE geo_status = 'confirmed';

REVOKE ALL ON public.public_venues FROM public, anon, authenticated;
GRANT SELECT ON public.public_venues TO anon, authenticated;

COMMENT ON VIEW public.public_venues IS '공개 화면용: 좌표가 확인된 장소만 (id, name, region, lat, lng, closed_days, capacity)';
