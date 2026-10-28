---
description: 도커 구동부터 Supabase, 프론트엔드, 컬렉터까지 모든 서버를 한 번에 시작하는 매뉴얼
---

# 전체 서버 시작 워크플로우 (Server Startup)

이 워크플로우는 Pick Art 프로젝트의 로컬 개발 환경을 구축하기 위해 필요한 모든 서비스를 순차적으로 실행합니다.

// turbo-all

## 1️⃣ Docker Desktop 실행

Windows 환경에서 Docker Desktop 애플리케이션을 실행하고 엔진이 준비될 때까지 기다립니다.

```powershell
powershell -Command "Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'"
# 엔진 부팅 대기 (약 30초 권장)
Start-Sleep -Seconds 30
```

## 2️⃣ Supabase 로컬 서비스 시작

로컬 데이터베이스 및 인증 서비스를 구동합니다.

```powershell
npx supabase start
```

## 3️⃣ 프론트엔드 개발 서버 시작

Next.js 개발 서버를 3000번 포트에서 실행합니다.

```powershell
cd frontend; npm run dev
```

## 4️⃣ Collector 서비스 시작

데이터 수집 및 크롤링 스케줄러를 실행합니다.

```powershell
# 프로젝트 루트에서 실행
$env:PYTHONUNBUFFERED="1"; python collector/main.py
```

## 5️⃣ 접속 주소 안내

모든 서버가 구동되면 아래 주소를 통해 시스템에 접속할 수 있습니다.

- **프론트엔드 (Next.js)**: [http://localhost:3000](http://localhost:3000)
- **백엔드 대시보드 (Supabase Studio)**: [http://127.0.0.1:54323](http://127.0.0.1:54323)
- **컬렉터 상태**: 프론트엔드 어드민 페이지에서 확인 가능

---

## ✅ 최종 확인 사항

1. 터미널에 에러 메시지가 없는지 확인합니다.
2. `npx supabase start` 호출 시 출력되는 API URL과 서비스 주소를 메모해두면 편리합니다.
3. 컬렉터 로그에 `✅ Scheduler started.` 가 표시되는지 확인합니다.
