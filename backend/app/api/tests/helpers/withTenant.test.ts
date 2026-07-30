import { Database } from '@simonbackx/simple-database';
import { Platform, ROOT_TENANT_ID, TenantFactory } from '@stamhoofd/models';
import { PlatformConfig, PlatformMembershipType } from '@stamhoofd/structures';

import { TenantContext } from '../../src/helpers/TenantContext.js';
import { withRootTenant, withTenant } from './withTenant.js';

describe('withTenant', () => {
    afterEach(async () => {
        await Database.delete('DELETE FROM platform WHERE id != ?', [ROOT_TENANT_ID]);
        await Platform.clearCache();
    });

    test('it enters the scope of a factory tenant', async () => {
        const tenant = await new TenantFactory({
            config: PlatformConfig.create({
                membershipTypes: [PlatformMembershipType.create({ id: 'w', name: 'Scoped type' })],
            }),
        }).create();

        await withTenant(tenant, async () => {
            expect(TenantContext.current.tenantId).toBe(tenant.id);

            const struct = await TenantContext.current.getStruct();
            expect(struct.config.membershipTypes.map(m => m.name)).toEqual(['Scoped type']);
        });

        expect(TenantContext.optional).toBeNull();
    });

    test('it accepts a tenant id', async () => {
        await withTenant('some-tenant', async () => {
            expect(TenantContext.current.tenantId).toBe('some-tenant');
            return Promise.resolve();
        });
    });

    test('withRootTenant enters the root scope', async () => {
        await withRootTenant(async () => {
            expect(TenantContext.current.tenantId).toBe(ROOT_TENANT_ID);
            return Promise.resolve();
        });
    });
});
