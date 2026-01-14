# ============================================
# Build Stage
# ============================================
FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci --no-audit --no-fund || npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ============================================
# Production Stage
# ============================================
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY --from=builder /build/package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-audit --no-fund || npm install --only=production

# Copy compiled JavaScript from builder
COPY --from=builder --chown=nodejs:nodejs /build/dist ./dist

# Create storage directory with proper permissions
RUN mkdir -p /var/tus/data && \
    chown -R nodejs:nodejs /var/tus/data /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:4001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 4001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application in production mode
CMD ["node", "dist/index.js"]
