FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/transcoder/package.json apps/transcoder/package.json
COPY packages/amazonS3/package.json packages/amazonS3/package.json

RUN bun install

COPY apps/transcoder /app/apps/transcoder
COPY packages/amazonS3 /app/packages/amazonS3
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config


FROM oven/bun:1 AS runtime

WORKDIR /app/apps/transcoder

ENV NODE_ENV=production

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/transcoder /app/apps/transcoder
COPY --from=builder /app/packages/amazonS3 /app/packages/amazonS3


CMD ["bun", "index.ts"]
