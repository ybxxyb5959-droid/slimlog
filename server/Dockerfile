# SlimLog API — 배포용 이미지 (Render·Fly.io·Railway 등 컨테이너 호스팅)
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
# 테스트 도구는 운영 이미지에 넣지 않는다
RUN grep -v '^pytest' requirements.txt > req.txt && pip install --no-cache-dir -r req.txt
COPY app ./app
COPY models ./models
EXPOSE 8000
# 필요한 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, (HS256 프로젝트면) SUPABASE_JWT_SECRET, ALLOWED_ORIGINS
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
