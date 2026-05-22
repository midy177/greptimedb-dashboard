FROM --platform=linux/amd64 oven/bun:1.3.13 as builder

WORKDIR /greptimedb-dashboard

ARG command=docker

COPY . .
RUN bun install --frozen-lockfile
RUN bun run build:$command

FROM --platform=linux/amd64 nginx:1.23 as base

ENV GREPTIMEDB_HTTP_HOST=127.0.0.1
ENV GREPTIMEDB_HTTP_PORT=4000
ENV NGINX_PORT=8080

RUN mkdir -p /usr/share/nginx/html/dashboard
COPY --from=builder /greptimedb-dashboard/dist/ /usr/share/nginx/html/dashboard
ADD docker/greptimedb.conf /etc/nginx/templates/default.conf.template
