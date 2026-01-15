# =========================
# Build stage
# =========================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# System deps for Prisma (OpenSSL 3)
RUN apt-get update -y && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build


# =========================
# Production stage
# =========================
FROM node:20-bookworm-slim AS production

WORKDIR /app

RUN apt-get update -y && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy build artifacts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# 🔑 RUN MIGRATIONS AT STARTUP (THIS FIXES EVERYTHING)
CMD sh -c "npx prisma migrate deploy && npm start"
