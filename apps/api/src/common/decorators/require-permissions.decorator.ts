import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@edusphere/shared';

export const PERMISSIONS_KEY = 'requiredPermissions';
/** Route requires ALL listed permissions (tenant realm). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const PLATFORM_KEY = 'platformRealm';
/** Route belongs to the platform (super admin) realm. */
export const PlatformOnly = (...roles: string[]) => SetMetadata(PLATFORM_KEY, roles);
