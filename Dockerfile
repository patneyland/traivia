# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root + all package.jsons
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/

# Install all dependencies
RUN npm ci

# Copy source
COPY . .

# Build shared schemas, then server, then client
RUN npm run build --workspace=shared
RUN npm run build --workspace=server
RUN npm run build --workspace=client

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev --workspace=server --workspace=shared

# Railway provides PORT
EXPOSE 3000

CMD ["node", "server/dist/index.js"]
