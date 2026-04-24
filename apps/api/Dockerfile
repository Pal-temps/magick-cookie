FROM oven/bun:1.3-alpine

WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/

# Install deps
RUN bun install --frozen-lockfile

# Copy API source
COPY apps/api apps/api

USER bun

EXPOSE 47300

CMD ["bun", "run", "--hot", "apps/api/src/index.ts"]
