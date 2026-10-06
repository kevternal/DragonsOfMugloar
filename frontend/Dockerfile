# Build stage: installs with the lockfile and builds dist/; only Docker is needed on the host.
FROM node:24-alpine AS build
WORKDIR /src
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
COPY package.json pnpm-lock.yaml ./
# The cache mount keeps the pnpm store between builds.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime stage: nginx serves the static build. The browser calls the Mugloar API directly.
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
