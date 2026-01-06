# ============================================================================
# Dockerfile - Frontend Next.js
# ============================================================================

# Stage 1: Builder (installe tout et build)
FROM node:20-alpine AS builder
WORKDIR /app

# Installer les dépendances système pour les binaires natifs (lightningcss, etc.)
RUN apk add --no-cache libc6-compat

# Copier les fichiers de dépendances
COPY package.json package-lock.json* ./

# Installer TOUTES les dépendances (y compris devDependencies pour le build)
RUN npm ci

# Copier le code source
COPY . .

# Variables d'environnement pour le build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# URL du backend pour les rewrites Next.js (utilisé au build time)
ENV BACKEND_URL=http://backend:8000
# Forcer l'URL de l'API pour le build
ENV NEXT_PUBLIC_API_BASE_URL=/api

# Build de l'application
RUN npm run build

# Stage 3: Runner (production)
FROM node:20-alpine AS runner
WORKDIR /app

# Métadonnées
LABEL maintainer="ACS Archive Team"
LABEL description="Frontend Next.js pour ACS Archive"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Créer un utilisateur non-root
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copier les fichiers nécessaires
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Permissions
USER nextjs

# Port exposé
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Lancer l'application
CMD ["node", "server.js"]
