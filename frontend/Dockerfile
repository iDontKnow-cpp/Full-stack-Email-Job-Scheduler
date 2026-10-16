# ===================================================
# Stage 1: Build React/Vite Application
# ===================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev

COPY tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src/
COPY public ./public/

RUN npm run build

# ===================================================
# Stage 2: Serve via Nginx Alpine
# ===================================================
FROM nginx:1.25-alpine AS runner

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom Nginx configuration with reverse proxy and SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]

