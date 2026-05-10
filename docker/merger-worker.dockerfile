FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/merger-worker/package.json apps/merger-worker/package.json

RUN bun install

COPY apps/merger-worker /app/apps/merger-worker

FROM oven/bun:1 AS runtime

WORKDIR /app/apps/merger-worker

ENV NODE_ENV=production

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/merger-worker /app/apps/merger-worker

CMD ["bun", "index.ts"]
