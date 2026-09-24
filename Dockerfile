FROM oven/bun:1.4 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.4
WORKDIR /app
COPY --from=builder /app/build .
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "./index.js"]
