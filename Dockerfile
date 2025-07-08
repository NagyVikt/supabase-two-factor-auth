# syntax=docker/dockerfile:1.4

# ─── 1) Build Stage ──────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

# Build-time args for Supabase (used during `npm run build`)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Expo­sing build-time ENV to Node.js process
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Set workdir
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source files and build
COPY . .
RUN npm run build


# ─── 2) Production Stage ─────────────────────────────────────────────────────
FROM node:18-alpine AS runner

# Re-declare runtime args for env-file usage (optional)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SMTP_HOST
ARG SMTP_PORT
ARG SMTP_USER
ARG SMTP_PASS
ARG MFA_EMAIL_FROM
ARG LOGIN_LINK
ARG MFA_RECOVERY_LINK

# Set runtime ENV variables
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
ENV SMTP_HOST=${SMTP_HOST}
ENV SMTP_PORT=${SMTP_PORT}
ENV SMTP_USER=${SMTP_USER}
ENV SMTP_PASS=${SMTP_PASS}
ENV MFA_EMAIL_FROM=${MFA_EMAIL_FROM}
ENV LOGIN_LINK=${LOGIN_LINK}
ENV MFA_RECOVERY_LINK=${MFA_RECOVERY_LINK}

# Set workdir
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy built assets from builder
COPY --from=builder /app/.next     ./.next
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/middleware.ts   ./middleware.ts
COPY --from=builder /app/lib        ./lib
COPY --from=builder /app/app        ./app
COPY --from=builder /app/components ./components

# Expose port and start
EXPOSE 3000
CMD ["npm", "start"]