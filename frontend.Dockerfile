# ===================================================
# Stage 1: Build React/Vite Application (from Repo Root)
# ===================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/tsconfig*.json frontend/vite.config.ts frontend/tailwind.config.js frontend/postcss.config.js frontend/index.html ./
COPY frontend/src ./src/
COPY frontend/public ./public/

RUN npm run build

# ===================================================
# Stage 2: Serve via Nginx Alpine
# ===================================================
FROM nginx:1.25-alpine AS runner

RUN rm -rf /etc/nginx/conf.d/*

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]

