# Setup Guide - AI Prompt Configuration

이 가이드는 AI 프롬프트 설정을 완료하는 방법을 안내합니다.

## 완료된 작업

### 1. ✅ AI 프롬프트 개선
- **이전**: 기본 프롬프트 (날짜 추측, 불명확한 규칙)
- **개선**: 한국어 이벤트 특화 프롬프트
  - 정확한 날짜 추출 (추측 금지)
  - 제목 정리 규칙 (이모지, 출처 제거)
  - 지역 추론 우선순위 명확화
  - 카테고리 분류 가이드라인
  - 태그 생성 규칙

### 2. ✅ Gemini 모델 업데이트
- **파일**: `collector/ai_extractor.py`
- **변경**: `gemini-1.5-flash` → `gemini-2.5-flash`
- **이유**: 더 나은 성능 및 최신 모델 사용

### 3. ✅ 데이터베이스 로딩 기능 추가
- **파일**: `collector/ai_extractor.py`
- **기능**: `_load_prompt_from_db()` 메서드 추가
- **우선순위**: Database > .env > Fallback

### 4. ✅ Admin 대시보드 UI 생성
- **파일**: `frontend/src/app/admin/ai-prompt/page.tsx`
- **기능**:
  - 실시간 프롬프트 편집 (textarea)
  - 저장 기능 (Supabase configs 테이블)
  - 기본값 복원 버튼
  - 글자 수 표시
  - 성공/실패 메시지

### 5. ✅ 이미지 업로드 버그 수정
- **파일**: `collector/utils.py`
- **수정**: 누락된 import 추가 (`io`, `datetime`)
- **결과**: 이미지가 이제 정상적으로 Supabase Storage에 업로드됩니다

## 남은 작업

### 🔧 Supabase configs 테이블 생성

configs 테이블이 아직 데이터베이스에 존재하지 않습니다. 다음 단계를 따라 생성하세요:

#### 방법 1: Supabase Studio (권장)

1. Supabase Studio 열기: http://127.0.0.1:54321
2. 좌측 메뉴 → **SQL Editor** 클릭
3. **New query** 버튼 클릭
4. 아래 SQL 복사 & 붙여넣기:

```sql
-- Create configs table for storing system configurations
CREATE TABLE IF NOT EXISTS public.configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert improved AI prompt
INSERT INTO configs (key, value, description)
VALUES (
    'ai_prompt',
    'Role: You are an expert Cultural Event Information Extractor specialized in Korean cultural events.

Task: Analyze the provided text and image (poster) to extract structured event data with high accuracy.

CRITICAL RULES:
1. Extract information EXACTLY as written - do not invent or guess dates/times/prices
2. If information is missing, use null (NOT "정보 없음" or empty strings)
3. Dates MUST be in YYYY-MM-DD format or null
4. Title should be clean and descriptive (remove emoji, remove source prefixes like "[페이스북]")
5. Description should preserve original formatting and line breaks
6. Region inference priority: venue name > address > context clues

Extraction Guidelines:

**Title Extraction:**
- Remove source indicators: "[Facebook]" "[Instagram]" "@username"
- Remove excessive emoji (keep 1-2 if meaningful)
- Example: "🎨[경남문화재단] 봄맞이 전시회" → "봄맞이 전시회"

**Date/Time Extraction:**
- Look for: "YYYY.MM.DD", "MM월 DD일", "~까지", "부터"
- If range: extract both date_start and date_end
- If single day: date_start = date_end
- If no date found: null (DO NOT guess)

**Venue & Region:**
- venue: Specific place name ("경남도립미술관", "성산아트홀")
- region: City from [창원, 김해, 진주, 통영, 거제, 양산, 밀양, 함안, 기타]
- Inference: "창원 성산아트홀" → region: "창원", venue: "성산아트홀"

**Category Classification:**
Choose EXACTLY ONE from: [전시, 공연, 축제, 전통문화, 체험/교육, 기타]
- 전시: 미술, 사진, 조각 등 전시회
- 공연: 연극, 뮤지컬, 콘서트, 무용
- 축제: 지역 축제, 문화제
- 전통문화: 국악, 전통예술
- 체험/교육: 워크샵, 강연, 교육 프로그램

**Price Information:**
- is_free: true if "무료", "입장료 없음", "free"
- price_details: Exact text ("5,000원", "성인 10,000원 / 청소년 5,000원")

**Tags Generation:**
Create 5 relevant hashtags:
- 1 region tag: "#창원" "#김해"
- 1-2 category tags: "#전시" "#공연" "#축제"
- 2-3 theme/audience tags: "#가족" "#주말" "#무료" "#현대미술"

Required JSON Output:
{
    "title": "string",
    "description": "string",
    "category": "전시|공연|축제|전통문화|체험/교육|기타",
    "region": "창원|김해|진주|통영|거제|양산|밀양|함안|기타",
    "venue": "string or null",
    "date_start": "YYYY-MM-DD or null",
    "date_end": "YYYY-MM-DD or null",
    "is_free": boolean,
    "price_details": "string or null",
    "contact": "string or null",
    "organizer": "string or null",
    "tags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

Return ONLY valid JSON. No markdown, no explanations, no extra text.',
    'Gemini AI prompt for extracting cultural event metadata'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

5. **Run** 버튼 클릭

#### 방법 2: Node.js 스크립트

테이블 생성 후 실행:

```bash
node create_table_and_init.mjs
```

## 사용 방법

### Admin 대시보드에서 프롬프트 편집

1. 서버 실행 중인지 확인:
   ```bash
   npm run dev  # Frontend
   ```

2. 브라우저에서 Admin 대시보드 열기:
   ```
   http://localhost:3000/admin/ai-prompt
   ```

3. 프롬프트 편집 및 저장

4. 크롤러가 다음 실행 시 자동으로 새 프롬프트 사용

### 프롬프트 로딩 우선순위

AI Extractor는 다음 순서로 프롬프트를 로드합니다:

1. **Supabase configs 테이블** (최우선)
2. `.env.local` 파일의 `AI_PROMPT` 변수
3. 코드 내 Fallback 프롬프트

## 테스트

### 1. configs 테이블 확인

```bash
node -e "const {createClient} = require('@supabase/supabase-js'); const s = createClient('http://127.0.0.1:54321', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'); s.from('configs').select('*').then(r => console.log(r.data));"
```

### 2. Gemini API 테스트

```bash
cd collector
python -c "import os; os.environ['NEXT_PUBLIC_GEMINI_API_KEY']='AIzaSyDOLSkl-xKnocyCJTH3x1NYg1uGvckCRFo'; import google.generativeai as genai; genai.configure(api_key=os.getenv('NEXT_PUBLIC_GEMINI_API_KEY')); m=genai.GenerativeModel('gemini-2.5-flash'); print(m.generate_content('Say hi').text)"
```

## 주요 파일 위치

| 파일 | 경로 | 용도 |
|------|------|------|
| AI Extractor | `collector/ai_extractor.py` | AI 메타데이터 추출 로직 |
| Admin UI | `frontend/src/app/admin/ai-prompt/page.tsx` | 프롬프트 편집 페이지 |
| SQL | `create_configs_table.sql` | configs 테이블 생성 SQL |
| Setup Script | `create_table_and_init.mjs` | 테이블 확인 & 초기화 스크립트 |

## 트러블슈팅

### "Could not find the table 'public.configs'"
→ Supabase Studio에서 SQL을 실행하여 테이블을 생성하세요 (위 방법 1 참조)

### "Gemini API 429 error"
→ Gemini API 결제 등록 완료 후 몇 분 기다리면 해결됩니다

### "Image upload fails"
→ utils.py의 import 수정이 완료되었습니다. 다시 크롤링해보세요

### Admin 페이지 접속 안 됨
→ Frontend 서버가 실행 중인지 확인 (`npm run dev`)

## 다음 단계

1. ✅ Supabase Studio에서 SQL 실행 (configs 테이블 생성)
2. Admin 대시보드에서 프롬프트 확인 및 필요시 수정
3. Facebook 크롤러 실행하여 새 프롬프트 테스트
4. 결과 확인 (Inbox에서 AI Suggestion 품질 체크)

---

**작성일**: 2026-01-01
**작성자**: Claude Code Assistant
