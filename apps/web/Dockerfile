# Web app (Next.js standalone). Build from the repo root:
#   docker build -f apps/web/Dockerfile -t altereffects-web .
# Content-Security-Policy origins are fixed at build time, so pass the public URLs as build args.

FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/ai/package.json packages/ai/
COPY packages/cli/package.json packages/cli/
COPY packages/db/package.json packages/db/
COPY packages/engine/package.json packages/engine/
COPY packages/shared/package.json packages/shared/
COPY packages/fx/package.json packages/fx/
RUN npm ci --no-audit --no-fund
COPY . .
ARG APP_URL=http://localhost:3000
ARG S3_PUBLIC_ENDPOINT=http://localhost:9000
ARG CSP_EXTRA_ORIGINS=
ENV APP_URL=$APP_URL S3_PUBLIC_ENDPOINT=$S3_PUBLIC_ENDPOINT CSP_EXTRA_ORIGINS=$CSP_EXTRA_ORIGINS \
    NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate --schema packages/db/prisma/schema.prisma \
 && npm run build -w @altereffects/web

FROM node:22-bookworm-slim AS run
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 1001 app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
