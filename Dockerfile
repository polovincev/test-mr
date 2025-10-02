# --- build frontend ---
FROM node:20 AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend .
RUN npm run build

# --- build backend ---
FROM python:3.11-slim AS backend
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libffi-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt
COPY backend /app/backend
COPY --from=frontend /app/frontend/dist /app/static

# --- runtime ---
FROM nginx:1.27-alpine AS runtime
WORKDIR /app
COPY --from=backend /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend /usr/local/bin /usr/local/bin
COPY backend /app/backend
COPY --from=backend /app/static /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh
ENV PYTHONPATH="/app/backend:$PYTHONPATH"
EXPOSE 80 8000
CMD ["/start.sh"]