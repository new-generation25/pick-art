---
description: Collector 시작 전 기존 프로세스 확인 및 종료 매뉴얼
---

# Collector 시작 매뉴얼

이 매뉴얼은 **Collector** 서비스를 실행하기 전에 기존에 실행 중인 Collector 프로세스가 있는지 확인하고, 필요 시 안전하게 종료한 뒤 새롭게 시작하는 절차를 단계별로 설명합니다.

## 1️⃣ 현재 실행 중인 Collector 확인

```powershell
# 프로젝트 루트 디렉터리에서 실행
cd "e:\\developement\\pick-art"

# python.exe 중에서 collector/main.py 를 실행 중인 프로세스만 필터링
tasklist /FI "IMAGENAME eq python.exe" /V | findstr /I "collector\\main.py"
```

- 위 명령이 아무 출력도 하지 않으면 Collector가 실행 중이지 않은 상태입니다.
- 출력에 `collector\\main.py` 가 포함된 행이 보이면 해당 PID 를 확인합니다.

## 2️⃣ 기존 Collector 프로세스 종료

```powershell
# 1 단계에서 확인한 PID (예: 1234) 를 사용하여 종료
taskkill /F /PID 1234
```

> **주의**: `taskkill /F /IM python.exe` 와 같이 전체 Python 프로세스를 강제 종료하면 다른 개발용 스크립트가 중단될 수 있습니다. 가능한 경우 PID 를 지정해 종료하십시오.

## 3️⃣ Collector 시작

```powershell
# 프로젝트 루트 디렉터리에서 아래 명령 실행
$env:PYTHONUNBUFFERED="1"; python collector/main.py
```

- `PYTHONUNBUFFERED=1` 은 로그가 실시간으로 콘솔에 출력되도록 합니다.
- `collector/main.py` 내부에서 `.env.local` 을 절대 경로로 로드하고 `override=True` 로 설정했으므로, 환경 변수 충돌 없이 정상적으로 연결됩니다.

## 4️⃣ 확인

Collector 가 정상적으로 시작되면 콘솔에 다음과 유사한 로그가 표시됩니다.

```
================================================================================
🎨 Pick Art - Collector Service
================================================================================
⏰ Started at: <timestamp>
✅ Scheduler started. Waiting for requests...
```

---

**Tip**: 위 과정을 스크립트(`start_collector.bat`) 로 자동화하고 싶다면, **PID 기반 종료** 로직을 추가한 후 위 명령을 포함시키면 됩니다.
