# 🔧 문제 해결 가이드

## 해결된 주요 문제

### ❌ 문제: 크롤링은 성공하지만 인박스에 데이터가 안 보임

**증상**:
- 로그에서 "크롤링 완료: 1건 성공" 표시
- 인박스에 데이터가 없음
- raw_posts 테이블에도 데이터가 없음

**원인**:
```
❌ [DB:Error] Could not find the 'poster_thumbnail_url' column of 'raw_posts'
```

**해결**:
`poster_thumbnail_url` 필드를 `post_data`에서 제거 ([public_scraper.py:159-170](public_scraper.py#L159-L170))

### ❌ 문제: 로그가 실시간으로 안 보임

**원인**:
Python의 출력 버퍼링 때문에 로그가 지연됨

**해결**:
1. `sys.stdout.reconfigure(line_buffering=True)` 추가 ([main.py:14-16](main.py#L14-L16))
2. 모든 print에 `flush=True` 추가
3. `python -u` 플래그로 unbuffered 모드 실행

### ❌ 문제: 크롤링 작업이 RUNNING 상태로 멈춤

**원인**:
데이터베이스 저장 에러로 인해 크롤링이 중단되었지만 로그 상태가 업데이트되지 않음

**해결**:
에러를 수정하고 RUNNING 상태의 로그를 수동으로 정리

## 빠른 테스트 방법

### 1. 직접 크롤링 테스트
```bash
cd collector
python test_wgcc_direct.py
```

예상 결과:
```
✅ [DB] Saved to raw_posts: ID=xxx, Status=COLLECTED
✅ Database save successful - raw_posts table updated
[Scraper] ✅ 수집 완료: 발견 3건 (신규 3, 중복 0, 실패 0)
```

### 2. 데이터베이스 확인
```bash
cd collector
python verify_crawl.py
```

확인 사항:
- ✅ raw_posts에 서부문화센터 데이터 있는지
- ✅ status가 COLLECTED인지
- ✅ 인박스 표시 대상 개수

### 3. 인박스 확인
http://localhost:3000/admin/inbox 접속

- "검토 대기" 탭에서 서부문화센터 데이터 확인

## 현재 작동 방식

### 크롤링 → 인박스 흐름

1. **수동 크롤링 요청** (http://localhost:3000/admin/sources)
   - crawl_logs 테이블에 REQUESTED 상태로 기록

2. **Collector 감지** (10초마다 체크)
   ```
   🔔 [Manual Request] Detected: 김해서부문화센터
   ✅ [Manual Request] Status updated to RUNNING
   ```

3. **크롤링 실행**
   ```
   [Scraper] 📊 Found 3 items
   [Scraper] 🔄 Processing 3 items...
   ```

4. **각 항목 처리**
   ```
   [1/3] 🎭 Title: ...
   [1/3] 🔍 Fetching detail page...
        📥 Fetching HTML
        📝 Content extracted
        🖼️ Found images
        🤖 Running AI metadata extraction
        📤 Uploading image to storage
        💾 Saving to database (status: COLLECTED)
        ✅ [DB] Saved to raw_posts: ID=xxx, Status=COLLECTED
   [1/3] ✅ Successfully saved to database
   ```

5. **완료**
   ```
   [Scraper] ✅ 수집 완료: 발견 3건 (신규 3, 중복 0, 실패 0)
   ```

6. **인박스 표시**
   - status="COLLECTED" 또는 "PENDING"인 항목만 표시
   - http://localhost:3000/admin/inbox "검토 대기" 탭

## Collector 실행 방법

### Windows (추천)
```bash
cd collector
start_collector.bat
```

### 수동 실행
```bash
cd collector
python -u main.py
```

### 백그라운드 실행 (비추천 - 로그 안 보임)
```bash
cd collector
python main.py &
```

## 로그 확인 위치

### 실시간 로그
- **Collector 실행 창**: 가장 상세한 로그
- **watch_logs.py**: crawl_logs 테이블 모니터링

### 사후 확인
- **verify_crawl.py**: 전체 시스템 상태 확인
- **Supabase Dashboard**: raw_posts, crawl_logs 테이블 직접 확인

## 자주 발생하는 문제

### Q: "로그가 안 보여요"
**A**: Collector를 재시작하세요
```bash
cd collector
start_collector.bat
```

### Q: "크롤링 로그에 SUCCESS 나오는데 인박스에 없어요"
**A**: test_wgcc_direct.py로 실제 에러 확인
```bash
python test_wgcc_direct.py
```

에러가 있다면 로그에서 `❌ [DB:Error]` 확인

### Q: "RUNNING 상태로 멈췄어요"
**A**: Collector가 크래시된 것입니다. 재시작하세요.

### Q: "중복으로 건너뛰어요"
**A**: 정상입니다. 이미 수집된 데이터는 다시 수집하지 않습니다.

## 성공 체크리스트

크롤링이 성공하려면:

1. ✅ Collector 실행 중
2. ✅ Whitelist에 소스 등록
3. ✅ 수동 크롤링 요청
4. ✅ 10초 이내에 Manual Request 감지
5. ✅ 크롤링 시작
6. ✅ 아이템 발견
7. ✅ AI 분석 완료
8. ✅ 이미지 업로드 완료
9. ✅ DB 저장 성공 (Status: COLLECTED)
10. ✅ 인박스에 표시

모든 단계가 성공하면:
```
✅ [DB] Saved to raw_posts: ID=xxx, Status=COLLECTED
```

이 메시지를 봐야 합니다!
