# Playwright 전용 Python 이미지를 베이스로 사용
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 파일 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 브라우저 설치 (Playwright)
RUN playwright install chromium

# 소스 코드 복사
COPY . .

# 스케줄러 실행
CMD ["python", "main.py"]
