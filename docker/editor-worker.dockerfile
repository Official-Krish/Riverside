FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/editor-worker/package.json apps/editor-worker/package.json
COPY packages/db/package.json packages/db/package.json

RUN bun install

COPY . .

FROM oven/bun:1 AS runtime

WORKDIR /app/apps/editor-worker

ENV NODE_ENV=production

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/editor-worker /app/apps/editor-worker
COPY --from=builder /app/packages /app/packages

CMD ["bun", "index.ts"]
