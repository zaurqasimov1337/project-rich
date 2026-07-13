# --- build stage ---
FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @edusphere/shared build \
 && pnpm --filter @edusphere/web build

# --- runtime stage ---
FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/web/.next ./apps/web/.next
COPY --from=build /repo/apps/web/public ./apps/web/public
COPY --from=build /repo/apps/web/package.json ./apps/web/package.json
COPY --from=build /repo/apps/web/next.config.ts ./apps/web/next.config.ts

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /repo
USER app

EXPOSE 3000
CMD ["pnpm", "--filter", "@edusphere/web", "start"]
