import { PlatformConfig, PlatformMembershipType } from '@stamhoofd/structures';
import { Platform } from './Platform.js';
import { Database } from '@simonbackx/simple-database';

describe('Model.Platform', () => {
    describe('Shared caches', () => {
        beforeEach(async () => {
            const platform = await Platform.getByID('1');
            platform!.config = PlatformConfig.create({});
            await platform!.save();
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
});
