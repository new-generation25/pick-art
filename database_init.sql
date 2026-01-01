-- 1. 크롤러 설정 테이블 (어드민에서 관리 가능하도록)
CREATE TABLE IF NOT EXISTS crawler_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_type TEXT NOT NULL, -- 'instagram', 'website'
    name TEXT NOT NULL, -- 계정 이름 또는 사이트 이름
    identifier TEXT NOT NULL UNIQUE, -- SNS 핸들러나 URL
    keywords TEXT[], -- 수집할 키워드 배열
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 수집 원본 테이블 (큐레이션 전 인박스)
CREATE TABLE IF NOT EXISTS raw_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL,
    source_id TEXT UNIQUE,
    source_url TEXT NOT NULL,
    content JSONB NOT NULL,
    image_urls TEXT[],
    collected_at TIMESTAMP DEFAULT NOW(),
    status TEXT DEFAULT 'PENDING' -- PENDING, APPROVED, REJECTED
);

-- 3. 뉴스레터 구독자 테이블
CREATE TABLE IF NOT EXISTS subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    regions TEXT[], -- 관심 지역
    categories TEXT[], -- 관심 카테고리
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. 기존 events 테이블 보강 (이미지 로컬 저장 경로 필드)
ALTER TABLE events ADD COLUMN IF NOT EXISTS local_image_path TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS author_id TEXT;
