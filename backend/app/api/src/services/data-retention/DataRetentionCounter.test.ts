import type { Organization } from '@stamhoofd/models';
import {
    BalanceItemFactory,
    DataRetentionPolicy,
    DataRetentionRun,
    GroupFactory,
    Member,
    MemberFactory,
    MemberPlatformMembership,
    MemberResponsibilityRecordFactory,
    Order,
    OrderFactory,
    OrganizationFactory,
    RegistrationFactory,
    UserFactory,
    WebshopFactory,
} from '@stamhoofd/models';
import type { DataRetentionOverview } from '@stamhoofd/structures';
import {
    CartItem,
    DataRetentionAction,
    DataRetentionCategory,
    DataRetentionHoldReason,
    Permissions,
    Product,
    ProductDateRange,
    WebshopTimeSlot,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';
import { v4 as uuidv4 } from 'uuid';

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
    while (
        !(await DataRetentionCounter.continueRun(run, {
            deadline: new Date(Date.now() + 60 * 1000),
        }))
    ) {
        // Keep going until the run is complete
    }
    return run;
}

function monthsFromNow(months: number) {
    return DateTime.now().plus({ months }).toJSDate();
}

function getMonthKey(date: Date) {
    return DateTime.fromJSDate(date, { zone: Formatter.timezone }).toFormat('yyyy-MM');
}

async function getMemberCount(organization: Organization, action = DataRetentionAction.Anonymize) {
    const run = await countAll();
    return getCount(run.result.get(organization.id), DataRetentionCategory.Members, action);
}

async function createMembership(
    member: Member,
    organization: Organization,
    options: { locked?: boolean; deletedAt?: Date | null } = {},
) {
    const membership = new MemberPlatformMembership();
    membership.memberId = member.id;
    membership.membershipTypeId = uuidv4();
    membership.organizationId = organization.id;
    membership.periodId = organization.periodId;
    membership.startDate = longAgo;
    membership.endDate = longAgo;
    membership.locked = options.locked ?? false;
    membership.deletedAt = options.deletedAt ?? null;
    await membership.save();
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

        const dueAt = DateTime.fromJSDate(endDate, { zone: Formatter.timezone })
            .plus({ months: 12 })
            .toJSDate();
        const count = getCount(
            run.result.get(organization.id),
            DataRetentionCategory.Members,
            DataRetentionAction.Anonymize,
        );
        expect(count?.due).toBe(0);
        expect(count?.upcoming.get(getMonthKey(dueAt))).toBe(1);
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

    test('A run keeps the last result until the new run is complete', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        await createFormerMember(organization);
        await countAll();

        await createFormerMember(organization);
        const run = await DataRetentionRun.getOrCreate('1');
        expect(
            await DataRetentionCounter.continueRun(run, {
                deadline: new Date(Date.now() + 60 * 1000),
                maxBatches: 1,
            }),
        ).toBe(false);

        const stopped = await DataRetentionRun.getOrCreate('1');
        expect(stopped.phase).not.toBeNull();
        expect(
            getCount(
                stopped.result.get(organization.id),
                DataRetentionCategory.Members,
                DataRetentionAction.Anonymize,
            )?.due,
        ).toBe(1);
    });

    test('A run continues where it stopped, without counting anything twice', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        for (let i = 0; i < 3; i++) {
            await createFormerMember(organization);
        }

        // One call per member and order, plus one to finish. More calls would mean the cursor is not saved.
        const maxCalls =
            (await Member.select().count()) +
            (await Order.select().where('anonymizedAt', null).count()) +
            1;

        // Reload the run from the database after every batch, as the next cron call would
        let complete = false;
        let calls = 0;
        while (!complete && calls < maxCalls) {
            const run = await DataRetentionRun.getOrCreate('1');
            complete = await DataRetentionCounter.continueRun(run, {
                deadline: new Date(Date.now() + 60 * 1000),
                batchSize: 1,
                maxBatches: 1,
            });
            calls += 1;
        }

        const run = await DataRetentionRun.getOrCreate('1');
        expect(complete).toBe(true);
        expect(calls).toBeGreaterThan(3);
        expect(
            getCount(
                run.result.get(organization.id),
                DataRetentionCategory.Members,
                DataRetentionAction.Anonymize,
            )?.due,
        ).toBe(3);
    });

    test('A member without registrations is only counted for the platform', async () => {
        await DataRetentionPolicy.delete();
        const platformPolicy = new DataRetentionPolicy();
        platformPolicy.tenantId = '1';
        platformPolicy.category = DataRetentionCategory.Members;
        platformPolicy.anonymizeAfterMonths = 12;
        await platformPolicy.save();

        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        const member = await new MemberFactory({ organization }).create();
        member.organizationId = organization.id;
        await member.save();

        const run = await countAll();

        expect(run.result.get(organization.id)).toBeUndefined();
        expect(
            getCount(
                run.result.get('platform'),
                DataRetentionCategory.Members,
                DataRetentionAction.Anonymize,
            )?.upcoming.get(getMonthKey(monthsFromNow(12))),
        ).toBeGreaterThanOrEqual(1);
    });

    test('In userMode organization, a member without registrations is counted for its own organization', async () => {
        TestUtils.setEnvironment('userMode', 'organization');
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        const member = await new MemberFactory({ organization }).create();
        member.organizationId = organization.id;
        await member.save();

        const run = await countAll();

        expect(
            getCount(
                run.result.get(organization.id),
                DataRetentionCategory.Members,
                DataRetentionAction.Anonymize,
            )?.upcoming.get(getMonthKey(monthsFromNow(12))),
        ).toBe(1);
        expect(run.result.get('platform')).toBeUndefined();
    });

    test('Upcoming counts cover the current month and the 12 months after it', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        const limit = DateTime.now()
            .setZone(Formatter.timezone)
            .startOf('month')
            .plus({ months: 13 });
        const lastUpcoming = limit.minus({ months: 12, days: 1 }).toJSDate();
        const firstLater = limit.minus({ months: 12 }).toJSDate();

        for (const endDate of [lastUpcoming, firstLater]) {
            const member = await new MemberFactory({ organization }).create();
            const registration = await new RegistrationFactory({ member, organization }).create();
            registration.endDate = endDate;
            await registration.save();
        }

        const count = (await getMemberCount(organization))!;
        expect(count.upcoming.get(limit.minus({ months: 1 }).toFormat('yyyy-MM'))).toBe(1);
        expect(count.upcoming.get('later')).toBe(1);
    });

    test('A deactivated registration ends at its deactivation', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        const member = await new MemberFactory({ organization }).create();
        const registration = await new RegistrationFactory({ member, organization }).create();
        registration.endDate = monthsFromNow(24);
        registration.deactivatedAt = longAgo;
        await registration.save();

        expect((await getMemberCount(organization))?.due).toBe(1);
    });

    test('A member with an active responsibility is held, but not after it ended', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        const active = await createFormerMember(organization);
        await new MemberResponsibilityRecordFactory({
            member: active,
            organizationId: organization.id,
        }).create();
        const ended = await createFormerMember(organization);
        const record = await new MemberResponsibilityRecordFactory({
            member: ended,
            organizationId: organization.id,
        }).create();
        record.endDate = longAgo;
        await record.save();

        const count = await getMemberCount(organization);
        expect(count?.due).toBe(1);
        expect(count?.heldBy.get(DataRetentionHoldReason.ActiveResponsibility)).toBe(1);
    });

    test("A member is held by its own admin account, but not by a parent's admin account", async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
        });
        const permissions = Permissions.create({ level: PermissionLevel.Full });

        const admin = await createFormerMember(organization);
        const adminUser = await new UserFactory({ organization, permissions }).create();
        adminUser.memberId = admin.id;
        await adminUser.save();
        await Member.users.link(admin, [adminUser]);

        const child = await createFormerMember(organization);
        const parentUser = await new UserFactory({ organization, permissions }).create();
        await Member.users.link(child, [parentUser]);

        const count = await getMemberCount(organization);
        expect(count?.due).toBe(1);
        expect(count?.heldBy.get(DataRetentionHoldReason.AdminAccount)).toBe(1);
    });

    test('Only a membership that was not charged yet holds deleting', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 12,
            deleteAfterMonths: 12,
        });
        await createMembership(await createFormerMember(organization), organization);
        await createMembership(await createFormerMember(organization), organization, {
            locked: true,
        });
        await createMembership(await createFormerMember(organization), organization, {
            deletedAt: new Date(),
        });

        const count = await getMemberCount(organization, DataRetentionAction.Delete);
        expect(count?.due).toBe(2);
        expect(count?.heldBy.get(DataRetentionHoldReason.UnchargedMembership)).toBe(1);
        expect((await getMemberCount(organization))?.due).toBe(3);
    });

    test('The term of an order starts at its time slot or at the end of a product date', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Orders, {
            anonymizeAfterMonths: 12,
        });
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
        const timeSlotDate = monthsFromNow(-6);
        const productEndDate = monthsFromNow(-4);

        const withTimeSlot = await new OrderFactory({ webshop }).create();
        withTimeSlot.createdAt = longAgo;
        withTimeSlot.data.timeSlot = WebshopTimeSlot.create({ date: timeSlotDate });
        await withTimeSlot.save();

        const withProductDate = await new OrderFactory({ webshop }).create();
        withProductDate.createdAt = longAgo;
        const product = Product.create({
            dateRange: ProductDateRange.create({ startDate: longAgo, endDate: productEndDate }),
        });
        withProductDate.data.cart.items.push(
            CartItem.create({ product, productPrice: product.prices[0] }),
        );
        await withProductDate.save();

        const run = await countAll();

        const count = getCount(
            run.result.get(organization.id),
            DataRetentionCategory.Orders,
            DataRetentionAction.Anonymize,
        );
        const after12Months = (date: Date) =>
            DateTime.fromJSDate(date, { zone: Formatter.timezone }).plus({ months: 12 }).toJSDate();
        expect(count?.due).toBe(0);
        expect(count?.upcoming.get(getMonthKey(after12Months(timeSlotDate)))).toBe(1);
        expect(count?.upcoming.get(getMonthKey(after12Months(productEndDate)))).toBe(1);
    });

    test('An order with an open balance is held', async () => {
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Orders, {
            anonymizeAfterMonths: 12,
        });
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
        const order = await new OrderFactory({ webshop }).create();
        order.createdAt = longAgo;
        await order.save();
        await new BalanceItemFactory({
            organizationId: organization.id,
            orderId: order.id,
            amount: 1,
            unitPrice: 10_00,
        }).create();

        const run = await countAll();

        const count = getCount(
            run.result.get(organization.id),
            DataRetentionCategory.Orders,
            DataRetentionAction.Anonymize,
        );
        expect(count?.due).toBe(0);
        expect(count?.heldBy.get(DataRetentionHoldReason.OpenBalance)).toBe(1);
    });
});
