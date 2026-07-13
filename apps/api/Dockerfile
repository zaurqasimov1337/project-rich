# --- build stage ---
FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @edusphere/shared build \
 && pnpm --filter @edusphere/api db:generate \
 && pnpm --filter @edusphere/api build \
 && pnpm --filter @edusphere/api deploy --prod /app

# --- runtime stage ---
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma

# Non-root
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 4000
# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
