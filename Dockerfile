# Um só Dockerfile multi-stage para as 5 imagens da aplicação.
#
#   docker build --target node-service --build-arg SERVICE=auth-service -t devstart/auth-service .
#   docker build --target web -t devstart/web .
#
# Porquê um só ficheiro: os 4 serviços NestJS constroem-se da mesma forma, e o
# `npm ci` do monorepo (o passo mais lento) fica numa camada partilhada por todas
# as imagens em vez de se repetir cinco vezes.
#
# Imagens finais:
#   node-service → só o bundle do serviço (main.js) e as dependências de produção
#                  DESSE serviço, a correr como utilizador sem privilégios.
#   web          → os ficheiros estáticos do Angular servidos pelo nginx, que também
#                  encaminha /api para o gateway (mesma origem: sem CORS, cookies simples).

# A mesma versão do .nvmrc (Node 24, com npm 11).
ARG NODE_IMAGE=node:24-bookworm-slim
ARG NGINX_IMAGE=nginx:1.27-alpine

# ── 1. Dependências do monorepo (cache partilhada) ──────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
ENV NX_DAEMON=false \
    NX_NO_CLOUD=true \
    NX_SKIP_NX_CACHE=true
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ── 2a. Build de um serviço NestJS ──────────────────────────────────────────
FROM deps AS service-build
ARG SERVICE
RUN test -n "$SERVICE" || (echo "Falta --build-arg SERVICE=<nome>" && exit 1)
COPY . .
# O build (modo produção) gera, ao lado do main.js, um package.json e um
# package-lock.json só com as dependências que este serviço realmente importa.
RUN npx nx build ${SERVICE}

# ── 2b. Build do frontend ───────────────────────────────────────────────────
FROM deps AS web-build
COPY . .
RUN npx nx build web --configuration=production

# ── 3a. Imagem final de um serviço ──────────────────────────────────────────
FROM ${NODE_IMAGE} AS node-service
ARG SERVICE
ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app
COPY --from=service-build /repo/dist/apps/${SERVICE}/package.json \
                          /repo/dist/apps/${SERVICE}/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund
COPY --from=service-build /repo/dist/apps/${SERVICE}/main.js \
                          /repo/dist/apps/${SERVICE}/main.js.map ./
USER node
# node diretamente (sem npm) para o SIGTERM chegar à aplicação: o NestJS fecha
# as ligações ao Postgres e ao Redis e pára os consumidores de eventos.
CMD ["node", "main.js"]

# ── 3b. Imagem final do frontend ────────────────────────────────────────────
FROM ${NGINX_IMAGE} AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=web-build /repo/dist/apps/web/browser /usr/share/nginx/html
EXPOSE 80
