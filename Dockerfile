# ---------- Stage 1: all dependencies (cached until package files change)
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Stage 2: generate Prisma client + compile TypeScript
FROM deps AS build
COPY . .
# generate does not connect to a DB; the placeholder URL only satisfies prisma.config.ts
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
 && npm run build

# ---------- Stage 3: production-only dependencies
FROM node:22-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Stage 4: final runtime image
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 3000
CMD ["node", "dist/src/main.js"]