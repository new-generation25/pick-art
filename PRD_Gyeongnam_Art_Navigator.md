# [PRD] 경남 문화예술 정보 큐레이션 및 자동화 시스템

**Project Code:** `Gyeongnam-Art-Navi`
**Version:** 1.1.0 (Enhanced)
**Last Updated:** 2026-01-01
**Owner:** Max (Administrator)
**Priority:** High

## 1. 프로젝트 개요 (Overview)

* **서비스 명:** 경남 아트 네비게이터 (가칭, *Gyeongnam Art Pick*)
* **목표 (Objective):**
  * **1차 (MVP):** 경남 지역의 분산된 문화예술(공연, 전시, 행사) 정보를 자동 수집 및 중앙화하고, 관리자의 큐레이션(검수)을 거쳐 사용자에게 보기 쉽게 제공.
  * **2차 (확장):** 전국 단위 확장, 사용자 개인화(키워드 알림), 티켓 예매 연동 등.
* **해결하려는 문제:** 지역 문화 정보가 인스타그램, 지자체 게시판 등에 산재해 있어 찾기 어렵고, 휘발성이 강함.
* **핵심 가치:** 큐레이션된 신뢰성 + 지역 밀착형 정보 + 자동화된 효율성

## 2. 사용자 페르소나 (User Persona)

### 1. 슈퍼 관리자 (Max/Admin)
* **역할:** 큐레이터, 에디터, 시스템 관리자
* **Need:** 수집된 방대한 데이터를 빠르게 필터링하고 싶음.
* **Pain Point:**
  - 일일이 인스타그램/사이트를 돌아다니며 확인하는 시간 소모
  - 작가에게 DM 허락을 구하는 과정이 번거로움
  - 반복적인 복사/붙여넣기 작업
* **Goal:** '검토 → DM 요청 → 승인 → 게시'의 워크플로우를 최소한의 클릭으로 처리.
* **기술 수준:** 중급 (기본적인 대시보드 사용 가능)

### 2. 일반 사용자 (End User)
* **페르소나 A - 문화 애호가 (30대 직장인, 김해 거주):**
  - **Need:** "이번 주말 창원/김해에서 뭐 하지?"에 대한 답을 즉시 얻고 싶음.
  - **Goal:** 내 취향(연극, 전시)과 지역(김해, 진주)에 맞는 정보를 놓치지 않고 확인.
  - **행동 패턴:** 주로 모바일로 접속, 비주얼 중심 탐색

* **페르소나 B - 대학생 (20대, 창원 거주):**
  - **Need:** 무료 또는 저렴한 문화 행사 정보
  - **Goal:** 친구들과 함께 갈 만한 행사 찾기
  - **행동 패턴:** SNS 공유 선호, 후기/리뷰 중시

## 3. 상세 기능 요구사항 (Functional Requirements)

### A. 수집 모듈 (Collector Service)

#### 기술 스택
* Python 3.10+, Playwright (Browser Automation), BeautifulSoup4, aiohttp

#### 수집 대상

**1. Instagram:**
* **타겟:**
  - 해시태그: `#경남공연`, `#창원전시`, `#진주문화`, `#김해예술`, `#경남문화`, `#마산예술` 등
  - 특정 문화재단/공연장 공식 계정
* **추출 데이터:**
  - 이미지(다중/단일), 본문 텍스트, 업로드 날짜, 작성자 ID, 원본 링크, 좋아요 수, 댓글 수
* **제약 사항 관리:**
  - 인스타그램의 강력한 봇 탐지 우회를 위한 랜덤 딜레이 (3-10초)
  - 세션 쿠키 재사용으로 로그인 빈도 최소화
  - 헤드리스 모드 탐지 방지 기술 적용 (user-agent 설정, viewport randomization)
  - 시간당 수집 제한 (100개 이하)

**2. 공공기관 웹사이트:**
* **타겟:**
  - 경남문화재단 (https://www.gncaf.or.kr)
  - 창원문화재단 (https://www.cscf.or.kr)
  - 각 시청 문화행사 게시판 (창원, 김해, 진주, 통영, 거제 등)
* **방식:**
  - RSS 피드 우선 활용 (있는 경우)
  - 게시판 리스트 순회 → 새 글(`board_id` 기준) 발견 시 상세 내용 크롤링
  - 페이지 구조 변경 감지 시 자동 알림

#### 데이터 처리

**중복 제거 (Deduplication):**
* URL 기반 1차 중복 검사
* 이미지 해시(Perceptual Hash) 비교로 2차 검증
* 유사도 90% 이상 시 중복으로 판단

**이미지 영구 저장:**
* 인스타그램 이미지 URL은 일정 시간 후 만료되므로, 수집 즉시 **Supabase Storage**에 업로드
* 이미지 최적화: WebP 변환, 리사이징 (원본, 썸네일 2종 저장)
* 파일명 규칙: `{source}_{timestamp}_{hash}.webp`

**데이터 정제:**
* 본문에서 날짜/시간/장소 자동 추출 (정규식 + NLP)
* 카테고리 자동 분류 (키워드 기반: 공연, 전시, 행사, 축제)
* 스팸 필터링 (광고성 키워드 감지)

### B. 관리자 대시보드 (Admin Dashboard)

#### 기술 스택
* Streamlit (MVP용 빠른 개발) 또는 React Admin (확장 시)

#### 주요 기능

**1. 인박스 (Inbox)**
* 수집된 원본 데이터가 '대기(Pending)' 상태로 쌓이는 리스트 뷰
* 카드 형태 UI (포스터 이미지 + 제목 + 출처 + 날짜)
* 정렬: 최신순/인기순(좋아요)/긴급도
* 필터: 출처별, 지역별, 카테고리별

**2. 검수 및 DM 워크플로우**
* **1차 합격 버튼:** 클릭 시 → 상태 `DM_PENDING`으로 변경
* **DM 템플릿 복사:**
  ```
  안녕하세요, 경남 아트 네비게이터입니다.
  {작성자님}께서 올리신 {행사명} 정보를 저희 사이트에 소개하고 싶어 연락드렸습니다.
  출처 표기 및 원본 링크를 함께 게시하며, 언제든 삭제 요청 가능합니다.
  허락해주시겠습니까? 감사합니다!
  ```
* **원본 바로가기:** 새 창으로 인스타그램/웹사이트 열기
* **빠른 거절:** 광고/스팸은 `REJECTED` 처리 (사유 선택: 광고/중복/부적절)

**3. 최종 승인 (Publishing)**
* 정보 편집 기능:
  - 제목/설명 수정
  - 날짜/시간/장소 확인 및 보정
  - 카테고리/지역 태그 추가
* `승인 완료` → 상태 `PUBLISHED`, 프론트엔드 즉시 노출
* 예약 발행 기능 (특정 시간에 자동 게시)

**4. 블랙리스트 관리**
* 광고성 계정/키워드 등록 → 자동 필터링
* 화이트리스트: 신뢰할 수 있는 계정은 자동 승인 옵션

**5. 통계 대시보드**
* 일일 수집/승인/게시 건수
* 출처별 통계 (인스타 vs 공공기관)
* 인기 행사 TOP 10

### C. 사용자 웹사이트 (Front-end)

#### 기술 스택
* Next.js 14 (App Router), Tailwind CSS, Zustand (상태 관리)

#### 주요 화면

**1. 메인 피드 (홈)**
* Pinterest 스타일 카드 레이아웃 (Masonry Grid)
* 각 카드: 포스터 이미지, 제목, 날짜, 장소, 카테고리 뱃지
* 무한 스크롤 (Infinite Scroll)
* 상단 필터 바: 지역/카테고리/날짜 범위

**2. 상세 페이지 (/events/[id])**
* 대형 포스터 이미지
* 행사 정보:
  - 제목, 설명
  - 일시, 장소, 가격
  - 예매 링크 (있는 경우)
  - 출처 표기 + 원본 링크
* 공유 버튼 (카카오톡, 페이스북, 링크 복사)
* 관련 행사 추천

**3. 검색 페이지**
* 통합 검색 (제목, 설명, 장소 검색)
* 고급 검색 (지역+카테고리+날짜 조합)

**4. 마이페이지 (추후)**
* 키워드 알림 설정
* 관심 행사 저장 (북마크)

#### UX 고려사항
* 모바일 우선 디자인 (반응형)
* 다크 모드 지원
* 빠른 로딩 (이미지 lazy loading, CDN 활용)
* 접근성 (WCAG 2.1 AA 준수)

### D. 데이터베이스 및 저장소 (Backend)

#### BaaS: Supabase
* PostgreSQL 15+ (데이터)
* Supabase Storage (이미지)
* Supabase Auth (관리자 인증)
* Row Level Security (RLS) 활성화

#### 스키마 설계

**Table: raw_posts (수집 원본)**
```sql
CREATE TABLE raw_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL, -- 'instagram' | 'gyeongnam_foundation' | 'changwon_city'
    source_id TEXT UNIQUE, -- 인스타그램 포스트 ID 또는 게시판 글 번호
    source_url TEXT NOT NULL, -- 원본 URL
    content JSONB NOT NULL, -- 원본 데이터 (텍스트, 작성자, 날짜 등)
    image_urls TEXT[], -- 원본 이미지 URL 배열
    images_hash TEXT[], -- 이미지 perceptual hash
    collected_at TIMESTAMP DEFAULT NOW(),
    status TEXT DEFAULT 'COLLECTED', -- COLLECTED | PROCESSED | FAILED | DUPLICATE
    error_message TEXT, -- 실패 시 에러 메시지
    CONSTRAINT unique_source_post UNIQUE(source, source_id)
);

CREATE INDEX idx_raw_posts_status ON raw_posts(status);
CREATE INDEX idx_raw_posts_collected_at ON raw_posts(collected_at DESC);
```

**Table: events (정제된 행사 정보)**
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_post_id UUID REFERENCES raw_posts(id) ON DELETE SET NULL,

    -- 기본 정보
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- '공연' | '전시' | '행사' | '축제' | '강연' | '체험'
    region TEXT NOT NULL, -- '창원' | '김해' | '진주' | '통영' | '거제' | '양산' | '밀양' | '함안' | '기타'
    venue TEXT, -- 장소명
    venue_address TEXT, -- 주소

    -- 날짜/시간
    event_date_start DATE,
    event_date_end DATE,
    event_time_start TIME,
    event_time_end TIME,

    -- 비용
    price_info TEXT, -- '무료' | '유료' | '5,000원' 등
    is_free BOOLEAN DEFAULT false,

    -- 미디어
    poster_image_url TEXT NOT NULL, -- Supabase Storage 영구 링크
    poster_thumbnail_url TEXT, -- 썸네일
    additional_images TEXT[], -- 추가 이미지

    -- 출처
    source TEXT NOT NULL, -- 'instagram' | 'official_site'
    source_author TEXT, -- 작성자 (해싱 처리 고려)
    original_url TEXT NOT NULL, -- 원본 포스트 링크

    -- 예매
    booking_url TEXT, -- 예매 링크
    booking_platform TEXT, -- '인터파크' | '멜론티켓' | '자체 예매' 등

    -- 워크플로우
    status TEXT DEFAULT 'CANDIDATE',
    -- CANDIDATE | DM_PENDING | CONTACTED | APPROVED | PUBLISHED | REJECTED | ARCHIVED
    admin_notes TEXT, -- 관리자 메모
    rejection_reason TEXT, -- 거절 사유

    -- 게시 관련
    published_at TIMESTAMP,
    scheduled_publish_at TIMESTAMP, -- 예약 발행
    view_count INTEGER DEFAULT 0,
    bookmark_count INTEGER DEFAULT 0,

    -- 메타
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('CANDIDATE', 'DM_PENDING', 'CONTACTED', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED'))
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_published ON events(published_at DESC) WHERE status = 'PUBLISHED';
CREATE INDEX idx_events_region ON events(region);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_date ON events(event_date_start);
CREATE INDEX idx_events_is_free ON events(is_free) WHERE is_free = true;

-- Full-text search index
CREATE INDEX idx_events_search ON events USING gin(to_tsvector('korean', title || ' ' || COALESCE(description, '')));
```

**Table: keywords (사용자 알림 키워드)**
```sql
CREATE TABLE keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    regions TEXT[], -- ['창원', '김해']
    categories TEXT[], -- ['전시', '공연']
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_keywords_user ON keywords(user_id);
CREATE INDEX idx_keywords_active ON keywords(is_active) WHERE is_active = true;
```

**Table: notification_logs (알림 발송 기록)**
```sql
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL, -- 'telegram' | 'kakao' | 'push' | 'email'
    sent_at TIMESTAMP DEFAULT NOW(),
    status TEXT DEFAULT 'SENT', -- SENT | FAILED | PENDING
    error_message TEXT
);

CREATE INDEX idx_notification_logs_event ON notification_logs(event_id);
CREATE INDEX idx_notification_logs_user ON notification_logs(user_id);
```

**Table: blacklist (블랙리스트)**
```sql
CREATE TABLE blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'account' | 'keyword' | 'url'
    value TEXT NOT NULL UNIQUE,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_blacklist_type ON blacklist(type);
```

**Table: whitelist (화이트리스트)**
```sql
CREATE TABLE whitelist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'account' | 'domain'
    value TEXT NOT NULL UNIQUE,
    auto_approve BOOLEAN DEFAULT false, -- 자동 승인 여부
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### E. 알림 시스템 (Notification)

#### 관리자 알림 (Telegram Bot)
* **트리거:**
  - 새 게시물 10건 이상 수집 시
  - 크롤러 에러 발생 시
  - 일일 리포트 (매일 오전 9시)
* **메시지 포맷:**
  ```
  📊 일일 리포트 (2026-01-01)
  ✅ 수집: 47건
  📋 검토 대기: 23건
  💬 DM 응답 대기: 8건
  ✨ 오늘 게시: 15건
  ```

#### 사용자 알림 (추후)
* **카카오톡 알림톡:**
  - 키워드 매칭 시 자동 발송
  - 비용: 건당 15-20원
  - 템플릿 사전 승인 필요
* **브라우저 Push 알림:**
  - Web Push API 활용
  - 무료, 실시간 알림
* **이메일 알림:**
  - 주간 다이제스트 (금요일 발송)

## 4. 서비스 흐름 (User Flow / State Machine)

### 데이터 수집 → 게시 워크플로우

```
[자동 수집] → [1차 검토] → [DM 발송] → [승인 대기] → [편집/보정] → [게시]
     ↓            ↓            ↓           ↓             ↓           ↓
COLLECTED   CANDIDATE   DM_PENDING  CONTACTED    APPROVED   PUBLISHED
                ↓
             REJECTED (스팸/광고/중복)
```

### 상세 단계

**1. 자동 수집 (Automated Collection)**
* **시간:** 매일 04:00, 18:00 (2회)
* **동작:**
  - 인스타그램 해시태그 크롤링
  - 공공기관 게시판 새 글 확인
  - 이미지 다운로드 및 Storage 업로드
  - DB에 `COLLECTED` 상태로 저장
* **알림:** 수집 완료 시 Telegram으로 관리자에게 요약 전송

**2. 1차 검토 (Admin Review)**
* **주체:** 관리자 (Max)
* **동작:**
  - 대시보드에서 `COLLECTED` 목록 확인
  - 광고/스팸은 즉시 `REJECTED` 처리
  - 유망한 정보는 `CANDIDATE`로 변경
* **소요 시간:** 1건당 10-30초 (목표)

**3. DM 발송 (Contact Author)**
* **주체:** 관리자
* **동작:**
  - `CANDIDATE` 목록에서 선택
  - DM 템플릿 복사 → 인스타그램/이메일로 발송
  - 대시보드에서 `DM_PENDING` → `CONTACTED`로 변경
  - 발송 일시 기록

**4. 승인 대기 (Waiting for Approval)**
* **기간:** 48시간
* **시나리오:**
  - **수락:** `APPROVED`로 변경
  - **거절:** `REJECTED` (사유: 작가 거절)
  - **무응답:** 48시간 후 `ARCHIVED` (향후 재시도 가능)

**5. 편집/보정 (Content Editing)**
* **주체:** 관리자
* **동작:**
  - 제목/설명 다듬기
  - 날짜/시간/장소 정확성 확인
  - 카테고리/지역 태그 검증
  - 예매 링크 추가 (있는 경우)

**6. 게시 (Publishing)**
* **동작:**
  - `PUBLISHED` 상태로 변경
  - `published_at` 타임스탬프 기록
  - 프론트엔드 API에 즉시 노출
  - 키워드 알림 대상자에게 알림 발송

## 5. 기술적 고려사항 및 리스크

### A. Instagram 크롤링 리스크

**문제:** 과도한 크롤링 시 계정 정지/IP 차단 위험

**대응 전략:**
* **로그인 세션 유지:** 쿠키 저장 및 재사용 (7일 유효)
* **요청 빈도 조절:**
  - 시간당 최대 100개 포스트
  - 각 요청 사이 3-10초 랜덤 딜레이
* **복수 계정 로테이션:**
  - 계정 3개 준비 (메인, 백업1, 백업2)
  - 일일 교대 사용
* **User-Agent 다양화:** 실제 브라우저처럼 보이도록 설정
* **헤드리스 탐지 방지:**
  ```python
  await page.add_init_script("""
      Object.defineProperty(navigator, 'webdriver', {get: () => undefined})
  """)
  ```
* **모니터링:** 429 에러 발생 시 즉시 중단 및 알림

### B. 저작권 (Copyright)

**문제:** 타인의 저작물(포스터, 사진)을 허락 없이 게시하면 법적 문제 발생 가능

**대응 전략:**
* **필수 승인 절차:**
  - 모든 게시물은 작성자의 명시적 허락 필요
  - DM 대화 내용 스크린샷 보관 (증거)
* **출처 표기:**
  - 원본 링크 필수 게재
  - 작성자 크레딧 명시
* **즉시 삭제 정책:**
  - 삭제 요청 시 24시간 내 처리
  - 삭제 요청 양식 웹사이트에 공개
* **이용약관:**
  - "모든 콘텐츠는 원 저작자의 허락을 받았음"
  - "저작권 문제 시 즉시 조치"

### C. 이미지 링크 만료

**문제:** 인스타그램 CDN URL은 외부에서 일정 시간 후 403 Forbidden

**대응 전략:**
* **즉시 재업로드:**
  - 수집 즉시 Supabase Storage에 업로드
  - 원본 + 썸네일 2종 저장
* **이미지 최적화:**
  - WebP 포맷 변환 (파일 크기 30-50% 감소)
  - 원본: 최대 1920px, 썸네일: 600px
* **CDN 활용:**
  - Supabase Storage는 자체 CDN 제공
  - 필요 시 CloudFlare 추가 연동

### D. 크롤링 대상 사이트 구조 변경

**문제:** 공공기관 웹사이트 리뉴얼 시 크롤러 작동 중단

**대응 전략:**
* **변경 감지 시스템:**
  - HTML 구조 해시 비교
  - 예상 요소 미발견 시 즉시 알림
* **유연한 Selector:**
  - XPath 대신 의미론적 선택자 사용
  - 여러 fallback selector 준비
* **빠른 대응 체계:**
  - 변경 감지 시 Telegram 긴급 알림
  - 코드 수정 → 배포 30분 이내 목표

### E. 개인정보 보호

**문제:** 작성자 정보 수집/저장 시 개인정보 보호법 준수 필요

**대응 전략:**
* **최소 수집 원칙:**
  - 작성자 ID는 해싱 처리 (SHA-256)
  - 연락처는 수집하지 않음
* **개인정보 처리방침 작성:**
  - 웹사이트 하단에 공개
  - 수집 항목, 목적, 보관 기간 명시
* **데이터 보관 기간:**
  - 게시 승인 정보: 2년
  - 거절된 정보: 90일 후 자동 삭제

## 6. 비기능 요구사항 (Non-Functional Requirements)

### A. 성능 요구사항

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| 수집 속도 | 100개 게시물 15분 이내 | 크롤러 로그 분석 |
| 대시보드 초기 로딩 | 3초 이내 | Lighthouse 점수 90+ |
| API 응답 시간 | 평균 200ms 이하 | Supabase 모니터링 |
| 이미지 로딩 | 1초 이내 (썸네일) | CDN 캐시 히트율 95%+ |
| 동시 접속 | 100명 | 부하 테스트 (Artillery) |

### B. 확장성 (Scalability)

* **데이터 증가 대응:**
  - 일 500건 수집 가정 → 연간 180,000건
  - PostgreSQL 파티셔닝 (월별)
  - 오래된 데이터 아카이빙 (1년 경과 시)

* **지역 확장:**
  - 현재: 경남 8개 주요 도시
  - 6개월: 부산 추가
  - 1년: 경남+부산+울산 (동남권)
  - 2년: 전국 확장

* **설정 파일 기반 운영:**
  ```yaml
  # config/regions.yml
  regions:
    - name: 창원
      hashtags: ['#창원공연', '#창원전시']
      official_sites: [...]
    - name: 김해
      hashtags: ['#김해공연', '#김해문화']
      official_sites: [...]
  ```

* **다중 관리자 지원:**
  - 지역별 큐레이터 권한 분리
  - Role-Based Access Control (RBAC)

### C. 보안 요구사항

* **인증/인가:**
  - 관리자 대시보드: Supabase Auth (이메일+비밀번호)
  - 2단계 인증 (2FA) 선택 적용
  - 세션 타임아웃: 2시간

* **API 보안:**
  - Rate Limiting: IP당 분당 60회
  - Supabase Row Level Security (RLS) 활성화
  - API Key 암호화 저장 (환경 변수)

* **데이터 보호:**
  - HTTPS 필수 (Let's Encrypt)
  - DB 백업 암호화
  - 민감 정보 해싱 (bcrypt, SHA-256)

* **취약점 대응:**
  - SQL Injection 방지 (Prepared Statements)
  - XSS 방지 (입력 sanitization)
  - CSRF 토큰 사용

### D. 가용성 (Availability)

* **목표 업타임:** 99.5% (월 3.6시간 이내 다운타임)
* **백업 전략:**
  - 일일 자동 DB 백업 (오전 3시)
  - 7일간 백업 보관
  - 주간 백업 4주 보관
* **장애 복구:**
  - 크롤러 실패 시 자동 재시도 (최대 3회, 지수 백오프)
  - DB 장애 시 읽기 전용 모드 전환
  - 복구 목표 시간 (RTO): 1시간
  - 복구 목표 시점 (RPO): 24시간

### E. 유지보수성 (Maintainability)

* **코드 품질:**
  - Python: PEP 8, Black 포매터, mypy 타입 체크
  - JavaScript: ESLint, Prettier
  - 코드 리뷰 필수

* **문서화:**
  - API 문서 자동 생성 (FastAPI Swagger)
  - README.md: 설치/실행 가이드
  - 주석: 복잡한 로직만 작성

* **로깅:**
  - 수준: DEBUG (개발), INFO (운영)
  - 포맷: JSON (구조화된 로그)
  - 저장: CloudWatch Logs 또는 로컬 파일

* **모니터링:**
  - 크롤러 작동 상태 대시보드
  - 에러율 추적 (Sentry)
  - 성능 메트릭 (Supabase 대시보드)

## 7. 시스템 아키텍처 (System Architecture)

### 전체 구성도

```
┌─────────────────────────────────────────────────────────┐
│                    Data Sources                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Instagram   │  │  Public      │  │  Cultural    │  │
│  │  (Hashtags)  │  │  Board Sites │  │  Foundation  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ Playwright + BeautifulSoup
                       ↓
┌─────────────────────────────────────────────────────────┐
│              Collector Service (Python)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Scraper     │→ │  Dedup +     │→ │  Image       │  │
│  │  Module      │  │  Sanitizer   │  │  Processor   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         APScheduler (Cron: 04:00, 18:00)                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│                 Supabase Backend                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │         PostgreSQL 15 (Database)                 │  │
│  │  raw_posts | events | keywords | notifications  │  │
│  │  RLS Enabled + Triggers + Functions              │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Supabase Storage (CDN)                   │  │
│  │  Images: /posters/{id}_original.webp             │  │
│  │          /posters/{id}_thumbnail.webp            │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Supabase Auth                            │  │
│  │  Admin Authentication + Role Management          │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────┬────────────────────┬─────────────────────┘
               │                    │
        ┌──────┴──────┐      ┌──────┴──────┐
        │             │      │             │
        ↓             ↓      ↓             ↓
┌─────────────┐  ┌─────────────────┐  ┌───────────────┐
│   Admin     │  │   User Web      │  │   Telegram    │
│  Dashboard  │  │   (Frontend)    │  │   Bot         │
│  Streamlit  │  │   Next.js 14    │  │   Notifier    │
│  + Auth     │  │   + Tailwind    │  │   (Admin)     │
└─────────────┘  └─────────────────┘  └───────────────┘
     Admin             Users              Notifications
```

### 기술 스택 상세

#### Backend

| 구성 요소 | 기술 | 버전 | 용도 |
|-----------|------|------|------|
| 언어 | Python | 3.10+ | 크롤링, 데이터 처리 |
| 브라우저 자동화 | Playwright | 1.40+ | 인스타그램 크롤링 |
| HTML 파싱 | BeautifulSoup4 | 4.12+ | 공공기관 사이트 |
| HTTP 클라이언트 | aiohttp | 3.9+ | 비동기 요청 |
| 스케줄러 | APScheduler | 3.10+ | 정기 크롤링 실행 |
| 이미지 처리 | Pillow | 10.0+ | 리사이징, WebP 변환 |
| 중복 감지 | imagehash | 4.3+ | Perceptual Hash |
| 환경 변수 | python-dotenv | 1.0+ | 설정 관리 |

#### Database & Storage

| 구성 요소 | 기술 | 용도 |
|-----------|------|------|
| BaaS | Supabase | 백엔드 인프라 |
| 데이터베이스 | PostgreSQL 15 | 메인 데이터 저장 |
| 파일 저장소 | Supabase Storage | 이미지 저장 |
| 인증 | Supabase Auth | 관리자 로그인 |
| 보안 | Row Level Security | 데이터 접근 제어 |

#### Admin Dashboard

| 구성 요소 | 기술 | 버전 | 용도 |
|-----------|------|------|------|
| 프레임워크 | Streamlit | 1.30+ | 빠른 대시보드 개발 |
| 인증 | Supabase Auth | - | 로그인 연동 |
| 배포 | Docker | 24.0+ | 컨테이너화 |
| 호스팅 | AWS EC2 / Render | - | 서버 운영 |

#### User Frontend

| 구성 요소 | 기술 | 버전 | 용도 |
|-----------|------|------|------|
| 프레임워크 | Next.js | 14 | React 풀스택 |
| 라우팅 | App Router | - | 최신 라우팅 |
| 스타일링 | Tailwind CSS | 3.4+ | 유틸리티 CSS |
| 상태 관리 | Zustand | 4.5+ | 클라이언트 상태 |
| DB 클라이언트 | @supabase/supabase-js | 2.39+ | DB 연동 |
| 이미지 최적화 | next/image | - | 자동 최적화 |
| 배포 | Vercel | - | CI/CD 자동화 |

#### Notification

| 구성 요소 | 기술 | 용도 |
|-----------|------|------|
| Telegram | python-telegram-bot | 관리자 알림 |
| 카카오톡 (추후) | 카카오 알림톡 API | 사용자 알림 |
| Web Push (추후) | Web Push API | 브라우저 알림 |

#### Monitoring & Logging

| 구성 요소 | 기술 | 용도 |
|-----------|------|------|
| 에러 추적 | Sentry | 실시간 오류 모니터링 |
| 로그 관리 | Python logging | 구조화된 로그 |
| 로그 저장 | CloudWatch Logs | 중앙 로그 수집 |
| 크롤러 모니터링 | Custom Dashboard | Telegram 일일 리포트 |

### 배포 환경

#### Development
* **Backend:** 로컬 Python 환경
* **Frontend:** localhost:3000 (Next.js dev server)
* **Database:** Supabase 개발 프로젝트

#### Production
* **Backend:** AWS EC2 t3.small (Docker) 또는 Render
* **Frontend:** Vercel (자동 배포)
* **Database:** Supabase Production 프로젝트
* **Domain:** www.gyeongnam-art-navi.com (예시)

## 8. API 명세 (API Specification)

### Admin API (Supabase Functions + Custom)

#### 1. GET /api/admin/pending-posts
관리자 대시보드용 대기 중인 게시물 목록

**Query Parameters:**
```
- status: COLLECTED | CANDIDATE | DM_PENDING | CONTACTED
- limit: 20 (default)
- offset: 0 (pagination)
- sort: latest | popular | urgent
```

**Response:**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "title": "경남도립미술관 봄맞이 전시",
      "description": "현대미술 작가 20인의 작품 전시...",
      "region": "창원",
      "category": "전시",
      "status": "CANDIDATE",
      "poster_image_url": "https://xxx.supabase.co/storage/.../poster.webp",
      "poster_thumbnail_url": "https://xxx.supabase.co/storage/.../thumb.webp",
      "source": "instagram",
      "source_author": "gyeongnam_museum",
      "original_url": "https://instagram.com/p/...",
      "collected_at": "2026-01-01T10:00:00Z",
      "event_date_start": "2026-02-01",
      "event_date_end": "2026-02-28"
    }
  ],
  "pagination": {
    "total": 47,
    "limit": 20,
    "offset": 0
  }
}
```

#### 2. POST /api/admin/update-status
게시물 상태 업데이트

**Request Body:**
```json
{
  "event_id": "a1b2c3d4-...",
  "status": "PUBLISHED",
  "admin_notes": "작가 승인 완료 (DM 2026-01-01)",
  "published_at": "2026-01-01T15:00:00Z" // Optional, 예약 발행
}
```

**Response:**
```json
{
  "success": true,
  "message": "게시물이 발행되었습니다.",
  "event": {
    "id": "a1b2c3d4-...",
    "status": "PUBLISHED",
    "published_at": "2026-01-01T15:00:00Z"
  }
}
```

#### 3. POST /api/admin/edit-event
게시물 정보 수정

**Request Body:**
```json
{
  "event_id": "a1b2c3d4-...",
  "title": "수정된 제목",
  "description": "수정된 설명",
  "event_date_start": "2026-02-01",
  "event_date_end": "2026-02-28",
  "venue": "경남도립미술관",
  "venue_address": "창원시 의창구 ...",
  "price_info": "무료",
  "is_free": true,
  "booking_url": "https://..."
}
```

#### 4. POST /api/admin/blacklist
블랙리스트 추가

**Request Body:**
```json
{
  "type": "account",
  "value": "spam_account_123",
  "reason": "광고성 계정"
}
```

### Public API (User Frontend)

#### 1. GET /api/events
사용자용 행사 목록 (필터링 지원)

**Query Parameters:**
```
- region: 창원 | 김해 | 진주 | 통영 | 거제 | 양산 | 밀양 | 함안
- category: 공연 | 전시 | 행사 | 축제 | 강연 | 체험
- is_free: true | false
- date_from: 2026-01-01
- date_to: 2026-01-31
- search: 검색 키워드
- limit: 20 (default)
- offset: 0 (pagination)
- sort: latest | popular | upcoming
```

**Response:**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "title": "경남도립미술관 봄맞이 전시",
      "description": "현대미술 작가 20인...",
      "category": "전시",
      "region": "창원",
      "venue": "경남도립미술관",
      "event_date_start": "2026-02-01",
      "event_date_end": "2026-02-28",
      "poster_image_url": "https://...",
      "poster_thumbnail_url": "https://...",
      "is_free": true,
      "price_info": "무료",
      "booking_url": null,
      "view_count": 342,
      "bookmark_count": 28,
      "published_at": "2026-01-01T15:00:00Z"
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 20,
    "offset": 0
  }
}
```

#### 2. GET /api/events/:id
행사 상세 정보

**Response:**
```json
{
  "id": "a1b2c3d4-...",
  "title": "경남도립미술관 봄맞이 전시",
  "description": "현대미술 작가 20인의 작품을 한자리에...",
  "category": "전시",
  "region": "창원",
  "venue": "경남도립미술관",
  "venue_address": "창원시 의창구 ...",
  "event_date_start": "2026-02-01",
  "event_date_end": "2026-02-28",
  "event_time_start": "10:00",
  "event_time_end": "18:00",
  "poster_image_url": "https://...",
  "additional_images": ["https://...", "https://..."],
  "is_free": true,
  "price_info": "무료",
  "booking_url": null,
  "source": "instagram",
  "source_author": "gyeongnam_museum",
  "original_url": "https://instagram.com/p/...",
  "view_count": 342,
  "bookmark_count": 28,
  "published_at": "2026-01-01T15:00:00Z",
  "related_events": [
    {
      "id": "...",
      "title": "...",
      "poster_thumbnail_url": "..."
    }
  ]
}
```

#### 3. POST /api/events/:id/view
조회수 증가 (익명)

#### 4. POST /api/events/:id/bookmark
북마크 추가/제거 (로그인 사용자)

#### 5. GET /api/regions
지역 목록 + 행사 수

**Response:**
```json
{
  "data": [
    { "name": "창원", "count": 45 },
    { "name": "김해", "count": 23 },
    { "name": "진주", "count": 18 }
  ]
}
```

## 9. 개발 로드맵 (Development Roadmap)

### Phase 1: MVP (4-6주)

#### Week 1-2: Backend 기반 구축
**목표:** 데이터 수집 시스템 완성

- [ ] Supabase 프로젝트 생성 및 스키마 설계
  - [ ] 테이블 생성 (raw_posts, events, keywords, blacklist)
  - [ ] RLS 정책 설정
  - [ ] Storage 버킷 생성
- [ ] Instagram 크롤러 개발 (Playwright)
  - [ ] 로그인 세션 관리
  - [ ] 해시태그 검색 및 포스트 추출
  - [ ] 랜덤 딜레이 및 탐지 방지
- [ ] 공공기관 크롤러 개발 (BeautifulSoup)
  - [ ] 경남문화재단 게시판 파싱
  - [ ] 창원문화재단 게시판 파싱
- [ ] 이미지 다운로드 및 Supabase Storage 업로드
  - [ ] WebP 변환
  - [ ] 원본/썸네일 생성
- [ ] 중복 감지 로직 구현
  - [ ] URL 기반 중복 체크
  - [ ] Perceptual Hash 비교
- [ ] APScheduler 설정 (04:00, 18:00 실행)

#### Week 3: Admin Dashboard
**목표:** 관리자가 사용할 수 있는 대시보드 완성

- [ ] Streamlit 대시보드 기본 구조
  - [ ] 레이아웃 설계 (사이드바, 메인 컨텐츠)
- [ ] Supabase Auth 연동
  - [ ] 로그인 페이지
  - [ ] 세션 관리
- [ ] 게시물 검토/승인 UI
  - [ ] COLLECTED 목록 뷰 (카드 레이아웃)
  - [ ] 상태 변경 버튼 (CANDIDATE, REJECTED)
- [ ] DM 템플릿 복사 기능
  - [ ] 클립보드 API 연동
  - [ ] 원본 링크 새 창 열기
- [ ] 상태 관리 워크플로우
  - [ ] DM_PENDING → CONTACTED
  - [ ] APPROVED → PUBLISHED
- [ ] 게시물 편집 기능
  - [ ] 제목/설명/날짜/장소 수정
- [ ] 블랙리스트 관리 페이지

#### Week 4: User Frontend (기본)
**목표:** 사용자가 볼 수 있는 웹사이트 기본 버전

- [ ] Next.js 14 프로젝트 생성
  - [ ] App Router 설정
  - [ ] Tailwind CSS 설정
- [ ] Supabase 연동 및 데이터 페칭
  - [ ] Supabase 클라이언트 설정
  - [ ] API 라우트 작성
- [ ] 메인 피드 UI (카드 레이아웃)
  - [ ] Pinterest 스타일 Masonry Grid
  - [ ] 무한 스크롤
- [ ] 필터링 기능 (지역/카테고리)
  - [ ] 필터 UI 컴포넌트
  - [ ] URL 쿼리 파라미터 연동
- [ ] 상세 페이지
  - [ ] 포스터 확대 보기
  - [ ] 행사 정보 표시
  - [ ] 공유 버튼
- [ ] 반응형 디자인 (모바일 최적화)

#### Week 5: 통합 및 테스트
**목표:** 전체 시스템 통합 및 버그 수정

- [ ] 크롤러 스케줄링 (Cron)
  - [ ] APScheduler 설정 검증
  - [ ] 실패 시 재시도 로직
- [ ] Telegram Bot 알림 구현
  - [ ] 일일 리포트 메시지
  - [ ] 에러 알림
- [ ] 전체 워크플로우 테스트
  - [ ] 수집 → 검토 → 승인 → 게시 흐름 검증
  - [ ] 각 상태 전환 테스트
- [ ] 버그 수정 및 최적화
  - [ ] 성능 병목 지점 개선
  - [ ] 에러 처리 강화
- [ ] 사용자 피드백 수집 (베타 테스터)

#### Week 6: 배포 및 모니터링
**목표:** 실 서비스 배포 및 안정화

- [ ] Frontend Vercel 배포
  - [ ] 환경 변수 설정
  - [ ] 도메인 연결
- [ ] Backend Docker 컨테이너화
  - [ ] Dockerfile 작성
  - [ ] Docker Compose 설정
- [ ] AWS EC2 또는 Render 배포
  - [ ] 인스턴스 생성
  - [ ] 보안 그룹 설정
- [ ] Sentry 에러 추적 설정
  - [ ] Python SDK 연동
  - [ ] Next.js SDK 연동
- [ ] 실제 데이터 수집 시작
  - [ ] 크롤러 정식 가동
  - [ ] 모니터링 대시보드 확인
- [ ] 운영 문서 작성
  - [ ] 관리자 매뉴얼
  - [ ] 장애 대응 가이드

### Phase 2: 확장 기능 (2-3개월)

#### Month 2: 사용자 기능 강화
- [ ] 사용자 회원가입 시스템
  - [ ] Supabase Auth 이메일 가입
  - [ ] 소셜 로그인 (카카오)
- [ ] 키워드 알림 설정
  - [ ] 사용자 마이페이지
  - [ ] 키워드 등록/수정/삭제
  - [ ] 알림 수신 채널 선택
- [ ] 북마크 기능
  - [ ] 관심 행사 저장
  - [ ] 북마크 목록 페이지
- [ ] 카카오톡 알림톡 연동
  - [ ] 비즈니스 계정 등록
  - [ ] 템플릿 승인
  - [ ] 발송 시스템 구축

#### Month 3: 지역 확장
- [ ] 부산 지역 추가
  - [ ] 부산 문화재단 크롤러
  - [ ] 부산 해시태그 추가
- [ ] 울산 지역 추가
- [ ] 통합 검색 고도화
  - [ ] Full-text search 최적화
  - [ ] 자동완성 기능
- [ ] 티켓 예매 링크 자동 파싱
  - [ ] 인터파크/멜론티켓 링크 감지
  - [ ] 예매 버튼 강조 표시

#### Month 4: 관리 기능 강화
- [ ] 관리자 다중 계정 지원
  - [ ] 역할 기반 권한 (RBAC)
  - [ ] 지역별 큐레이터
- [ ] 통계 대시보드
  - [ ] 조회수/북마크 분석
  - [ ] 인기 행사 TOP 10
  - [ ] 지역/카테고리별 통계
- [ ] 자동 카테고리 분류 (ML)
  - [ ] 키워드 기반 분류 모델
  - [ ] 정확도 90% 이상 목표

### Phase 3: Advanced Features (6개월~1년)

#### 고급 기능
- [ ] AI 기반 추천 시스템
  - [ ] 사용자 행동 분석
  - [ ] 개인화 추천 알고리즘
- [ ] 사용자 리뷰 및 평점 시스템
  - [ ] 행사 후기 작성
  - [ ] 별점/추천 여부
- [ ] 모바일 앱 (React Native)
  - [ ] iOS/Android 네이티브 앱
  - [ ] 푸시 알림
- [ ] 광고 수익 모델 도입
  - [ ] Google AdSense
  - [ ] 직접 광고 (문화기관)
- [ ] API 오픈 (공공 데이터)
  - [ ] 외부 개발자용 API 제공
  - [ ] API 키 관리 시스템

## 10. 예산 및 비용 추정 (Cost Estimation)

### 초기 개발 비용 (자체 개발 가정)

| 항목 | 시간 | 단가 | 비용 |
|------|------|------|------|
| Backend 개발 | 80시간 | 50,000원/h | 4,000,000원 |
| Frontend 개발 | 60시간 | 50,000원/h | 3,000,000원 |
| Admin Dashboard | 40시간 | 50,000원/h | 2,000,000원 |
| 테스트 & 배포 | 20시간 | 50,000원/h | 1,000,000원 |
| **총계** | **200시간** | - | **10,000,000원** |

**외주 시 예상 비용:** 약 12,000,000~15,000,000원 (프리랜서 기준)

### 월간 운영 비용 (MVP 기준)

| 항목 | 서비스 | 비용 |
|------|--------|------|
| BaaS | Supabase Pro | $25/월 |
| 프론트엔드 호스팅 | Vercel Hobby | $0/월 |
| 백엔드 서버 | AWS EC2 t3.small | $15/월 |
| 도메인 | .com | $1/월 |
| 에러 추적 | Sentry Developer | $0/월 (무료) |
| CDN | CloudFlare Free | $0/월 |
| **총계** | - | **$41/월 (약 55,000원)** |

### 확장 시 추가 비용 (Phase 2~3)

| 항목 | 서비스 | 예상 비용 |
|------|--------|-----------|
| 카카오톡 알림톡 | 카카오 비즈니스 | 건당 15-20원 (월 1,000건 시 약 20,000원) |
| CDN | CloudFlare Pro | $20/월 |
| 데이터베이스 확장 | Supabase Pro 추가 용량 | +$10~50/월 |
| 서버 업그레이드 | AWS EC2 t3.medium | $30/월 |
| 모니터링 | Sentry Team | $26/월 |
| **총계** | - | **+$86~146/월 (약 115,000~195,000원)** |

### 연간 총 비용 예상

| 구분 | 비용 |
|------|------|
| 초기 개발 (1회) | 10,000,000원 |
| 월간 운영 (12개월) | 660,000원 |
| 확장 비용 (6개월) | 900,000원 |
| **1년 총계** | **약 11,560,000원** |

### 수익 모델 (향후)

| 모델 | 예상 수익 |
|------|-----------|
| 광고 수익 (AdSense) | 월 50,000~200,000원 (트래픽 증가 시) |
| 직접 광고 (문화기관) | 건당 100,000~500,000원 |
| 프리미엄 멤버십 | 월 2,900원 × 100명 = 290,000원 |
| API 유료 제공 | 월 50,000~200,000원 |

## 11. 성공 지표 (Success Metrics / KPI)

### MVP 성공 기준 (3개월 내)

#### 수집 효율성
* **일 평균 수집:** 50건 이상 새 정보
* **중복률:** 20% 이하
* **에러율:** 5% 이하
* **크롤러 가동률:** 95% 이상

#### 큐레이션 품질
* **승인율:** 수집된 정보 중 30% 이상 게시
* **평균 검토 시간:** 1건당 30초 이하
* **DM 응답률:** 50% 이상
* **오정보율:** 5% 이하

#### 사용자 지표
* **월간 순방문자 (UV):** 1,000명 이상
* **재방문율:** 30% 이상
* **평균 세션 시간:** 2분 이상
* **페이지뷰/세션:** 3페이지 이상
* **모바일 비율:** 70% 이상

#### 기술 지표
* **API 응답 시간:** 평균 200ms 이하
* **페이지 로딩 속도:** 3초 이내
* **에러율:** 1% 이하
* **업타임:** 99.5% 이상

### 장기 목표 (6개월~1년)

#### 성장 지표
* **지역 커버리지:** 경남 전 지역 + 부산 + 울산
* **월간 게시물:** 500건 이상
* **누적 사용자:** 10,000명 이상
* **월간 활성 사용자 (MAU):** 3,000명 이상
* **키워드 알림 구독:** 1,000명 이상

#### 참여 지표
* **북마크율:** 전체 조회의 10% 이상
* **공유율:** 전체 조회의 5% 이상
* **리뷰 작성:** 월 100건 이상 (리뷰 기능 도입 시)

#### 비즈니스 지표
* **광고 수익:** 월 200,000원 이상
* **프리미엄 멤버:** 100명 이상
* **파트너 문화기관:** 10곳 이상

## 12. 리스크 관리 (Risk Management)

| 리스크 | 확률 | 영향도 | 대응 전략 | 담당자 |
|--------|------|--------|-----------|--------|
| 인스타그램 계정 차단 | 중간 (40%) | 높음 (9) | • 복수 계정 준비 (3개)<br>• 로테이션 사용<br>• 요청 빈도 조절<br>• 딜레이 랜덤화 | Backend Dev |
| 저작권 분쟁 | 낮음 (15%) | 높음 (9) | • 승인 절차 철저화<br>• DM 대화 증거 보관<br>• 즉시 삭제 정책<br>• 법률 자문 준비 | Admin |
| 크롤링 대상 사이트 구조 변경 | 높음 (60%) | 중간 (6) | • 변경 감지 시스템<br>• Telegram 즉시 알림<br>• 빠른 수정 체계 (30분 내)<br>• 여러 Selector 준비 | Backend Dev |
| 초기 사용자 확보 실패 | 중간 (40%) | 중간 (6) | • SNS 마케팅 (인스타, 페북)<br>• 문화재단 협력<br>• 오프라인 홍보 (포스터)<br>• 인플루언서 협업 | Marketing |
| 서버 다운타임 | 낮음 (20%) | 중간 (6) | • 자동 재시작 설정<br>• 백업 서버 준비<br>• 모니터링 알림<br>• 복구 매뉴얼 | DevOps |
| 예산 초과 | 낮음 (25%) | 낮음 (4) | • 무료/저비용 솔루션 우선<br>• 단계적 확장<br>• 비용 모니터링<br>• 수익 모델 조기 도입 | PM |
| 데이터 품질 저하 | 중간 (35%) | 중간 (6) | • 품질 검증 로직 강화<br>• 관리자 피드백 루프<br>• 스팸 필터 개선<br>• 화이트리스트 활용 | Backend Dev |

### 리스크 점수 계산
* **점수:** 확률(%) × 영향도(1-10)
* **우선순위:** 높음(7-10), 중간(4-6), 낮음(1-3)

## 13. 법적 고려사항 (Legal Considerations)

### A. 개인정보 보호법

**수집 정보:**
* 작성자 ID (공개 정보, 해싱 처리)
* 이미지, 텍스트 (공개 게시물)
* 사용자 이메일 (회원가입 시)

**개인정보 처리방침:**
* 웹사이트 하단에 공개
* 수집 항목, 목적, 보관 기간 명시
* 개인정보 처리 책임자 연락처

**동의:**
* DM으로 명시적 동의 확보 (기록 보관 필수)
* 회원가입 시 약관 동의 체크박스

**보관 기간:**
* 게시 승인 정보: 2년
* 거절된 정보: 90일 후 자동 삭제
* 회원 정보: 탈퇴 시 즉시 삭제

### B. 저작권법

**원칙:**
* 모든 콘텐츠는 원 작성자로부터 게시 승인 필수
* 출처 명시 및 원본 링크 제공
* "공정 이용" 범위 준수 (정보 제공 목적)

**표기 예시:**
```
출처: @gyeongnam_museum (Instagram)
원본: https://instagram.com/p/...
```

**신고 대응:**
* 삭제 요청 양식 웹사이트 공개
* 요청 시 24시간 내 즉시 삭제
* 삭제 확인 이메일 발송

### C. 이용약관

**면책조항:**
* "본 서비스는 행사 정보를 큐레이션하여 제공하나, 정보의 정확성/최신성을 보증하지 않습니다."
* "행사 일정/가격 변경 시 주최 측에 확인하시기 바랍니다."

**사용자 책임:**
* "최종 정보는 주최 기관에 확인 권장"
* "예매/참여로 인한 손해는 책임지지 않습니다."

**서비스 변경/중단:**
* "사전 공지 후 서비스 변경/중단 가능"
* "천재지변 등 불가항력 시 무통보 중단 가능"

### D. 사업자 등록

**필요성:**
* 광고 수익 발생 시 사업자 등록 필요
* 개인 사업자 또는 법인 선택

**세금:**
* 부가가치세 (광고 수익)
* 종합소득세 (사업 소득)

## 14. 부록 (Appendix)

### A. DM 템플릿 (상세)

#### 인스타그램용
```
안녕하세요, {작성자님}!
경남 아트 네비게이터(www.gyeongnam-art-navi.com) 운영자 Max입니다.

{작성자님}께서 올리신 {행사명} 정보가 많은 분들께 도움이 될 것 같아 연락드렸습니다.

저희는 경남 지역의 공연·전시·문화행사 정보를 한곳에 모아 소개하는 비영리 큐레이션 서비스입니다.

✅ 출처와 원본 링크를 함께 표기
✅ 언제든 삭제 요청 시 즉시 처리
✅ 비상업적 정보 제공 목적

해당 정보를 저희 웹사이트에 공유해도 괜찮으실까요?

회신 기다리겠습니다. 감사합니다!

---
경남 아트 네비게이터
www.gyeongnam-art-navi.com
```

#### 이메일용 (공공기관)
```
제목: [협조 요청] 경남 문화행사 정보 게재 허가

안녕하세요,
경남 아트 네비게이터(www.gyeongnam-art-navi.com) 운영팀입니다.

귀 기관에서 진행하시는 {행사명} 정보를 저희 플랫폼에 소개하고자 연락드립니다.

[서비스 소개]
- 경남 지역 문화예술 정보 통합 플랫폼
- 월 방문자 1,000명+ (성장 중)
- 비영리 큐레이션 서비스

[게재 내용]
- 행사 포스터, 제목, 일시, 장소
- 출처 표기 및 원본 링크 제공
- 예매 링크 연결 (있는 경우)

[기대 효과]
- 행사 홍보 효과 증대
- 젊은 세대 유입 확대
- 지역 문화 활성화 기여

게재에 문제가 없으시다면 회신 부탁드립니다.

감사합니다.

---
경남 아트 네비게이터 운영팀
이메일: admin@gyeongnam-art-navi.com
웹사이트: www.gyeongnam-art-navi.com
```

### B. 수집 대상 해시태그 (전체 목록)

#### 경남 전체
* #경남공연 #경남전시 #경남문화 #경남행사 #경남예술 #경남축제

#### 도시별
**창원:**
* #창원공연 #창원전시 #창원문화 #창원행사 #창원예술
* #마산공연 #마산전시 #진해공연 #진해전시

**김해:**
* #김해공연 #김해전시 #김해문화 #김해행사 #김해예술

**진주:**
* #진주공연 #진주전시 #진주문화 #진주행사 #진주예술

**통영:**
* #통영공연 #통영전시 #통영문화 #통영행사 #통영예술

**거제:**
* #거제공연 #거제전시 #거제문화 #거제행사

**양산:**
* #양산공연 #양산전시 #양산문화

**밀양:**
* #밀양공연 #밀양전시 #밀양문화

**함안:**
* #함안공연 #함안전시 #함안문화

#### 카테고리별
* #공연 #뮤지컬 #연극 #콘서트 #클래식
* #전시 #미술전시 #사진전 #현대미술
* #축제 #문화축제 #지역축제
* #강연 #토크콘서트 #북콘서트
* #체험 #문화체험 #예술체험

### C. 크롤링 대상 웹사이트 (전체 목록)

#### 문화재단
1. **경남문화재단**
   - URL: https://www.gncaf.or.kr
   - 대상: 공지사항, 행사 게시판

2. **창원문화재단**
   - URL: https://www.cscf.or.kr
   - 대상: 공연/전시 게시판

3. **김해문화재단**
   - URL: https://www.ghcf.or.kr
   - 대상: 문화행사 안내

4. **진주문화재단**
   - URL: https://www.jjcf.or.kr
   - 대상: 공연/전시 정보

#### 시청/구청
5. **창원시청 문화관광**
   - URL: https://www.changwon.go.kr
   - 대상: 문화행사 게시판

6. **김해시청 문화체육**
   - URL: https://www.gimhae.go.kr
   - 대상: 문화행사 안내

7. **진주시청 문화관광**
   - URL: https://www.jinju.go.kr
   - 대상: 축제/행사 정보

#### 공연장/미술관
8. **경남도립미술관**
   - URL: https://www.gam.go.kr
   - 대상: 전시 일정

9. **성산아트홀**
   - URL: https://www.ssart.or.kr
   - 대상: 공연 일정

10. **3·15아트센터**
    - URL: https://www.315art.org
    - 대상: 공연/전시 일정

### D. 환경 변수 (Environment Variables)

```bash
# .env.example

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Instagram
INSTAGRAM_USERNAME=your_crawler_account
INSTAGRAM_PASSWORD=your_password
INSTAGRAM_SESSION_COOKIE=sessionid=xxx

# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789

# AWS (Optional)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=ap-northeast-2

# Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# App Config
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.gyeongnam-art-navi.com
```

### E. 참고 자료

#### 기술 문서
* **Playwright:** https://playwright.dev/python/
* **Supabase:** https://supabase.com/docs
* **Next.js 14:** https://nextjs.org/docs
* **Streamlit:** https://docs.streamlit.io
* **Python Telegram Bot:** https://python-telegram-bot.org

#### 법률/규정
* **개인정보 보호법:** https://www.law.go.kr
* **저작권법:** https://www.copyright.or.kr
* **전자상거래법:** https://www.ftc.go.kr

#### 유사 서비스
* **공연 플레이:** https://www.playdb.co.kr
* **인터파크 티켓:** https://ticket.interpark.com
* **아트앤가이드:** http://www.artguide.co.kr

---

## 문서 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2026-01-01 | Max | 초안 작성 |
| 1.1.0 | 2026-01-01 | Claude | 상세 보완 (기술 스택, API, 로드맵 등) |

---

**문서 종료**

이 PRD는 프로젝트 진행 상황에 따라 지속적으로 업데이트됩니다.
최신 버전은 항상 Git 저장소에서 확인하세요.
