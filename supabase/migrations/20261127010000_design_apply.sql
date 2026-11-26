-- specs/014 확정 디자인 적용: 안내 그림(포스터 자리의 «준비 중» 그림) 가려내기 + 공간·단체 협약 표시
--   placeholder_images       : 운영자가 «안내 그림»으로 표시한 그림의 지문(SHA-256). 관리자만 읽고 쓴다
--   events.poster_sha256     : 포스터 파일 지문(수집기·채움 도구가 적는다)
--   events.poster_placeholder: 지문이 placeholder_images 에 있으면 true. 트리거가 맞춘다. 공개 화면은 이것만 읽는다
--   orgs/venues.partner_since: 협약 맺은 날(NULL = 협약 아님). partner_note: 메모·해지 기록
--   public_venues            : 맨 끝에 partner_since 를 더한다
--
-- 되돌리기:
--   DROP TRIGGER IF EXISTS events_poster_placeholder_trg ON public.events;
--   DROP TRIGGER IF EXISTS placeholder_images_sync_trg ON public.placeholder_images;
--   DROP FUNCTION IF EXISTS public.events_poster_placeholder_fn();
--   DROP FUNCTION IF EXISTS public.placeholder_images_sync_fn();
--   ALTER TABLE public.events DROP COLUMN IF EXISTS poster_placeholder, DROP COLUMN IF EXISTS poster_sha256;
--   DROP TABLE IF EXISTS public.placeholder_images;
--   ALTER TABLE public.orgs DROP COLUMN IF EXISTS partner_since, DROP COLUMN IF EXISTS partner_note;
--   DROP VIEW public.public_venues; CREATE VIEW public.public_venues ... (20261126050000 의 여덟 칸 정의로)
--   ALTER TABLE public.venues DROP COLUMN IF EXISTS partner_since, DROP COLUMN IF EXISTS partner_note;

-- ---------- 안내 그림 ----------
CREATE TABLE IF NOT EXISTS public.placeholder_images (
    sha256    text PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    bytes     integer,
    note      text CHECK (note IS NULL OR char_length(note) <= 120),
    marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    marked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.placeholder_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.placeholder_images FROM anon;
DROP POLICY IF EXISTS "Admin only" ON public.placeholder_images;
CREATE POLICY "Admin only" ON public.placeholder_images FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS poster_sha256 text
    CHECK (poster_sha256 IS NULL OR poster_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS poster_placeholder boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS events_poster_sha256_idx ON public.events (poster_sha256);

-- 행사의 지문이 들어오거나 바뀌면 그 행만 다시 계산
CREATE OR REPLACE FUNCTION public.events_poster_placeholder_fn() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    NEW.poster_placeholder := NEW.poster_sha256 IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.placeholder_images p WHERE p.sha256 = NEW.poster_sha256);
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS events_poster_placeholder_trg ON public.events;
CREATE TRIGGER events_poster_placeholder_trg
    BEFORE INSERT OR UPDATE OF poster_sha256 ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.events_poster_placeholder_fn();

-- 안내 그림 표시를 더하거나 빼면 같은 지문의 행사를 한꺼번에 고친다
CREATE OR REPLACE FUNCTION public.placeholder_images_sync_fn() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.events SET poster_placeholder = true
         WHERE poster_sha256 = NEW.sha256 AND poster_placeholder = false;
        RETURN NEW;
    ELSE
        UPDATE public.events SET poster_placeholder = false
         WHERE poster_sha256 = OLD.sha256 AND poster_placeholder = true;
        RETURN OLD;
    END IF;
END $$;
DROP TRIGGER IF EXISTS placeholder_images_sync_trg ON public.placeholder_images;
CREATE TRIGGER placeholder_images_sync_trg
    AFTER INSERT OR DELETE ON public.placeholder_images
    FOR EACH ROW EXECUTE FUNCTION public.placeholder_images_sync_fn();

REVOKE ALL ON FUNCTION public.events_poster_placeholder_fn() FROM public;
REVOKE ALL ON FUNCTION public.placeholder_images_sync_fn() FROM public;

-- 같은 지문을 여러 공개 행사가 쓰는 그림(«안내 그림 후보»). 관리자 화면용
CREATE OR REPLACE FUNCTION public.poster_dup_candidates(p_min integer DEFAULT 3)
RETURNS TABLE (sha256 text, n bigint, sample_url text, marked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT e.poster_sha256, count(*), min(e.poster_image_url),
           EXISTS (SELECT 1 FROM public.placeholder_images p WHERE p.sha256 = e.poster_sha256)
      FROM public.events e
     WHERE public.is_admin() AND e.status = 'PUBLISHED' AND e.poster_sha256 IS NOT NULL
     GROUP BY e.poster_sha256
    HAVING count(*) >= p_min
     ORDER BY count(*) DESC
$$;
REVOKE ALL ON FUNCTION public.poster_dup_candidates(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.poster_dup_candidates(integer) TO authenticated;

-- ---------- 협약 ----------
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS partner_since date
    CHECK (partner_since IS NULL OR partner_since <= (now() AT TIME ZONE 'Asia/Seoul')::date + 1);
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS partner_note text
    CHECK (partner_note IS NULL OR char_length(partner_note) <= 200);
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS partner_since date
    CHECK (partner_since IS NULL OR partner_since <= (now() AT TIME ZONE 'Asia/Seoul')::date + 1);
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS partner_note text
    CHECK (partner_note IS NULL OR char_length(partner_note) <= 200);

CREATE OR REPLACE VIEW public.public_venues AS
    SELECT id, name, region, lat, lng, closed_days, capacity, district, partner_since
      FROM public.venues
     WHERE geo_status = 'confirmed';
REVOKE ALL ON public.public_venues FROM public, anon, authenticated;
GRANT SELECT ON public.public_venues TO anon, authenticated;
COMMENT ON VIEW public.public_venues IS '공개 화면용: 좌표가 확인된 장소만 (id, name, region, lat, lng, closed_days, capacity, district, partner_since)';
