FROM oven/bun:1 AS builder

WORKDIR /app

COPY apps/ws-relayer/package.json apps/ws-relayer/package.json

RUN bun install

COPY apps/ws-relayer /app/apps/ws-relayer

FROM oven/bun:1 AS runtime

WORKDIR /app/apps/ws-relayer

ENV NODE_ENV=production

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/ws-relayer /app/apps/ws-relayer

EXPOSE 9093

CMD ["bun", "index.ts"]
