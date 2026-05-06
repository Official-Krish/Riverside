FROM oven/bun:1 AS builder

WORKDIR /app

COPY apps/transcoder/package.json apps/transcoder/package.json

RUN bun install

COPY apps/transcoder /app/apps/transcoder

FROM oven/bun:1 AS runtime

WORKDIR /app/apps/transcoder

ENV NODE_ENV=production

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/transcoder /app/apps/transcoder

CMD ["bun", "index.ts"]
