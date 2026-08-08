import { ROOT_TENANT_ID } from '@stamhoofd/models';

import { TenantContext } from '../../helpers/TenantContext.js';
import { withTenantScope } from './registerTenantCron.js';

describe('withTenantScope', () => {
    test('the cron runs in a tenant scope', async () => {
        let seen: string | null | undefined;

        await withTenantScope(async () => {
            seen = TenantContext.optional?.tenantId ?? null;
            return Promise.resolve();
        })();

        expect(seen).toBe(ROOT_TENANT_ID);
    });

    test('the scope does not outlive the cron', async () => {
        await withTenantScope(() => Promise.resolve())();

        expect(TenantContext.optional).toBeNull();
    });

    test('a throwing cron still leaves the scope', async () => {
        await expect(withTenantScope(() => Promise.reject(new Error('boom')))()).rejects.toThrow('boom');

        expect(TenantContext.optional).toBeNull();
    });
});
