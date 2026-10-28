# 서부문화센터 자동 분류 기능

## 🎯 자동 설정 항목

서부문화센터(wgcc.ghct.or.kr)에서 가져온 데이터는 다음과 같이 자동 설정됩니다:

### 1. **제목 정리**
- `[기획]`, `[특별]`, `[공모]` 등의 분류 태그 자동 제거
- 예시:
  - 원본: `[기획] 뮤지컬 <인사이드 윌리엄>`
  - 정리 후: `뮤지컬 <인사이드 윌리엄>`

### 2. **지역 자동 설정**
- **지역**: 김해

### 3. **카테고리 자동 설정**
- **카테고리**: 공연

### 4. **장소 자동 설정**
- **장소**: 김해서부문화센터

## 📝 적용 위치

### 크롤러 (수집 시점)
- 파일: [public_scraper.py:145-161](collector/public_scraper.py#L145-L161)
- 제목 정리: 정규식 `^\[.*?\]\s*` 패턴 제거
- 지역/카테고리: AI 분석 후 강제 설정

```python
# 제목 정리
clean_title = re.sub(r'^\[.*?\]\s*', '', title).strip()

# 서부문화센터 자동 분류
if is_wgcc:
    ai_suggestion['region'] = '김해'
    ai_suggestion['category'] = '공연'
```

### 인박스 편집 모달
- 파일: [page.tsx:108-132](frontend/src/app/admin/inbox/page.tsx#L108-L132)
- 검토 화면 열 때 자동 적용

```typescript
// 서부문화센터 판별
const isWGCC = post.source === '김해서부문화센터' ||
               post.source_url.includes('wgcc.ghct.or.kr');

// 제목 정리 함수
const cleanTitle = (title: string) => {
    return title.replace(/^\[.*?\]\s*/g, '').trim();
};

// 자동 설정
{
    title: cleanTitle(rawTitle),
    category: isWGCC ? "공연" : ...,
    region: isWGCC ? "김해" : ...,
    venue: isWGCC ? "김해서부문화센터" : ...
}
```

## 🧪 테스트 방법

### 1. 새 데이터 수집
```bash
cd collector
python test_wgcc_direct.py
```

확인 사항:
```
✂️ Title cleaned: '[기획] 뮤지컬 <인사이드 윌리엄>' → '뮤지컬 <인사이드 윌리엄>'
🏛️ WGCC auto-classification: region=김해, category=공연
```

### 2. 인박스에서 확인
1. http://localhost:3000/admin/inbox 접속
2. 서부문화센터 항목 "검토" 클릭
3. 확인 사항:
   - ✅ 제목에서 `[기획]` 등이 제거됨
   - ✅ 지역: 김해
   - ✅ 카테고리: 공연
   - ✅ 구체적 장소: 김해서부문화센터

## 📊 제목 정리 패턴

정규식: `^\[.*?\]\s*`

제거되는 패턴:
- `[기획]` → 제거
- `[특별]` → 제거
- `[공모]` → 제거
- `[기획전]` → 제거
- `[무료]` → 제거

예시:
```
[기획] 뮤지컬 → 뮤지컬
[특별]크리스마스 콘서트 → 크리스마스 콘서트
[기획] 오페라 <라보엠> → 오페라 <라보엠>
```

## 🔄 기존 데이터

기존에 수집된 데이터는:
- **크롤러**: 정리되지 않은 상태로 저장됨
- **인박스**: 편집 모달 열 때 자동으로 정리됨

새로 수집되는 데이터는:
- **크롤러**: 수집 시점부터 정리됨
- **인박스**: 이미 정리된 상태로 표시됨

## ⚙️ 커스터마이징

### 다른 공연장 추가

다른 공연장도 같은 방식으로 설정하려면:

1. **크롤러** ([public_scraper.py:155-159](collector/public_scraper.py#L155-L159)):
```python
is_specific_venue = 'venue-domain.com' in url
if is_specific_venue:
    ai_suggestion['region'] = '원하는_지역'
    ai_suggestion['category'] = '원하는_카테고리'
```

2. **인박스** ([page.tsx:112-113](frontend/src/app/admin/inbox/page.tsx#L112-L113)):
```typescript
const isSpecificVenue = post.source === '공연장명' ||
                        post.source_url.includes('venue-domain.com');
```

### 제목 정리 패턴 추가

더 많은 패턴을 제거하려면:

```python
# 예: 괄호 안 내용도 제거
clean_title = re.sub(r'^\[.*?\]\s*|\(.*?\)\s*', '', title).strip()
```

```typescript
// 프론트엔드도 동일하게
return title.replace(/^\[.*?\]\s*|\(.*?\)\s*/g, '').trim();
```
