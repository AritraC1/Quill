FROM oven/bun:1 AS base
WORKDIR /app

# ---- dev stage: what docker-compose.yml uses locally ----
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

# ---- build stage: compiles TS to JS ----
FROM base AS build

COPY package.json bun.lock* ./
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN bun install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

WORKDIR /app/apps/server

RUN bun build src/index.ts src/worker.ts --outdir dist --target bun

# ---- production stage: final, minimal runtime image ----
FROM base AS production

ENV NODE_ENV=production
WORKDIR /app/apps/server

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/package.json ./package.json

EXPOSE 3000

CMD ["bun", "dist/index.js"]