FROM oven/bun:1 AS base

WORKDIR /app

# ---- development ----
FROM base AS dev

COPY package.json bun.lock* ./
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN bun install

COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

WORKDIR /app/apps/server

EXPOSE 3000

CMD ["bun", "--watch", "src/index.ts"]


# ---- production ----
FROM base AS production

ENV NODE_ENV=production

COPY package.json bun.lock* ./
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN bun install --frozen-lockfile --production

COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

WORKDIR /app/apps/server

EXPOSE 3000

CMD ["bun", "src/index.ts"]