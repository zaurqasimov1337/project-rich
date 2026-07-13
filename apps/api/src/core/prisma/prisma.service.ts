import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { getContext, requestContext } from '../context/request-context';

/** Models WITHOUT tenantId (platform realm) — everything else is auto-scoped. */
const PLATFORM_MODELS = new Set<string>([
  'Tenant',
  'Plan',
  'Subscription',
  'SubscriptionInvoice',
  'UsageRecord',
  'PlatformUser',
  'FeatureFlag',
  'Announcement',
  'IntegrationCatalog',
  'PlatformAudit',
]);

/** Join tables scoped implicitly through their parents. */
const UNSCOPED_MODELS = new Set<string>(['RolePermission', 'UserRole', 'RefreshToken']);

function tenantScoped(model: string | undefined): boolean {
  if (!model) return false;
  return !PLATFORM_MODELS.has(model) && !UNSCOPED_MODELS.has(model);
}

/**
 * Tenant isolation is enforced HERE, once, for every query.
 * Reads: injects tenantId into where. Writes: stamps tenantId on create data.
 * Platform-realm requests (no tenantId in context) may only touch platform models
 * unless they explicitly opt in via prisma.forTenant(tenantId).
 */
function createExtendedClient(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!tenantScoped(model)) return query(args);

          const ctx = getContext();
          const tenantId = ctx?.tenantId;
          if (!tenantId) {
            // No tenant in context: platform/system job must use forTenant() raw client.
            throw new Error(
              `Tenant-scoped model ${model}.${operation} called without tenant context`,
            );
          }

          const a = args as Record<string, any>;
          switch (operation) {
            case 'create':
              a.data = { ...a.data, tenantId };
              break;
            case 'createMany':
            case 'createManyAndReturn': {
              const rows = Array.isArray(a.data) ? a.data : [a.data];
              a.data = rows.map((r: object) => ({ ...r, tenantId }));
              break;
            }
            case 'upsert':
              a.create = { ...a.create, tenantId };
              a.where = { ...a.where, tenantId };
              break;
            case 'findUnique':
            case 'findUniqueOrThrow':
              // findUnique requires the unique selector itself; wrap as findFirst semantics
              a.where = { ...a.where, tenantId };
              break;
            default:
              a.where = { ...(a.where ?? {}), tenantId };
          }
          return query(a);
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof createExtendedClient>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** Tenant-scoped client — use this for ALL tenant data access. */
  readonly scoped: TenantPrismaClient;

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [{ level: 'warn', emit: 'stdout' }]
          : [],
    });
    this.scoped = createExtendedClient(this);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Runs fn with tenant context set — for background jobs / platform operations
   * acting on behalf of a specific tenant outside an HTTP request.
   */
  forTenant<T>(tenantId: string, fn: (db: TenantPrismaClient) => Promise<T>): Promise<T> {
    // Await INSIDE run(): Prisma promises are lazy — awaiting outside the ALS
    // scope would execute the query without tenant context.
    return requestContext.run(
      { requestId: `job-${Date.now()}`, realm: 'tenant', tenantId },
      async () => await fn(this.scoped),
    );
  }
}

export { Prisma };
