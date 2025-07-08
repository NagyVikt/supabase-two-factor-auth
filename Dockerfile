# ─── 1) Build Stage ──────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ─── 2) Production Stage ─────────────────────────────────────────────────────
FROM node:18-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy only the files we need for runtime
COPY package.json package-lock.json ./
RUN npm ci --production

COPY --from=builder /app/.next     ./.next
COPY --from=builder /app/public    ./public
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/middleware.ts   ./middleware.ts
COPY --from=builder /app/lib        ./lib
COPY --from=builder /app/app        ./app
COPY --from=builder /app/components ./components

# Expose Next.js default port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
