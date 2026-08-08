import type { Platform } from '@stamhoofd/models';
import { ROOT_TENANT_ID } from '@stamhoofd/models';

import { TenantContext } from '../../src/helpers/TenantContext.js';

/**
 * Runs the body as if a request or cron for this tenant had entered its scope.
 *
 * Lives here rather than in @stamhoofd/test-utils because TenantContext is part of the api app, and
 * test-utils is shared with packages that must not depend on it.
 */
export async function withTenant<T>(tenant: Platform | string, handler: () => Promise<T>): Promise<T> {
    const tenantId = typeof tenant === 'string' ? tenant : tenant.id;
    return await TenantContext.run(tenantId, handler);
}

/**
 * The scope every request gets today, for tests that need to assert against it explicitly.
 */
export async function withRootTenant<T>(handler: () => Promise<T>): Promise<T> {
    return await withTenant(ROOT_TENANT_ID, handler);
}
