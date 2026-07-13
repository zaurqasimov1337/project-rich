import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  realm: 'tenant' | 'platform' | 'public';
  tenantId?: string;
  userId?: string;
  permissions?: Set<string>;
  branchIds?: string[]; // branch-scoped role assignments; empty = all branches
  impersonatedBy?: string; // platform user id when impersonating
  ip?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function requireTenantId(): string {
  const tenantId = requestContext.getStore()?.tenantId;
  if (!tenantId) throw new Error('Tenant context missing');
  return tenantId;
}
