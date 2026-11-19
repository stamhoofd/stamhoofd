import type { Organization } from '@stamhoofd/models';
import {
    BalanceItemFactory,
    DataRetentionPolicy,
    DataRetentionRun,
    GroupFactory,
    Member,
    MemberFactory,
    Order,
    OrderFactory,
    OrganizationFactory,
    RegistrationFactory,
    WebshopFactory,
} from '@stamhoofd/models';
import type { DataRetentionOverview } from '@stamhoofd/structures';
import {
    DataRetentionAction,
    DataRetentionCategory,
    DataRetentionHoldReason,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { DataRetentionCounter } from './DataRetentionCounter.js';

const longAgo = new Date('2018-08-31T00:00:00.000Z');

async function setOrganizationTerms(
    organization: Organization,
    category: DataRetentionCategory,
    terms: { anonymizeAfterMonths?: number; deleteAfterMonths?: number },
) {
    const policy = new DataRetentionPolicy();
    policy.tenantId = '1';
    policy.organizationId = organization.id;
    policy.category = category;
    policy.anonymizeAfterMonths = terms.anonymizeAfterMonths ?? null;
    policy.deleteAfterMonths = terms.deleteAfterMonths ?? null;
    await policy.save();
}

/**
 * By default the platform protects members registered in the last 2 periods, which includes the periods the factories use.
 */
async function turnOffPlatformProtection() {
    const policy = new DataRetentionPolicy();
    policy.tenantId = '1';
    policy.category = DataRetentionCategory.Members;
    await policy.save();
}

async function createFormerMember(organization: Organization) {
    const member = await new MemberFactory({ organization }).create();
    const registration = await new RegistrationFactory({ member, organization }).create();
    registration.endDate = longAgo;
    await registration.save();
    return member;
}

async function countAll() {
    const run = await DataRetentionRun.getOrCreate('1');
    while (!(await DataRetentionCounter.continueRun(run, new Date(Date.now() + 60 * 1000)))) {
        // Keep going until the run is complete
    }
    return run;
}

function getCount(
    overview: DataRetentionOverview | undefined,
    category: DataRetentionCategory,
    action: DataRetentionAction,
) {
    return overview?.counts.find((c) => c.category === category && c.action === action);
}

describe('DataRetentionCounter', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        await DataRetentionPolicy.delete();
        await DataRetentionRun.delete();
        await turnOffPlatformProtection();
    });

    test('By default, members registered in the current period are held', async () => {
        await DataRetentionPolicy.delete();
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        await createFormerMember(organization);

        const run = await countAll();

        const count = getCount(
            run.result.get(organization.id),
            DataRetentionCategory.Members,
            DataRetentionAction.Anonymize,
        );
        expect(count?.due).toBe(0);
        expect(count?.heldBy.get(DataRetentionHoldReason.ProtectedPeriod)).toBe(1);
    });

    test('It counts members whose term has passed, per organization and for the platform', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        await createFormerMember(organization);
        await createFormerMember(organization);

        const run = await countAll();

        expect(
            getCount(
                run.result.get(organization.id),
                DataRetentionCategory.Members,
                DataRetentionAction.Anonymize,
            )?.due,
        ).toBe(2);
        expect(
            getCount(
                run.result.get('platform'),
                DataRetentionCategory.Members,
                DataRetentionAction.Anonymize,
            )?.due,
        ).toBeGreaterThanOrEqual(2);
        expect(run.finishedAt).not.toBeNull();
        expect(run.phase).toBeNull();
    });

    test('It changes no data', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
            deleteAfterMonths: 12,
        });
        const member = await createFormerMember(organization);

        await countAll();

        const reloaded = await Member.getByID(member.id);
        expect(reloaded?.anonymizedAt).toBeNull();
        expect(reloaded?.details.firstName).toBe(member.details.firstName);
    });

    test('A member with an open balance is held', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        const member = await createFormerMember(organization);
        await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            amount: 1,
            unitPrice: 10_00,
        }).create();

        const run = await countAll();

        const count = getCount(
            run.result.get(organization.id),
            DataRetentionCategory.Members,
            DataRetentionAction.Anonymize,
        );
        expect(count?.due).toBe(0);
        expect(count?.held).toBe(1);
        expect(count?.heldBy.get(DataRetentionHoldReason.OpenBalance)).toBe(1);
    });

    test('Without an end date on the registration, the end of the group is used', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        const group = await new GroupFactory({ organization }).create();
        group.settings.endDate = longAgo;
        await group.save();
        const member = await new MemberFactory({ organization }).create();
        await new RegistrationFactory({ member, group }).create();

        const run = await countAll();

        expect(
            getCount(
                run.result.get(organization.id),
                DataRetentionCategory.Members,
                DataRetentionAction.Anonymize,
            )?.due,
        ).toBe(1);
    });

    test('A term that has not passed yet is counted in its month', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        const member = await new MemberFactory({ organization }).create();
        const registration = await new RegistrationFactory({ member, organization }).create();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() - 10);
        registration.endDate = endDate;
        await registration.save();

        const run = await countAll();

        const dueAt = new Date(endDate);
        dueAt.setMonth(dueAt.getMonth() + 12);
        const count = getCount(
            run.result.get(organization.id),
            DataRetentionCategory.Members,
            DataRetentionAction.Anonymize,
        );
        expect(count?.due).toBe(0);
        expect(count?.upcoming.get(dueAt.toISOString().slice(0, 7))).toBe(1);
    });

    test('It counts orders, and skips orders that were already anonymized', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Orders, {
            anonymizeAfterMonths: 12,
        });
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

        for (const anonymizedAt of [null, new Date()]) {
            const order = await new OrderFactory({ webshop }).create();
            order.createdAt = longAgo;
            order.anonymizedAt = anonymizedAt;
            await order.save();
        }

        const run = await countAll();

        expect(
            getCount(
                run.result.get(organization.id),
                DataRetentionCategory.Orders,
                DataRetentionAction.Anonymize,
            )?.due,
        ).toBe(1);
        expect(
            await Order.select().where('webshopId', webshop.id).where('anonymizedAt', null).count(),
        ).toBe(1);
    });

    test('A run continues where it stopped, and keeps the last result until the new run is complete', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        await createFormerMember(organization);
        const first = await countAll();
        const firstResult = first.result.get(organization.id);

        await createFormerMember(organization);
        const run = await DataRetentionRun.getOrCreate('1');
        expect(await DataRetentionCounter.continueRun(run, new Date())).toBe(false);

        const stopped = await DataRetentionRun.getOrCreate('1');
        expect(stopped.phase).not.toBeNull();
        expect(
            getCount(
                stopped.result.get(organization.id),
                DataRetentionCategory.Members,
                DataRetentionAction.Anonymize,
            )?.due,
        ).toBe(
            getCount(firstResult, DataRetentionCategory.Members, DataRetentionAction.Anonymize)
                ?.due,
        );

        const completed = await countAll();
        expect(
            getCount(
                completed.result.get(organization.id),
                DataRetentionCategory.Members,
                DataRetentionAction.Anonymize,
            )?.due,
        ).toBe(2);
    });
});
