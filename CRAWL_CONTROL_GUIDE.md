# 크롤링 제어 기능 가이드

## ✅ 구현된 기능

### 1. 중복 실행 방지

**문제**: 같은 소스에 대해 여러 번 "실행" 버튼을 클릭하면 중복 크롤링 발생

**해결**:

#### Backend ([main.py:67-134](collector/main.py#L67-L134))
```python
# 이미 RUNNING 상태인 대상 확인
running_targets = [log['target_name'] for log in running_check.data]

# 중복 실행 방지
if req['target_name'] in running_targets:
    # REQUESTED → CANCELLED로 변경
    db.supabase.table("crawl_logs").update({
        "status": "CANCELLED",
        "result_summary": "이미 실행 중인 크롤링이 있어 취소됨"
    }).eq("id", req['id']).execute()
```

#### Frontend ([page.tsx:122-145](frontend/src/app/admin/sources/page.tsx#L122-L145))
```typescript
// "실행" 버튼 클릭 전 확인
const isRunning = logs.some(log =>
    (log.status === 'RUNNING' || log.status === 'REQUESTED') &&
    log.target_name === (item.name || item.value)
);

if (isRunning) {
    alert(`이미 크롤링이 진행 중입니다.`);
    return;
}
```

### 2. 크롤링 중지 기능

**기능**: 진행 중인 크롤링을 수동으로 중지

#### Frontend ([page.tsx:147-162](frontend/src/app/admin/sources/page.tsx#L147-L162))
```typescript
const handleStopCrawl = async (logId: string, targetName: string) => {
    await supabase.from('crawl_logs').update({
        status: 'CANCELLED',
        result_summary: '사용자가 수동으로 중지함',
        finished_at: new Date().toISOString()
    }).eq('id', logId);
};
```

#### UI 위치
- 파란색 "크롤링 진행 중" Alert 박스 내
- 각 진행 중인 크롤링 우측에 빨간색 "중지" 버튼 표시
- 버튼 클릭 → 확인 다이얼로그 → CANCELLED 상태로 변경

### 3. 상태 표시 개선

**새로운 상태**: CANCELLED (회색, 정지 아이콘)

**전체 상태 목록**:
- 🟢 **SUCCESS** - 크롤링 성공 완료
- 🔴 **FAIL** - 크롤링 실패
- 🔵 **RUNNING** - 실행 중 (회전 아이콘)
- 🟡 **REQUESTED** - 실행 대기 중
- ⚪ **CANCELLED** - 중지됨 (중복 또는 사용자 중지)

---

## 🎯 사용 방법

### 크롤링 실행

1. http://localhost:3000/admin/sources 접속
2. 원하는 소스의 "실행" 버튼 클릭
3. 로그 영역에서 진행 상황 확인

**중복 실행 시도 시**:
- Frontend: "이미 크롤링이 진행 중입니다" 알림 표시
- Backend: REQUESTED → CANCELLED 자동 변경

### 크롤링 중지

1. 파란색 "크롤링 진행 중" Alert 박스 확인
2. 중지할 크롤링 우측의 빨간색 "중지" 버튼 클릭
3. 확인 다이얼로그에서 "확인" 클릭
4. 상태가 CANCELLED로 변경됨

**주의**:
- 이미 실행 중인 Python 프로세스를 강제 종료하지는 않습니다
- DB 상태만 CANCELLED로 변경하여 새로운 요청이 처리되지 않도록 합니다
- Collector는 다음 확인 주기(10초)에 CANCELLED 상태를 감지하고 건너뜁니다

---

## 📊 크롤링 흐름도

### 정상 실행
```
1. 사용자: "실행" 버튼 클릭
   ↓
2. Frontend: RUNNING 상태 확인 (없음)
   ↓
3. Frontend: REQUESTED 상태 생성
   ↓
4. Collector (10초마다): REQUESTED 감지
   ↓
5. Collector: 동일 target_name의 RUNNING 확인
   ↓
6. 없으면: RUNNING으로 변경 → 크롤링 시작
   있으면: CANCELLED로 변경 → 건너뛰기
   ↓
7. 크롤링 완료: SUCCESS/FAIL 상태로 변경
```

### 중복 실행 시도 (Frontend 차단)
```
1. 사용자: "실행" 버튼 클릭
   ↓
2. Frontend: RUNNING 또는 REQUESTED 상태 확인 (있음)
   ↓
3. Frontend: 알림 표시 후 종료
   ❌ DB에 REQUESTED 생성하지 않음
```

### 중복 실행 시도 (Backend 차단)
```
1. Frontend 확인 우회하여 REQUESTED 생성
   ↓
2. Collector: REQUESTED 감지
   ↓
3. Collector: 동일 target_name의 RUNNING 확인 (있음)
   ↓
4. Collector: REQUESTED → CANCELLED 변경
   ✅ "이미 실행 중인 크롤링이 있어 취소됨"
```

### 사용자 중지
```
1. 사용자: "중지" 버튼 클릭
   ↓
2. Frontend: CANCELLED 상태로 변경
   ↓
3. UI: 진행 중 Alert에서 제거됨
   ↓
4. Collector: 다음 확인 시 CANCELLED 무시
```

---

## 🔧 설정 및 커스터마이징

### 확인 주기 조정

**기본값**: 10초마다 확인

변경 방법 ([main.py:147](collector/main.py#L147)):
```python
# 5초로 변경
scheduler.add_job(check_manual_requests, 'interval', seconds=5)
```

### 동시 실행 제한

현재는 **같은 대상에 대해서만** 중복 실행을 방지합니다.

**서로 다른 소스는 동시 실행 가능**:
- ✅ 김해서부문화센터 + 경남문화예술진흥원 → 동시 실행 가능
- ❌ 김해서부문화센터 + 김해서부문화센터 → 중복 차단

**전체 동시 실행 제한**을 원하면:
```python
# main.py에서
running_count = len(running_check.data) if running_check.data else 0
if running_count >= 3:  # 최대 3개까지만 동시 실행
    print(f"⏭️ [Manual Request] Max concurrent crawls (3) reached, skipping")
    # CANCELLED 처리
```

---

## 🐛 문제 해결

### Q: 중지 버튼을 눌렀는데 크롤링이 계속됩니다

**A**: 이미 실행 중인 Python 프로세스는 계속 실행됩니다.
- CANCELLED 상태 변경은 **새로운 요청을 차단**하는 용도
- 실행 중인 프로세스를 강제 종료하려면 Collector 재시작 필요

### Q: 중복 차단이 작동하지 않습니다

**A**: 다음을 확인하세요:
1. **Frontend 확인**:
   - 로그가 2초마다 갱신되는지 확인 (`useEffect` interval)
   - Browser Console에서 logs 상태 확인

2. **Backend 확인**:
   - Collector 로그에서 "already running" 메시지 확인
   - `crawl_logs` 테이블에서 CANCELLED 상태 확인

### Q: CANCELLED 상태 로그가 계속 쌓입니다

**A**: 정상 동작입니다. 로그를 주기적으로 정리하려면:

```python
# 30일 이상 지난 로그 자동 삭제 (main.py에 추가)
async def cleanup_old_logs():
    db = Database()
    from datetime import timedelta
    cutoff = (datetime.now() - timedelta(days=30)).isoformat()
    db.supabase.table("crawl_logs").delete().lt("started_at", cutoff).execute()

# 매일 04:00에 실행
scheduler.add_job(cleanup_old_logs, 'cron', hour='4')
```

---

## 📝 테스트 시나리오

### 1. 중복 실행 방지 테스트

```bash
# 1. Collector 실행
cd E:\developement\pick-art\collector
python -u main.py

# 2. 브라우저에서 http://localhost:3000/admin/sources 접속

# 3. 김해서부문화센터 "실행" 버튼 클릭 (첫 번째)
# 예상: REQUESTED → RUNNING 상태로 변경

# 4. 즉시 다시 "실행" 버튼 클릭 (두 번째)
# 예상: Frontend에서 "이미 크롤링이 진행 중입니다" 알림

# 5. 만약 우회하여 REQUESTED 생성 시
# 예상: Collector가 CANCELLED로 자동 변경
```

### 2. 크롤링 중지 테스트

```bash
# 1. 크롤링 시작 (위와 동일)

# 2. 파란색 Alert 박스에서 "중지" 버튼 클릭

# 3. 확인 다이얼로그에서 "확인" 클릭

# 4. 예상 결과:
#    - Alert 박스에서 사라짐
#    - 최근 로그에 CANCELLED 상태로 표시
#    - result_summary: "사용자가 수동으로 중지함"
```

### 3. 동시 실행 테스트

```bash
# 1. 서로 다른 소스 2개 동시 실행
#    - 김해서부문화센터 "실행"
#    - 경남문화예술진흥원 "실행"

# 2. 예상 결과:
#    - 둘 다 RUNNING 상태로 표시
#    - Alert 박스에 2개 항목 표시
#    - 각각 독립적으로 크롤링 진행
```

---

## ✅ 완료된 작업

1. ✅ 크롤링 로그 전체 삭제 (11개)
2. ✅ Backend 중복 실행 방지 로직 추가
3. ✅ Frontend 중복 실행 확인 추가
4. ✅ 크롤링 중지 기능 구현
5. ✅ CANCELLED 상태 추가 및 UI 표시
6. ✅ 진행 중 Alert에 중지 버튼 추가
7. ✅ 상태별 아이콘/색상 개선

---

## 📁 관련 파일

- [main.py:67-134](collector/main.py#L67-L134) - 중복 실행 방지 로직
- [page.tsx:122-162](frontend/src/app/admin/sources/page.tsx#L122-L162) - 중복 확인 및 중지 기능
- [page.tsx:206-232](frontend/src/app/admin/sources/page.tsx#L206-L232) - 진행 중 Alert 및 중지 버튼
- [page.tsx:168-188](frontend/src/app/admin/sources/page.tsx#L168-L188) - 상태 색상/아이콘
