# Gyeongnam Art Navigator (경남 아트 네비게이터)

경남 지역의 문화예술 정보를 자동으로 수집, 큐레이션하여 제공하는 서비스입니다.

## 📂 Project Structure

이 프로젝트는 다음과 같은 모노레포 구조로 구성되어 있습니다.

### 1. Frontend (`/frontend`)

- **Role**: 사용자에게 정보를 제공하는 웹 애플리케이션
- **Stack**: Next.js 14, Tailwind CSS, TypeScript
- **Run**:

  ```bash
  cd frontend
  npm run dev
  ```

### 2. Collector (`/collector`)

- **Role**: 인스타그램 및 공공기관 웹사이트 크롤링 및 데이터 수집
- **Stack**: Python 3.10+, Playwright, BeautifulSoup4
- **Run**:

  ```bash
  cd collector
  # 가상환경 활성화 권장
  pip install -r requirements.txt
  python main.py
  ```

### 3. Admin (`/admin`)

- **Role**: 수집된 데이터 검수 및 발행 관리를 위한 대시보드
- **Stack**: Streamlit, Python
- **Run**:

  ```bash
  cd admin
  pip install -r requirements.txt
  streamlit run app.py
  ```

## 🚀 Getting Started

각 디렉토리의 `README.md` (추후 작성 예정) 또는 위 가이드를 참고하여 모듈별로 실행할 수 있습니다.
환경 변수 설정이 필요하며, `.env` 파일을 각 디렉토리에 생성해야 합니다.
