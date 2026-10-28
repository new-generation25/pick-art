# 자동 Collector 관리 가이드

## 🎯 개선 사항

**이전**: 사용자가 수동으로 Collector를 실행해야 크롤링 가능
**이후**: "실행" 버튼 클릭 시 자동으로 Collector 상태 확인 및 시작

---

## ✨ 새로운 기능

### 1. **자동 Collector 상태 확인**

출처 관리 페이지에서 Collector 상태를 실시간으로 표시:

```
출처 관리
수집 소스 및 차단 대상을 관리합니다.  [🟢 Collector ON]
```

**상태 표시**:
- 🟢 **Collector ON** (초록색) - 정상 실행 중
- 🔴 **Collector OFF** (빨간색) - 실행되지 않음

**갱신 주기**: 5초마다 자동 확인

### 2. **자동 Collector 시작**

크롤링 실행 버튼 클릭 시:

1. **Collector 상태 확인**
   - 실행 중이면 → 즉시 크롤링 요청 생성
   - 실행 중이 아니면 → 사용자에게 자동 시작 확인

2. **자동 시작 확인 다이얼로그**
   ```
   ⚠️ Collector 서비스가 실행 중이 아닙니다.

   자동으로 시작하시겠습니까?

   (취소 시 수동으로 Collector를 실행해야 합니다)

   [확인]  [취소]
   ```

3. **결과 처리**
   - 확인 → Collector 자동 시작 → 크롤링 요청 생성
   - 취소 → 작업 취소

---

## 🔧 구현 상세

### Backend API ([route.ts](frontend/src/app/api/collector/status/route.ts))

#### GET `/api/collector/status`
Collector 실행 상태 확인

**응답**:
```json
{
  "running": true,
  "message": "Collector is running"
}
```

**구현**:
```typescript
// Windows tasklist로 Python 프로세스 확인
const { stdout } = await execAsync('tasklist | findstr python');
const isRunning = stdout.includes('python');
```

#### POST `/api/collector/status`
Collector 자동 시작

**응답**:
```json
{
  "success": true,
  "message": "Collector started successfully"
}
```

**구현**:
```typescript
// 백그라운드에서 Collector 실행
exec(`cd ${collectorPath} && start /B python -u main.py > collector_auto.log 2>&1`);
```

### Frontend 통합 ([page.tsx](frontend/src/app/admin/sources/page.tsx))

#### 상태 모니터링

**자동 갱신** (5초마다):
```typescript
useEffect(() => {
    const checkCollectorStatus = async () => {
        const res = await fetch('/api/collector/status');
        const data = await res.json();
        setCollectorStatus(data);
    };

    checkCollectorStatus();
    const interval = setInterval(checkCollectorStatus, 5000);
    return () => clearInterval(interval);
}, []);
```

#### 크롤링 실행 흐름

**개선된 handleRunCrawl** ([page.tsx:122-173](frontend/src/app/admin/sources/page.tsx#L122-L173)):

```typescript
const handleRunCrawl = async (item: SourceItem) => {
    // 1. 중복 실행 확인
    if (isRunning) {
        alert('이미 크롤링이 진행 중입니다.');
        return;
    }

    // 2. Collector 상태 확인
    const statusRes = await fetch('/api/collector/status');
    const status = await statusRes.json();

    // 3. Collector가 꺼져있으면 자동 시작 확인
    if (!status.running) {
        const confirmStart = confirm('⚠️ Collector 서비스가 실행 중이 아닙니다...');

        if (confirmStart) {
            // Collector 시작
            await fetch('/api/collector/status', { method: 'POST' });
            alert('✅ Collector가 시작되었습니다.');
        } else {
            return; // 취소
        }
    }

    // 4. 크롤링 요청 생성
    await supabase.from('crawl_logs').insert([...]);
    alert('크롤링 요청이 등록되었습니다.');
};
```

---

## 📊 사용자 시나리오

### 시나리오 1: Collector가 이미 실행 중

```
1. 사용자: "실행" 버튼 클릭
   ↓
2. Frontend: Collector 상태 확인 (GET /api/collector/status)
   → 응답: { running: true }
   ↓
3. Frontend: 즉시 크롤링 요청 생성
   ↓
4. 사용자: "크롤링 요청이 등록되었습니다" 알림
   ↓
5. 로그 영역에서 진행 상황 확인
```

**소요 시간**: ~1초
**사용자 액션**: 1회 (버튼 클릭)

### 시나리오 2: Collector가 실행 중이 아님 (자동 시작)

```
1. 사용자: "실행" 버튼 클릭
   ↓
2. Frontend: Collector 상태 확인 (GET /api/collector/status)
   → 응답: { running: false }
   ↓
3. Frontend: 확인 다이얼로그 표시
   "⚠️ Collector 서비스가 실행 중이 아닙니다."
   ↓
4. 사용자: "확인" 클릭
   ↓
5. Frontend: Collector 시작 (POST /api/collector/status)
   ↓
6. Backend: Collector 백그라운드 실행
   → exec('python -u main.py')
   ↓
7. Frontend: 2초 대기
   ↓
8. Frontend: 크롤링 요청 생성
   ↓
9. 사용자: "✅ Collector가 시작되었습니다" 알림
   ↓
10. Collector: 10초 후 요청 감지 및 크롤링 시작
```

**소요 시간**: ~15초 (Collector 시작 2초 + 요청 대기 10초 + 크롤링 시작)
**사용자 액션**: 2회 (실행 버튼 + 확인 다이얼로그)

### 시나리오 3: Collector가 실행 중이 아님 (수동 실행)

```
1. 사용자: "실행" 버튼 클릭
   ↓
2. Frontend: 확인 다이얼로그 표시
   ↓
3. 사용자: "취소" 클릭
   ↓
4. 작업 종료
   (사용자가 원하면 수동으로 Collector 실행 가능)
```

**사용자 액션**: 2회 (실행 버튼 + 취소 다이얼로그)

---

## 🎨 UI 개선 사항

### Collector 상태 배지

**위치**: 페이지 상단, "수집 소스 및 차단 대상을 관리합니다." 옆

**표시**:
```
출처 관리
수집 소스 및 차단 대상을 관리합니다.  [🟢 Collector ON]
                                      [추가하기]
```

**상태별 스타일**:
- **ON**: 초록색 점 + "Collector ON"
- **OFF**: 빨간색 점 + "Collector OFF"

### 실행 버튼 동작

**이전**:
- 클릭 → 크롤링 요청 생성 → "Collector 서비스가 실행 중이어야..." 경고

**이후**:
- 클릭 → Collector 확인 → 필요시 자동 시작 → 크롤링 요청 생성

---

## 🔧 환경 설정

### 환경 변수 (선택사항)

`.env.local` 또는 `.env`:
```env
# Collector 경로 (기본값: E:\developement\pick-art\collector)
COLLECTOR_PATH=E:\developement\pick-art\collector
```

설정하지 않으면 기본 경로 사용.

---

## ⚠️ 주의사항

### 1. **권한 문제**

Next.js 서버가 Python 프로세스를 시작할 권한이 필요합니다.

**해결 방법**:
- Next.js를 관리자 권한으로 실행
- 또는 Collector를 수동으로 한 번 실행 (이후 자동 감지)

### 2. **포트 충돌**

이미 Collector가 실행 중인데 다시 시작하면 충돌 가능.

**해결 방법**:
- 상태 확인 로직이 이미 구현되어 있어 자동 방지됨
- `running: true`이면 시작 요청을 보내지 않음

### 3. **로그 파일**

자동 시작 시 로그 파일: `collector_auto.log`

**확인 방법**:
```bash
cd E:\developement\pick-art\collector
type collector_auto.log
```

### 4. **Windows 전용**

현재 구현은 Windows `tasklist` 명령어 기반.

**Linux/Mac 지원**:
```typescript
// route.ts에서
const cmd = process.platform === 'win32'
    ? 'tasklist | findstr python'
    : 'ps aux | grep python';
```

---

## 🐛 문제 해결

### Q: "Collector가 시작되었습니다" 알림 후에도 크롤링이 안됩니다

**A**: Collector가 시작되고 스케줄러가 작동하기까지 ~10초 소요
- 상태 배지가 🟢 ON으로 변경되는지 확인 (5초 후)
- 로그 영역에서 10초 후 REQUESTED → RUNNING 변경 확인

### Q: Collector 상태가 항상 🔴 OFF입니다

**A1**: API 경로 확인
- 브라우저 개발자 도구 → Network 탭
- `/api/collector/status` 요청이 200 응답을 받는지 확인

**A2**: Python 프로세스 이름 확인
```bash
tasklist | findstr python
```
- `python.exe`, `python3.13.exe` 등 다양할 수 있음
- route.ts의 `findstr python` 패턴 수정 필요

**A3**: Collector를 수동으로 실행
```bash
cd E:\developement\pick-art\collector
python -u main.py
```

### Q: "Failed to start collector" 에러

**A**: 경로 확인
- `COLLECTOR_PATH` 환경 변수 확인
- 기본 경로: `E:\developement\pick-art\collector`
- 실제 경로와 일치하는지 확인

---

## ✅ 테스트 체크리스트

### 1. Collector가 실행 중일 때

- [ ] 페이지 로드 → 🟢 Collector ON 표시
- [ ] "실행" 버튼 클릭 → 즉시 크롤링 요청 생성
- [ ] 확인 다이얼로그 없이 바로 진행

### 2. Collector가 실행 중이 아닐 때

- [ ] 페이지 로드 → 🔴 Collector OFF 표시
- [ ] "실행" 버튼 클릭 → 자동 시작 확인 다이얼로그
- [ ] "확인" → Collector 시작 → 크롤링 요청 생성
- [ ] "취소" → 작업 중단

### 3. 상태 갱신

- [ ] Collector 수동 시작 → 5초 내 🟢 ON으로 변경
- [ ] Collector 종료 → 5초 내 🔴 OFF로 변경

### 4. 중복 실행 방지

- [ ] Collector OFF → 자동 시작 → 즉시 다시 "실행" 클릭
- [ ] 예상: "이미 크롤링이 진행 중입니다" 알림

---

## 📁 관련 파일

1. **[route.ts](frontend/src/app/api/collector/status/route.ts)** (신규)
   - GET: Collector 상태 확인
   - POST: Collector 자동 시작

2. **[page.tsx](frontend/src/app/admin/sources/page.tsx)**
   - Collector 상태 모니터링 (5초마다)
   - 자동 시작 로직 추가
   - 상태 배지 UI 추가

---

## 🎉 완료된 개선사항

1. ✅ Collector 상태 실시간 모니터링
2. ✅ 자동 Collector 시작 기능
3. ✅ 사용자 친화적인 확인 다이얼로그
4. ✅ 상태 배지 UI 추가
5. ✅ 크롤링 실행 프로세스 자동화

**이제 사용자는 Collector를 수동으로 실행할 필요 없이 "실행" 버튼만 클릭하면 모든 과정이 자동으로 처리됩니다!** 🚀
