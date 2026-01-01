-- 기존 정책 삭제 (중복 방지)
DROP POLICY IF EXISTS "Enable all access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Storage Select" ON storage.objects;
DROP POLICY IF EXISTS "Storage Insert" ON storage.objects;

-- 모든 권한 허용 정책 생성 (개발용)
CREATE POLICY "Enable all access" 
ON storage.objects 
FOR ALL 
USING (true) 
WITH CHECK (true);
