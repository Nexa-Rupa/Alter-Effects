# Render/ingest/effects worker: Node 22 + Chromium + ffmpeg + Python (effects). Build from the repo root:
#   docker build -f apps/worker/Dockerfile -t altereffects-worker .
# The same image runs database migrations (see the "migrate" service in docker-compose.yml).
FROM node:22-bookworm-slim
# python3 + libgl1/libglib: the effects engine (packages/fx) uses OpenCV and MediaPipe.
RUN apt-get update && apt-get install -y --no-install-recommends chromium ffmpeg fonts-noto-color-emoji fonts-noto-core openssl ca-certificates python3 python3-venv libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/* && useradd --system --uid 1001 --create-home app
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/ai/package.json packages/ai/
COPY packages/cli/package.json packages/cli/
COPY packages/db/package.json packages/db/
COPY packages/engine/package.json packages/engine/
COPY packages/shared/package.json packages/shared/
COPY packages/fx/package.json packages/fx/
# Skip the web app's dependencies (Next.js etc.); the worker doesn't need them.
RUN npm ci --no-audit --no-fund --workspace @altereffects/worker --workspace @altereffects/db --include-workspace-root
COPY packages/fx/requirements.txt packages/fx/requirements.txt
RUN python3 -m venv /opt/fx && /opt/fx/bin/pip install --no-cache-dir -q -r packages/fx/requirements.txt
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN npx prisma generate --schema packages/db/prisma/schema.prisma && mkdir -p /tmp/altereffects && chown app /tmp/altereffects
ENV CHROME_PATH=/usr/bin/chromium WORK_DIR=/tmp/altereffects NODE_ENV=production FX_PYTHON=/opt/fx/bin/python
USER app
CMD ["npx", "tsx", "apps/worker/src/index.ts"]
