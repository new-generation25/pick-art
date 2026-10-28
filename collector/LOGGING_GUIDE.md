# 🔍 크롤러 로깅 가이드

## 실시간 로그 확인 방법

### 방법 1: Collector 직접 실행 (추천)

가장 상세한 실시간 로그를 볼 수 있습니다.

```bash
cd collector

# Windows
start_collector.bat

# Linux/Mac
python -u main.py
```

**출력 예시:**
```
================================================================================
🎨 Gyeongnam Art Navigator - Collector Service
================================================================================
⏰ Started at: 2025-01-04 14:30:00
🔄 Checking for manual requests every 10 seconds...
📅 Scheduled crawls: 04:00 and 18:00 daily
================================================================================

✅ Scheduler started. Waiting for requests...

============================================================
🔔 [Manual Request] Detected: 서부문화센터
🔔 [Manual Request] Log ID: abc-123-xyz
============================================================
✅ [Manual Request] Status updated to RUNNING
✅ [Manual Request] Source found in whitelist: 서부문화센터
🚀 [Manual Request] Starting crawler...

============================================================
[Scraper] 🎯 Target: 서부문화센터
[Scraper] 🔗 URL: https://wgcc.ghct.or.kr/board/show01_01
[Scraper] 📋 Log ID: abc-123-xyz
============================================================
[Scraper] 🏛️ WGCC mode activated
[Scraper] 📊 Found 10 items using selector 'ul.img_list li'
[Scraper] 🔄 Processing 10 items...

  [1/10] 🎭 Title: 2025 신년음악회...
  [1/10] 🔗 URL: https://wgcc.ghct.or.kr/board/detail/show01_01/123
  [1/10] 🔍 Fetching detail page...
      📥 Fetching HTML from: https://...
      📝 Content extracted: 1234 characters
      🖼️ Found 2 images
      🤖 Running AI metadata extraction...
      🤖 AI suggestion: category=공연, region=김해
      📤 Uploading image to storage...
      ✅ Image uploaded: thumbnail=True, poster=True
      💾 Saving to database (status: COLLECTED)...
        💾 [DB] save_raw_post called for: 2025 신년음악회...
        💾 [DB] Source: 서부문화센터, URL: https://...
        📋 [DB] Status determined: COLLECTED
        💾 [DB] Upserting to raw_posts table...
        ✅ [DB] Saved to raw_posts: ID=xyz789, Status=COLLECTED
      ✅ Database save successful - raw_posts table updated
      📊 Saved with ID: xyz789, Status: COLLECTED
  [1/10] ✅ Successfully saved to database

============================================================
[Scraper] ✅ 수집 완료: 발견 10건 (신규 3, 중복 7, 실패 0)
============================================================
```

### 방법 2: 로그 모니터 사용

크롤링 로그(crawl_logs 테이블)를 실시간으로 모니터링합니다.

```bash
cd collector
python watch_logs.py
```

**출력 예시:**
```
================================================================================
📺 크롤링 로그 모니터 - 업데이트: 14:30:45
================================================================================

🔄 [RUNNING] 서부문화센터
   Started: 2025-01-04T14:30:00
   --------------------------------------------------------------------------

✅ [SUCCESS] 김해문화재단
   Started: 2025-01-04T14:25:00
   Finished: 2025-01-04T14:25:30
   Result: ✅ 수집 완료: 발견 5건 (신규 2, 중복 3, 실패 0)
   --------------------------------------------------------------------------

🔄 현재 진행 중: 1개
================================================================================
```

### 방법 3: 검증 스크립트

크롤링 결과를 한 번에 확인합니다.

```bash
cd collector
python verify_crawl.py
```

## 로그 레벨 이해하기

### 이모지 아이콘

| 이모지 | 의미 |
|--------|------|
| 🎯 | 타겟 설정 |
| 🔗 | URL 정보 |
| 📋 | 로그 ID |
| 🏛️ | WGCC 모드 활성화 |
| 📊 | 통계 정보 |
| 🔄 | 진행 중 |
| 🎭 | 제목 |
| 🔍 | 페이지 가져오기 |
| 📥 | HTML 다운로드 |
| 📝 | 컨텐츠 추출 |
| 🖼️ | 이미지 발견 |
| 🤖 | AI 분석 |
| 📤 | 이미지 업로드 |
| 💾 | 데이터베이스 저장 |
| ✅ | 성공 |
| ❌ | 실패 |
| ⚠️ | 경고 |
| ⏭️ | 건너뛰기 (중복) |
| 🚫 | 차단됨 (블랙리스트) |

### 로그 태그

- `[Manual Request]`: 수동 크롤링 요청 처리
- `[Scraper]`: 크롤러 메인 로직
- `[DB]`: 데이터베이스 작업
- `[DB:Blacklist]`: 블랙리스트 체크
- `[DB:Whitelist]`: 화이트리스트 체크
- `[DB:Duplicate]`: 중복 체크
- `[DB:Auto-publish]`: 자동 발행

## 문제 해결

### 로그가 안 보일 때

1. **Collector가 실행 중인지 확인**
   ```bash
   # Windows
   tasklist | findstr python

   # Linux/Mac
   ps aux | grep python
   ```

2. **Collector 재시작**
   ```bash
   cd collector
   # 기존 프로세스 종료 후
   start_collector.bat  # Windows
   python -u main.py    # Linux/Mac
   ```

3. **환경 변수 확인**
   `.env.local` 파일에 Supabase 설정이 있는지 확인

### 크롤링이 진행 안 될 때

1. **수동 요청 확인**
   - http://localhost:3000/admin/sources 에서 크롤링 실행
   - 10초 이내에 로그에 `[Manual Request] Detected` 메시지 표시되어야 함

2. **Whitelist 확인**
   ```bash
   python verify_crawl.py
   ```
   - 1번 섹션에서 whitelist에 소스가 등록되어 있는지 확인

3. **로그 확인**
   ```bash
   python watch_logs.py
   ```
   - 에러 메시지가 있는지 확인

## 디버깅 팁

### 상세 디버그 모드

더 상세한 로그가 필요하면 각 파일의 print 문에 추가 정보를 넣을 수 있습니다.

### 성공적인 크롤링 체크리스트

1. ✅ Collector 실행 중
2. ✅ Manual request 감지됨
3. ✅ Whitelist에서 소스 발견
4. ✅ 크롤러 시작
5. ✅ 아이템 발견 (Found X items)
6. ✅ 상세 페이지 가져오기
7. ✅ AI 분석 완료
8. ✅ 이미지 업로드 완료
9. ✅ DB 저장 성공 (Status: COLLECTED)
10. ✅ 인박스에 표시됨

### 로그 파일로 저장

실시간 로그를 파일로 저장하려면:

```bash
# Windows
python -u main.py > logs.txt 2>&1

# Linux/Mac
python -u main.py 2>&1 | tee logs.txt
```
