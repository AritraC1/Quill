FROM oven/bun:1 AS base
WORKDIR /app

# ---- dev stage: Vite dev server with hot reload ----
FROM base AS dev

COPY package.json bun.lock* ./
COPY apps/client/package.json ./apps/client/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN bun install

COPY packages/shared ./packages/shared
COPY apps/client ./apps/client

WORKDIR /app/apps/client

EXPOSE 5173

CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0"]

# ---- build stage: produces static files ----
FROM base AS build

COPY package.json bun.lock* ./
COPY apps/client/package.json ./apps/client/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN bun install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/client ./apps/client

WORKDIR /app/apps/client

RUN bun run build

# ---- production stage: serves static bundle via Nginx ----
FROM nginx:alpine AS production

COPY --from=build /app/apps/client/dist /usr/share/nginx/html
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]