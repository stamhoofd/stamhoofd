import { Database } from '@simonbackx/simple-database';
import { Platform, ROOT_TENANT_ID } from '@stamhoofd/models';
import { PlatformConfig, PlatformMembershipType } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import { TenantContext } from './TenantContext.js';

describe('TenantContext', () => {
    test('there is no tenant outside a scope', () => {
        expect(TenantContext.optional).toBeNull();
        expect(() => TenantContext.current).toThrow(
            STExpect.simpleError({ code: 'no_tenant_context' }),
        );
    });

    test('currentOrRoot falls back to the root tenant', () => {
        expect(TenantContext.currentOrRoot.tenantId).toBe(ROOT_TENANT_ID);
    });

    test('run enters a scope and leaves it again', async () => {
        await TenantContext.run('tenant-a', async () => {
            expect(TenantContext.current.tenantId).toBe('tenant-a');
            expect(TenantContext.currentOrRoot.tenantId).toBe('tenant-a');
        });

        expect(TenantContext.optional).toBeNull();
    });

    test('a nested scope wins and the outer one is restored', async () => {
        await TenantContext.run('tenant-a', async () => {
            await TenantContext.run('tenant-b', async () => {
                expect(TenantContext.current.tenantId).toBe('tenant-b');
            });

            expect(TenantContext.current.tenantId).toBe('tenant-a');
        });
    });

    test('concurrent scopes do not leak into each other', async () => {
        const seen: string[] = [];

        const observe = async (tenantId: string, delay: number) => {
            return await TenantContext.run(tenantId, async () => {
                await new Promise(resolve => setTimeout(resolve, delay));
                seen.push(`${tenantId}:${TenantContext.current.tenantId}`);
                return TenantContext.current.tenantId;
            });
        };

        // a enters first but resumes first too, so a save/restore of one mutable "current" would
        // hand a whichever tenant entered after it
        const [a, b] = await Promise.all([observe('tenant-a', 5), observe('tenant-b', 30)]);

        expect(a).toBe('tenant-a');
        expect(b).toBe('tenant-b');
        expect(seen).toEqual(['tenant-a:tenant-a', 'tenant-b:tenant-b']);
    });

    describe('resolving the tenant', () => {
        afterEach(async () => {
            await Platform.clearCacheForTenantWithoutRefresh('context-tenant');
            await Database.delete('DELETE FROM platform WHERE id != ?', [ROOT_TENANT_ID]);
            await Platform.clearCache();
        });

        test('the scope resolves its own struct', async () => {
            const root = await Platform.getForEditing();

            const other = new Platform();
            other.id = 'context-tenant';
            other.periodId = root.periodId;
            other.config = PlatformConfig.create({
                membershipTypes: [PlatformMembershipType.create({ id: 'ct', name: 'Context tenant type' })],
            });
            await other.save();

            await TenantContext.run('context-tenant', async () => {
                const struct = await TenantContext.current.getStruct();
                expect(struct.config.membershipTypes.map(m => m.name)).toEqual(['Context tenant type']);
                expect(struct.privateConfig).toBeNull();

                const privateStruct = await TenantContext.current.getPrivateStruct();
                expect(privateStruct.privateConfig).not.toBeNull();

                expect((await TenantContext.current.getTenant()).id).toBe('context-tenant');
            });
        });

        test('an unknown tenant does not resolve', async () => {
            await TenantContext.run('no-such-tenant', async () => {
                await expect(TenantContext.current.getStruct()).rejects.toThrow(
                    STExpect.simpleError({ code: 'tenant_not_found' }),
                );
            });
        });
    });
});
