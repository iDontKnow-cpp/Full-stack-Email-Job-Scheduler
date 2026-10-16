# ===================================================
# Stage 1: Build & Compile TypeScript
# ===================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL required for Prisma engine binaries on Alpine
RUN apk add --no-cache openssl libc6-compat

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --include=dev

# Generate Prisma Client
RUN npx prisma generate

# Copy application source code and tsconfig
COPY tsconfig.json ./
COPY src ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# Remove development dependencies to keep final layer lean
RUN npm prune --omit=dev

# ===================================================
# Stage 2: Production Minimal Runtime
# ===================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install dumb-init for clean signal trapping (SIGTERM/SIGINT) and OpenSSL for Prisma
RUN apk add --no-cache dumb-init openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=3001

# Copy production node_modules (including generated Prisma client)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled JavaScript output and package manifest
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Run as non-privileged node user for container security
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]

