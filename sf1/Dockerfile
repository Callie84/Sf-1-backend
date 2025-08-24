# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20.11.1

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json

FROM base AS deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --ignore-scripts || true

FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm -r build || true

# Backend runtime image
FROM node:${NODE_VERSION}-alpine AS backend
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/backend/dist /app/apps/backend/dist
COPY --from=build /app/apps/backend/package.json /app/apps/backend/package.json
COPY --from=deps /app/node_modules /app/node_modules
EXPOSE 4000
CMD ["node", "apps/backend/dist/index.js"]

# Frontend runtime image
FROM node:${NODE_VERSION}-alpine AS frontend
WORKDIR /app/apps/frontend
ENV NODE_ENV=production
COPY --from=build /app/apps/frontend /app/apps/frontend
COPY --from=deps /app/node_modules /app/node_modules
EXPOSE 3000
CMD ["node", "../../node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
