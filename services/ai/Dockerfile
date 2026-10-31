FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
COPY src ./src

RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --system --create-home app

USER app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--app-dir", "/app/src", "--host", "0.0.0.0", "--port", "8000"]
