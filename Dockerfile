FROM hub.yeastardigital.com/novo-one/static-server:1.0.0

# 复制构建好的静态资源
COPY ./dist/ /app/static/dashboard/
