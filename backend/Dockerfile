# ====================================================
# Stage 1: Build & Compile TypeScript
# ====================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Salin konfigurasi package dan tsconfig
COPY package*.json tsconfig.json ./

# Install seluruh dependencies (termasuk TypeScript)
RUN npm ci

# Salin seluruh kode sumber
COPY src/ ./src/

# Kompilasi TypeScript ke folder dist/
RUN npm run build

# ====================================================
# Stage 2: Production Lightweight Runtime
# ====================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Salin package definitions untuk install dependensi produksi saja
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Salin hasil kompilasi dari builder
COPY --from=builder /app/dist ./dist

# Salin aset non-TS yang dibutuhkan runtime (file .proto dan .sql)
COPY src/proto/ ./src/proto/
COPY src/config/schema.sql ./src/config/schema.sql

# Port default gRPC Server
EXPOSE 50051

# Jalankan server
CMD ["node", "dist/server.js"]
