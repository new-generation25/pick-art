---
description: 경남 아트 네비게이터 배포 및 운영 가이드
---

# 🚀 경남 아트 네비게이터 배포 가이드

이 문서는 프론트엔드, 수집기, 관리자 대시보드 각각의 배포 방법과 환경 설정 방법을 안내합니다.

## 1. 전제 조건

- **Supabase**: 데이터베이스와 스토리지가 구성되어 있어야 합니다. (`schema.sql` 실행 완료)
- **GitHub**: 모든 소스 코드가 GitHub 레포지토리에 푸시되어 있어야 합니다.

---

## 2. 모듈별 배포 방법

### 🌐 프론트엔드 (Next.js)

- **추천 플랫폼**: [Vercel](https://vercel.com)
- **설정 방식**:
  1. Vercel에서 GitHub 레포지토리 연결
  2. Framework Preset: `Next.js` 선택
  3. Root Directory: `frontend`
  4. **환경 변수 추가**:
     - `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key

### 🤖 수집기 (Python Collector)

- **추천 플랫폼**: [Render](https://render.com) (Background Worker) 또는 VPS
- **주의사항**: Playwright 브라우저 의존성이 있으므로 Docker 배포를 권장합니다.
- **배포 단계**:
  1. `collector/Dockerfile` 생성 (브라우저 포함 이미지)
  2. Render에서 'Background Worker' 생성 및 레포지토리 연결
  3. **환경 변수 추가**:
     - `SUPABASE_URL`, `SUPABASE_KEY`
     - `INSTAGRAM_USERNAME`, `INSTAGRAM_PASSWORD`
     - `GEMINI_API_KEY` (AI 자동 정제용)
     - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### 📊 관리자 대시보드 (Streamlit Admin)

- **추천 플랫폼**: [Streamlit Community Cloud](https://streamlit.io/cloud)
- **배포 단계**:
  1. Streamlit Cloud 로그인 후 'New app' 선택
  2. 레포지토리, 브랜치 선택 후 Main file path를 `admin/app.py`로 지정
  3. **Advanced settings**에서 `Secrets` 설정:
     - `.env` 파일 내용을 TOML 형식으로 입력

---

## 3. 주기적 운영 작업

- **데이터 백업**: Supabase Dashboard에서 정기적 백업 설정 활성화
- **모니터링**: 텔레그램 에러 알림 수신 시 `collector` 로그 확인
- **콘텐츠 검수**: 매일 1~2회 `Admin` 인박스 확인 및 DM 발송/발행 진행

---

## 4. 로컬 테스트 (개발용)

```bash
# Frontend
cd frontend && npm install && npm run dev

# Collector
cd collector && pip install -r requirements.txt && python main.py

# Admin
cd admin && pip install -r requirements.txt && streamlit run app.py
```
