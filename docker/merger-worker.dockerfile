FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/merger-worker/package.json apps/merger-worker/package.json
COPY packages/amazonS3/package.json packages/amazonS3/package.json
COPY packages/db/package.json packages/db/package.json

RUN bun install

COPY apps/merger-worker /app/apps/merger-worker
COPY packages/amazonS3 /app/packages/amazonS3
COPY packages/db /app/packages/db

RUN cd packages/db && bunx prisma generate


FROM oven/bun:1 AS runtime

WORKDIR /app/apps/merger-worker

ENV NODE_ENV=production

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/merger-worker /app/apps/merger-worker
COPY --from=builder /app/packages/amazonS3 /app/packages/amazonS3
COPY --from=builder /app/packages/db /app/packages/db
CMD ["bun", "index.ts"]
