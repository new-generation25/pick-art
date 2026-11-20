-- 내 주변 행사 (specs/002-nearby-events): 장소 좌표
--   venues        : 건물 단위 장소와 좌표. 쓰기·전체 읽기는 관리자(와 서비스 키 수집기)만
--   public_venues : 공개 화면용. 좌표가 확인된(confirmed) 장소의 이름·시군·좌표만 내보낸다
--   events.venue_id : 행사 → 장소 연결(비어 있으면 「거리 확인 안 됨」)

CREATE TABLE IF NOT EXISTS public.venues (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    aliases     text[] NOT NULL DEFAULT '{}',
    region      text,
    address     text,
    lat         double precision,
    lng         double precision,
    geo_status  text NOT NULL DEFAULT 'pending' CHECK (geo_status IN ('pending', 'confirmed', 'failed')),
    geo_source  text CHECK (geo_source IN ('kopis', 'naver', 'manual')),
    candidates  jsonb,
    checked_by  text,
    checked_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT venues_name_region_key UNIQUE (name, region),
    CONSTRAINT venues_confirmed_has_coords CHECK (geo_status <> 'confirmed' OR (lat IS NOT NULL AND lng IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS venues_geo_status_idx ON public.venues (geo_status);
CREATE INDEX IF NOT EXISTS venues_aliases_idx ON public.venues USING gin (aliases);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS events_venue_id_idx ON public.events (venue_id);

-- RLS: venues 표 자체는 관리자만(후보·확인자 이메일이 들어 있다)
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin only" ON public.venues;
CREATE POLICY "Admin only" ON public.venues
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.venues FROM anon;

-- 공개용 뷰: 소유자 권한으로 읽되(RLS 우회) 확인된 좌표와 공개해도 되는 칸만
CREATE OR REPLACE VIEW public.public_venues AS
    SELECT id, name, region, lat, lng
    FROM public.venues
    WHERE geo_status = 'confirmed';

REVOKE ALL ON public.public_venues FROM public;
GRANT SELECT ON public.public_venues TO anon, authenticated;

COMMENT ON TABLE public.venues IS '내 주변 행사: 건물 단위 장소와 좌표 (specs/002-nearby-events)';
COMMENT ON VIEW public.public_venues IS '공개 화면용: 좌표가 확인된 장소만 (id, name, region, lat, lng)';
