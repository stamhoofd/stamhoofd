import type { Organization } from '@stamhoofd/models';
import { AuditLog, DataRetentionPolicy, OrganizationFactory } from '@stamhoofd/models';
import {
    AuditLogSource,
    AuditLogType,
    DataRetentionCategory,
    DataRetentionTerms,
} from '@stamhoofd/structures';

import { DataRetentionPolicyService } from './DataRetentionPolicyService.js';

const DAY = 24 * 60 * 60 * 1000;

async function createPendingPolicy(organization: Organization, pendingFrom: Date) {
    const policy = new DataRetentionPolicy();
    policy.tenantId = '1';
    policy.organizationId = organization.id;
    policy.category = DataRetentionCategory.Members;
    policy.anonymizeAfterMonths = 60;
    policy.setPendingTerms({
        terms: DataRetentionTerms.create({ anonymizeAfterMonths: 24 }),
        from: pendingFrom,
    });
    await policy.save();
    return policy;
}

async function getAppliedLogs(organization: Organization) {
    return await AuditLog.select()
        .where('organizationId', organization.id)
        .where('type', AuditLogType.DataRetentionPendingChangeApplied)
        .fetch();
}

describe('DataRetentionPolicyService.applyDuePendingChanges', () => {
    test('A pending change that started to apply becomes the current terms, and is logged', async () => {
        const organization = await new OrganizationFactory({}).create();
        const policy = await createPendingPolicy(organization, new Date(Date.now() - DAY));

        await DataRetentionPolicyService.applyDuePendingChanges('1', new Date());

        const reloaded = (await DataRetentionPolicy.getByID(policy.id))!;
        expect(reloaded.anonymizeAfterMonths).toBe(24);
        expect(reloaded.pendingFrom).toBeNull();
        expect(reloaded.pendingAnonymizeAfterMonths).toBeNull();

        const logs = await getAppliedLogs(organization);
        expect(logs).toHaveLength(1);
        expect(logs[0].source).toBe(AuditLogSource.System);
        expect(logs[0].userId).toBeNull();
        expect(logs[0].objectId).toBe(policy.id);
    });

    test('A pending change that did not start yet is kept', async () => {
        const organization = await new OrganizationFactory({}).create();
        const pendingFrom = new Date(Date.now() + DAY);
        pendingFrom.setMilliseconds(0);
        const policy = await createPendingPolicy(organization, pendingFrom);

        await DataRetentionPolicyService.applyDuePendingChanges('1', new Date());

        const reloaded = (await DataRetentionPolicy.getByID(policy.id))!;
        expect(reloaded.anonymizeAfterMonths).toBe(60);
        expect(reloaded.pendingAnonymizeAfterMonths).toBe(24);
        expect(reloaded.pendingFrom).toEqual(pendingFrom);
        expect(await getAppliedLogs(organization)).toHaveLength(0);
    });

    test('A pending change of another tenant is kept', async () => {
        const organization = await new OrganizationFactory({}).create();
        const policy = await createPendingPolicy(organization, new Date(Date.now() - DAY));

        await DataRetentionPolicyService.applyDuePendingChanges('other-tenant', new Date());

        const reloaded = (await DataRetentionPolicy.getByID(policy.id))!;
        expect(reloaded.anonymizeAfterMonths).toBe(60);
        expect(await getAppliedLogs(organization)).toHaveLength(0);
    });

    test('Applying twice changes and logs nothing more', async () => {
        const organization = await new OrganizationFactory({}).create();
        await createPendingPolicy(organization, new Date(Date.now() - DAY));

        await DataRetentionPolicyService.applyDuePendingChanges('1', new Date());
        await DataRetentionPolicyService.applyDuePendingChanges('1', new Date());

        expect(await getAppliedLogs(organization)).toHaveLength(1);
    });
});
