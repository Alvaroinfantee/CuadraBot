FROM python:3.12.11-slim-bookworm@sha256:519591d6871b7bc437060736b9f7456b8731f1499a57e22e6c285135ae657bf7

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TAKEOFF_DATA_DIR=/data \
    TAKEOFF_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       curl \
       git \
       nodejs \
       npm \
       poppler-utils \
       tesseract-ocr \
    && npm install -g @openai/codex@0.146.0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY schemas ./schemas
COPY scripts ./scripts

RUN useradd --create-home --uid 10001 takeoff \
    && mkdir -p /data \
    && chown -R takeoff:takeoff /service /data

USER takeoff
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:8000/readyz || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
