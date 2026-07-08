# Production Dockerfile for the Next.js app (used at DEPLOYMENT time on Hostinger).
# Not needed for local dev — local dev uses the node image in docker-compose.yml.
# Multi-stage build keeps the final image small.

# ── deps ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY scripts/ ./scripts/
RUN npm ci

# ── build ──
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ── run ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
RUN mkdir -p /app/public/uploads/company /app/public/uploads/drawings
EXPOSE 3000
CMD ["npm", "start"]