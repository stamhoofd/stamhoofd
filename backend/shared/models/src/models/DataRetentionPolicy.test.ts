import { DataRetentionCategory } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { OrganizationFactory } from '../factories/OrganizationFactory.js';
import { DataRetentionPolicy } from './DataRetentionPolicy.js';
import { ROOT_TENANT_ID } from './Platform.js';

describe('Model.DataRetentionPolicy', () => {
    beforeEach(async () => {
        await DataRetentionPolicy.delete();
    });

    async function createPolicy(organizationId: string | null, category = DataRetentionCategory.Members) {
        const policy = new DataRetentionPolicy();
        policy.tenantId = ROOT_TENANT_ID;
        policy.organizationId = organizationId;
        policy.category = category;
        policy.deleteAfterMonths = 24;
        await policy.save();
        return policy;
    }

    test('A level can only have one policy per category', async () => {
        const organization = await new OrganizationFactory({}).create();

        for (const organizationId of [null, organization.id]) {
            await createPolicy(organizationId);
            await createPolicy(organizationId, DataRetentionCategory.Orders);
            await expect(createPolicy(organizationId)).rejects.toThrow(STExpect.simpleError({ code: 'ER_DUP_ENTRY' }));
        }
    });

    test('The policy disappears together with the organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const policy = await createPolicy(organization.id);

        await organization.delete();

        expect(await DataRetentionPolicy.getByID(policy.id)).toBeUndefined();
    });

    test('Pending values are only part of the structure when pendingFrom is set', async () => {
        const policy = await createPolicy(null);
        expect(policy.getStructure().pendingTerms).toBeNull();

        const pendingFrom = new Date('2026-06-01T12:00:00.000Z');
        policy.pendingDeleteAfterMonths = 12;
        policy.pendingFrom = pendingFrom;
        await policy.save();

        const structure = (await DataRetentionPolicy.getByID(policy.id, true)).getStructure();
        expect(structure.terms.deleteAfterMonths).toBe(24);
        expect(structure.pendingTerms?.deleteAfterMonths).toBe(12);
        expect(structure.pendingFrom).toEqual(pendingFrom);
    });

    describe('getStructureFor', () => {
        test('Within a platform only the platform protects periods by default', async () => {
            TestUtils.setEnvironment('userMode', 'platform');
            const organization = await new OrganizationFactory({}).create();

            const platform = await DataRetentionPolicy.getStructureFor(ROOT_TENANT_ID, null, DataRetentionCategory.Members);
            const own = await DataRetentionPolicy.getStructureFor(ROOT_TENANT_ID, organization.id, DataRetentionCategory.Members);

            expect(platform.terms.protectedPeriods).toBe(2);
            expect(own.terms.protectedPeriods).toBeNull();
        });

        test('Without a platform the organization protects periods by default', async () => {
            TestUtils.setEnvironment('userMode', 'organization');
            const organization = await new OrganizationFactory({}).create();

            const own = await DataRetentionPolicy.getStructureFor(ROOT_TENANT_ID, organization.id, DataRetentionCategory.Members);

            expect(own.terms.protectedPeriods).toBe(2);
        });

        test('A saved policy without protection stays turned off', async () => {
            TestUtils.setEnvironment('userMode', 'platform');
            await createPolicy(null);

            const platform = await DataRetentionPolicy.getStructureFor(ROOT_TENANT_ID, null, DataRetentionCategory.Members);

            expect(platform.terms.protectedPeriods).toBeNull();
            expect(platform.terms.deleteAfterMonths).toBe(24);
        });
    });
});
