# 프로필 필드 추가 가이드

## 추가된 필드

1. **phone** (TEXT) - 사용자 전화번호
2. **region** (TEXT) - 거주 지역
3. **interests** (TEXT[]) - 관심 분야 배열

## Supabase Studio에서 실행할 SQL

### 옵션 1: SQL Editor에서 직접 실행

1. Supabase Studio 열기: http://127.0.0.1:54321
2. 좌측 메뉴 → **SQL Editor** 클릭
3. **New query** 버튼 클릭
4. 아래 SQL 복사 & 붙여넣기:

```sql
-- Add phone, region, and interests fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS interests TEXT[];

-- Add comments
COMMENT ON COLUMN public.profiles.phone IS '사용자 전화번호';
COMMENT ON COLUMN public.profiles.region IS '거주 지역 (창원, 김해, 진주, 통영, 거제, 양산, 밀양, 함안, 기타)';
COMMENT ON COLUMN public.profiles.interests IS '관심 분야 (전시, 공연, 축제, 전통문화, 체험/교육)';
```

5. **Run** 버튼 클릭

### 옵션 2: 마이그레이션 파일 사용

마이그레이션 파일이 준비되어 있습니다:
- 위치: `supabase/migrations/20260101000001_add_user_profile_fields.sql`

## 업데이트된 페이지

### 1. 설정 페이지 (`/settings`)
- **전화번호**: 입력 필드
- **거주 지역**: 드롭다운 선택
- **관심 분야**: 다중 선택 버튼 (전시, 공연, 축제, 전통문화, 체험/교육)

### 2. 회원가입 페이지 (`/signup`)
- **전화번호**: 필수 입력
- **거주 지역**: 드롭다운 선택 (기본값: 창원)
- **관심 분야**: 다중 선택 버튼 (선택사항)

## 데이터 구조

```typescript
interface Profile {
  id: string;
  nickname: string;
  phone: string;          // 새로 추가
  region: string;         // 새로 추가 (기존 residence → region으로 변경)
  interests: string[];    // 새로 추가 (배열)
  email_notifications: boolean;
  new_event_notifications: boolean;
  created_at: string;
  updated_at: string;
}
```

## 지역 목록

- 창원
- 김해
- 진주
- 통영
- 거제
- 양산
- 밀양
- 함안
- 기타

## 관심 분야 목록

- 전시
- 공연
- 축제
- 전통문화
- 체험/교육

## 테스트

SQL 실행 후 다음을 확인하세요:

1. 회원가입 페이지에서 새 계정 생성
2. 설정 페이지에서 프로필 정보 수정
3. 전화번호, 지역, 관심분야가 정상적으로 저장되는지 확인

---

**작성일**: 2026-01-01
