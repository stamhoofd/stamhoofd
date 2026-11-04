ARG NODE_VERSION
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY . .
RUN pnpm --filter docs... install --frozen-lockfile
RUN pnpm --dir docs run build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/docs/.output ./.output
USER node
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
