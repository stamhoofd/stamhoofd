import { PlatformConfig, PlatformMembershipType } from '@stamhoofd/structures';
import { Platform } from './Platform.js';
import { Database } from '@simonbackx/simple-database';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

describe('Model.Platform', () => {
    describe('Shared caches', () => {
        beforeEach(async () => {
            // getForEditing, not getByID: on a freshly migrated database the row does not exist yet
            const platform = await Platform.getForEditing();
            platform.config = PlatformConfig.create({});
            await platform.save();
        });

        test('Editable model changes do not propagate', async () => {
            const editable = await Platform.getForEditing();
            editable.config.membershipTypes = [
                PlatformMembershipType.create({ id: '1', name: 'Test' }),
            ];

            const shared = (await Platform.getShared()) as any;
            expect(shared.config.membershipTypes).toHaveLength(0);
        });

        test('Shared model is immutable', async () => {
            const editable = await Platform.getForEditing();
            editable.config.membershipTypes = [
                PlatformMembershipType.create({ id: '1', name: 'Test' }),
            ];
            await editable.save();

            const shared = (await Platform.getShared()) as any;
            expect(() => {
                shared.privateConfig.roles = [];
            }).toThrow();

            expect(() => {
                shared.membershipOrganizationId = '2';
            }).toThrow();

            expect(shared.config.membershipTypes).toHaveLength(1);

            expect(() => {
                shared.concat.membershipTypes[0].name = 'Test2';
            }).toThrow();
        });

        test('Saving changes propagates to all shared states', async () => {
            const structBefore = await Platform.getSharedStruct();
            const privateStructBefore = await Platform.getSharedPrivateStruct();
            const sharedModelBefore = await Platform.getShared();

            const editable = await Platform.getForEditing();
            editable.config.membershipTypes = [
                PlatformMembershipType.create({ id: '1', name: 'Hey there' }),
            ];
            await editable.save();

            const structAfter = await Platform.getSharedStruct();
            const privateStructAfter = await Platform.getSharedPrivateStruct();
            const sharedModelAfter = await Platform.getShared();

            expect(structAfter.config.membershipTypes[0].name).toEqual('Hey there');
            expect(privateStructAfter.config.membershipTypes[0].name).toEqual('Hey there');
            expect(sharedModelAfter.config.membershipTypes[0].name).toEqual('Hey there');

            // Test before state not altered
            expect(structBefore.config.membershipTypes).toHaveLength(0);
            expect(privateStructBefore.config.membershipTypes).toHaveLength(0);
            expect(sharedModelBefore.config.membershipTypes).toHaveLength(0);
        });
    });

    describe('it creates the first platform in the database', () => {
        beforeEach(async () => {
            await Database.delete('DELETE FROM platform');
            await Platform.clearCacheWithoutRefresh();
            if (await Platform.getByID('1')) {
                throw new Error('Platform 1 should not exist');
            }
        });

        test('when requesting getForEditing', async () => {
            const editable = await Platform.getForEditing();
            expect(editable.id).toBe('1');

            expect((await Platform.getByID('1'))?.id).toEqual(editable.id);
        });

        test('it charges its own fees and takes its uri and domain from the environment', async () => {
            TestUtils.setEnvironment('platformName', 'a-test-platform');
            TestUtils.setEnvironment('domains', {
                ...STAMHOOFD.domains,
                dashboard: 'a-test-platform.example.com',
            });

            const created = await Platform.getForEditing();

            expect(created.feesTenantId).toBe(created.id);
            expect(created.parentTenantId).toBeNull();
            expect(created.uri).toBe('a-test-platform');
            expect(created.domain).toBe('a-test-platform.example.com');

            // Reload so we know the values were persisted, not just set in memory
            const reloaded = await Platform.getByID(created.id);
            expect(reloaded!.feesTenantId).toBe(created.id);
            expect(reloaded!.uri).toBe('a-test-platform');
            expect(reloaded!.domain).toBe('a-test-platform.example.com');
        });

        test('when requesting getShared', async () => {
            const shared = await Platform.getShared();
            expect(shared.id).toBe('1');

            expect((await Platform.getByID('1'))?.id).toEqual(shared.id);
        });

        test('when requesting getSharedPrivateStruct', async () => {
            const editable = await Platform.getSharedPrivateStruct();
            expect(editable).toBeDefined();
            expect(await Platform.getByID('1')).toBeDefined();
        });

        test('when requesting getSharedStruct', async () => {
            const editable = await Platform.getSharedStruct();
            expect(editable).toBeDefined();
            expect(await Platform.getByID('1')).toBeDefined();
        });
    });

    describe('Tenant identity', () => {
        afterEach(async () => {
            await Database.delete('DELETE FROM platform WHERE id != ?', ['1']);
        });

        test('two tenants cannot share a uri', async () => {
            const existing = await Platform.getForEditing();
            existing.uri = 'first-tenant';
            await existing.save();

            const other = new Platform();
            other.id = 'clash-a';
            other.periodId = existing.periodId;
            other.uri = 'first-tenant';

            await expect(other.save()).rejects.toThrow(/uri/i);
        });

        test('two tenants cannot share a domain', async () => {
            const existing = await Platform.getForEditing();
            existing.domain = 'shared.example.com';
            await existing.save();

            const other = new Platform();
            other.id = 'clash-b';
            other.periodId = existing.periodId;
            other.domain = 'shared.example.com';

            await expect(other.save()).rejects.toThrow(/domain/i);
        });

        test('a second tenant with its own uri and domain saves fine', async () => {
            const existing = await Platform.getForEditing();
            existing.uri = 'first-tenant';
            existing.domain = 'first.example.com';
            await existing.save();

            const other = new Platform();
            other.id = 'clash-c';
            other.periodId = existing.periodId;
            other.uri = 'sibling-tenant';
            other.domain = 'sibling.example.com';
            other.parentTenantId = existing.id;
            other.feesTenantId = existing.id;

            await expect(other.save()).resolves.not.toThrow();

            const reloaded = await Platform.getByID('clash-c');
            expect(reloaded!.parentTenantId).toBe(existing.id);
            expect(reloaded!.feesTenantId).toBe(existing.id);
        });
    });

    describe('Per-tenant caches', () => {
        async function createSecondTenant() {
            const root = await Platform.getForEditing();

            const other = new Platform();
            other.id = 'second-tenant';
            other.periodId = root.periodId;
            other.config = PlatformConfig.create({
                membershipTypes: [PlatformMembershipType.create({ id: 't2', name: 'Second tenant type' })],
            });
            await other.save();

            return { root, other };
        }

        afterEach(async () => {
            await Platform.clearCacheForTenantWithoutRefresh('second-tenant');
            await Database.delete('DELETE FROM platform WHERE id != ?', ['1']);
            await Platform.clearCache();
        });

        test('each tenant caches its own struct', async () => {
            const { root } = await createSecondTenant();

            root.config.membershipTypes = [PlatformMembershipType.create({ id: 't1', name: 'Root type' })];
            await root.save();

            const rootStruct = await Platform.getStructForTenant('1');
            const otherStruct = await Platform.getStructForTenant('second-tenant');

            expect(rootStruct.config.membershipTypes.map(m => m.name)).toEqual(['Root type']);
            expect(otherStruct.config.membershipTypes.map(m => m.name)).toEqual(['Second tenant type']);
        });

        test('saving one tenant does not discard another tenant cache', async () => {
            const { root } = await createSecondTenant();

            const otherBefore = await Platform.getStructForTenant('second-tenant');

            root.config.membershipTypes = [PlatformMembershipType.create({ id: 't1', name: 'Changed' })];
            await root.save();

            // Same object identity: the second tenant's cache was never rebuilt
            expect(await Platform.getStructForTenant('second-tenant')).toBe(otherBefore);
            expect((await Platform.getStructForTenant('1')).config.membershipTypes[0].name).toBe('Changed');
        });

        test('clearing one tenant cache leaves the other in place', async () => {
            await createSecondTenant();

            const rootBefore = await Platform.getStructForTenant('1');
            const otherBefore = await Platform.getStructForTenant('second-tenant');

            await Platform.clearCacheForTenant('second-tenant');

            expect(await Platform.getStructForTenant('1')).toBe(rootBefore);
            expect(await Platform.getStructForTenant('second-tenant')).not.toBe(otherBefore);
        });

        test('an unknown tenant is not created on the fly', async () => {
            await expect(Platform.getForEditing('does-not-exist')).rejects.toThrow(
                STExpect.simpleError({ code: 'tenant_not_found' }),
            );
        });
    });
});
