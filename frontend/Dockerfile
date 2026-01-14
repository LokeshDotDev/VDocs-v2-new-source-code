# ========================
# Build stage
# ========================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all deps (including dev)
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build


# ========================
# Production stage
# ========================
FROM node:20-bookworm-slim AS production

# Create non-root user (Debian-compatible)
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -s /bin/bash nextjs

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only prod deps
RUN npm ci --only=production && npm cache clean --force

# Copy build output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# 🔥 Prisma runtime engines (CRITICAL)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

CMD ["npm", "start"]
