# syntax=docker/dockerfile:1

# Stage 1: Base image with corepack and pnpm
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Stage 2: Install dependencies
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 3: Build application
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables for Next.js client bundling
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_CESIUM_ION_TOKEN
ARG NEXT_PUBLIC_CARTO_KEY
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_CESIUM_ION_TOKEN=${NEXT_PUBLIC_CESIUM_ION_TOKEN}
ENV NEXT_PUBLIC_CARTO_KEY=${NEXT_PUBLIC_CARTO_KEY}
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# Stage 4: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets, Cesium static bundles, and standalone server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
