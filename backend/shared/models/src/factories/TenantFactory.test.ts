import { Database } from '@simonbackx/simple-database';
import { PlatformConfig, PlatformMembershipType } from '@stamhoofd/structures';

import { Platform, ROOT_TENANT_ID } from '../models/Platform.js';
import { TenantFactory } from './TenantFactory.js';

describe('TenantFactory', () => {
    afterEach(async () => {
        await Database.delete('DELETE FROM platform WHERE id != ?', [ROOT_TENANT_ID]);
        await Platform.clearCache();
    });

    test('it creates a tenant that is not the root tenant', async () => {
        const tenant = await new TenantFactory({}).create();

        expect(tenant.id).not.toBe(ROOT_TENANT_ID);
        expect(tenant.parentTenantId).toBeNull();
        expect(tenant.feesTenantId).toBe(tenant.id);
        expect(tenant.uri).toContain('tenant-');
        expect(tenant.domain).toContain('.example.com');

        expect((await Platform.getByID(tenant.id))?.id).toBe(tenant.id);
    });

    test('two tenants do not collide on uri or domain', async () => {
        const a = await new TenantFactory({}).create();
        const b = await new TenantFactory({}).create();

        expect(a.uri).not.toBe(b.uri);
        expect(a.domain).not.toBe(b.domain);
    });

    test('a child tenant points at its parent and inherits its fees tenant', async () => {
        const parent = await new TenantFactory({}).create();
        const child = await new TenantFactory({ parentTenant: parent, feesTenant: parent }).create();

        expect(child.parentTenantId).toBe(parent.id);
        expect(child.feesTenantId).toBe(parent.id);
    });

    test('the tenant resolves through the per-tenant cache', async () => {
        const tenant = await new TenantFactory({
            config: PlatformConfig.create({
                membershipTypes: [PlatformMembershipType.create({ id: 'f', name: 'Factory type' })],
            }),
        }).create();

        const struct = await Platform.getStructForTenant(tenant.id);
        expect(struct.config.membershipTypes.map(m => m.name)).toEqual(['Factory type']);
    });

    test('getRoot returns the root tenant', async () => {
        expect((await TenantFactory.getRoot()).id).toBe(ROOT_TENANT_ID);
    });
});
