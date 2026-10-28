# Collector 실행 가이드

## 🔍 문제 진단

### 수동 크롤링이 작동하지 않는 이유

**원인**: Collector 서비스(`main.py`)가 실행되지 않음

웹 인터페이스에서 "실행" 버튼을 클릭하면:
1. `crawl_logs` 테이블에 `status=REQUESTED` 레코드 생성
2. **Collector가 10초마다 확인**하여 REQUESTED 상태 감지
3. Collector가 크롤링 실행

❌ **Collector가 실행되지 않으면** → REQUESTED 상태만 남고 아무 일도 일어나지 않음

---

## ✅ 해결 방법

### 1. Collector 실행 (Windows)

**방법 A: 배치 파일 사용 (추천)**
```bash
cd E:\developement\pick-art\collector
start_collector.bat
```

**방법 B: 수동 실행**
```bash
cd E:\developement\pick-art\collector
python -u main.py
```

### 2. 실행 확인

Collector가 정상 실행되면 다음과 같은 메시지가 표시됩니다:

```
================================================================================
🎨 Gyeongnam Art Navigator - Collector Service
================================================================================
⏰ Started at: 2026-01-04 02:30:12
🔄 Checking for manual requests every 10 seconds...
📅 Scheduled crawls: 04:00 and 18:00 daily
================================================================================

✅ Scheduler started. Waiting for requests...
```

### 3. 수동 크롤링 테스트

1. http://localhost:3000/admin/sources 접속
2. 김해서부문화센터 항목에서 "실행" 버튼 클릭
3. **페이지 상단의 로그 영역 확인** (2초마다 자동 갱신)

예상 로그:
```
============================================================
🔔 [Manual Request] Detected: 김해서부문화센터
🔔 [Manual Request] Log ID: 11
============================================================
✅ [Manual Request] Status updated to RUNNING
✅ [Manual Request] Source found in whitelist
🚀 [Manual Request] Starting crawler...

[Scraper] 🎯 Target: 김해서부문화센터
[Scraper] 📊 Found 3 items
[Scraper] ✅ 수집 완료: 발견 3건 (신규 0, 중복 3, 실패 0)
```

---

## 🎨 새로운 UI 기능

### 페이지 내 실시간 로그 표시

출처 관리 페이지에서 로그를 실시간으로 확인할 수 있습니다:

#### 1. **크롤링 진행 중 알림** (상단)
- RUNNING 또는 REQUESTED 상태의 크롤링이 있으면 파란색 Alert 박스 표시
- 진행 중인 작업과 상태를 실시간으로 표시
- 애니메이션 프로그레스 바

#### 2. **최근 크롤링 로그** (중앙)
- 최근 5개의 크롤링 로그를 타임라인으로 표시
- 2초마다 자동 갱신
- 상태별 색상 코드:
  - 🟢 SUCCESS (초록색)
  - 🔴 FAIL (빨간색)
  - 🔵 RUNNING (파란색, 회전 아이콘)
  - 🟡 REQUESTED (노란색)
- "새로고침" 버튼으로 수동 갱신 가능

#### 3. **상세 정보 표시**
- 크롤링 대상 이름
- 시작 시간
- 완료 시간 (완료된 경우)
- 결과 요약
- 에러 메시지 (실패한 경우)

---

## ⚙️ Collector 설정

### 주요 설정

**확인 주기**: 10초마다 수동 요청 확인
```python
scheduler.add_job(check_manual_requests, 'interval', seconds=10)
```

**정기 크롤링**: 매일 04:00, 18:00
```python
scheduler.add_job(run_crawlers, 'cron', hour='4,18')
```

### 환경 변수

`.env.local` 파일에 다음 설정 필요:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## 🐛 문제 해결

### Q: Collector를 실행했는데 여전히 크롤링이 안됩니다

**A**: 다음을 확인하세요:

1. **Collector가 실행 중인지 확인**
```bash
tasklist | findstr python
```

2. **로그 확인**
```bash
cd E:\developement\pick-art\collector
type collector_log_new.txt
```

3. **Whitelist에 소스가 있는지 확인**
- Supabase → `whitelist` 테이블 확인
- 김해서부문화센터가 등록되어 있어야 함

### Q: "Source not found in whitelist" 에러

**A**: Whitelist 테이블에 소스를 추가하세요:
```sql
INSERT INTO whitelist (name, value, type, auto_publish)
VALUES ('김해서부문화센터', 'https://wgcc.ghct.or.kr/board/show01_01', 'website', true);
```

### Q: Collector 로그에 UnicodeEncodeError

**A**: Windows 콘솔 인코딩 문제 - 이미 수정됨 ([main.py:15-20](collector/main.py#L15-L20))

### Q: 크롤링은 되는데 인박스에 안 나타남

**A**: `auto_publish: true`인 경우:
- 인박스에 표시되지 않음 (자동 승인)
- Events 페이지에서 확인: http://localhost:3000/events

---

## 📊 크롤링 흐름

```
1. 사용자: "실행" 버튼 클릭
   ↓
2. Frontend: crawl_logs에 REQUESTED 생성
   ↓
3. Collector (10초마다): REQUESTED 감지
   ↓
4. Collector: 상태 → RUNNING 업데이트
   ↓
5. Collector: Whitelist에서 소스 찾기
   ↓
6. PublicScraper: 웹사이트 크롤링 시작
   ↓
7. PublicScraper: 각 항목 처리
   - 중복 체크
   - AI 분석
   - 이미지 업로드
   - Database 저장
   ↓
8. Database.save_raw_post():
   - Blacklist 체크
   - Whitelist 체크 (도메인 기반)
   - auto_publish=true → events 테이블에 자동 등록
   - auto_publish=false → raw_posts에 COLLECTED 저장
   ↓
9. Collector: 로그 업데이트 (SUCCESS/FAIL)
   ↓
10. Frontend: 로그 자동 갱신 (2초마다)
```

---

## 🚀 자동 실행 설정 (선택사항)

### Windows 작업 스케줄러 사용

1. 작업 스케줄러 열기
2. "기본 작업 만들기" 선택
3. 트리거: 시스템 시작 시
4. 작업: 프로그램 시작
   - 프로그램: `python.exe`
   - 인수: `-u E:\developement\pick-art\collector\main.py`
   - 시작 위치: `E:\developement\pick-art\collector`

### 서비스로 실행 (고급)

NSSM (Non-Sucking Service Manager) 사용:
```bash
nssm install PickArtCollector "python.exe" "-u E:\developement\pick-art\collector\main.py"
nssm start PickArtCollector
```

---

## 📝 관련 파일

- [main.py](collector/main.py) - Collector 메인 서비스
- [public_scraper.py](collector/public_scraper.py) - 웹 크롤러
- [database.py](collector/database.py) - DB 및 Whitelist 로직
- [page.tsx](frontend/src/app/admin/sources/page.tsx) - 출처 관리 UI
- [WHITELIST_FIX.md](WHITELIST_FIX.md) - Whitelist 매칭 수정 문서
- [TROUBLESHOOTING.md](collector/TROUBLESHOOTING.md) - 문제 해결 가이드
