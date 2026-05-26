FROM oven/bun:alpine AS builder

WORKDIR /app

# 复制所有源代码和配置文件
COPY . .

# 安装 pnpm、安装依赖、构建应用、清理构建产物中的不必要文件
RUN bun install --frozen-lockfile --prefer-offline --ignore-scripts && \
    bunx turbo build:web && \
    find /app/apps/web/dist -name "*.map" -delete 2>/dev/null || true

# 运行阶段需要重新定义 ARG
FROM hub.yeastardigital.com/novo-one/static-server:1.0.0 AS runtime

# 复制构建好的静态资源
COPY --from=builder /app/dist/ /app/static/
