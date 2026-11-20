import {
    AuditLog,
    BalanceItemFactory,
    DataRetentionPolicy,
    DataRetentionRun,
    Document,
    DocumentTemplateFactory,
    Email,
    GroupFactory,
    Member,
    MemberFactory,
    MemberPlatformMembership,
    MemberResponsibilityRecordFactory,
    Order,
    OrderFactory,
    Organization,
    OrganizationFactory,
    RegistrationFactory,
    User,
    UserFactory,
    WebshopFactory,
} from '@stamhoofd/models';
import type { DataRetentionOverview } from '@stamhoofd/structures';
import {
    AuditLogType,
    CartItem,
    DATA_RETENTION_LAUNCH_DATE,
    DataRetentionAction,
    DataRetentionCategory,
    DataRetentionHoldReason,
    DataRetentionTerms,
    DocumentStatus,
    EmailStatus,
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

import { DataRetentionAuditLogService } from './DataRetentionAuditLogService.js';
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

async function setPlatformTerms(
    category: DataRetentionCategory,
    terms: { anonymizeAfterMonths?: number; deleteAfterMonths?: number },
) {
    const policy = new DataRetentionPolicy();
    policy.tenantId = '1';
    policy.category = category;
    policy.anonymizeAfterMonths = terms.anonymizeAfterMonths ?? null;
    policy.deleteAfterMonths = terms.deleteAfterMonths ?? null;
    await policy.save();
}

async function createEmail(
    organization: Organization | null,
    options: { sentAt: Date | null; deletedAt?: Date | null },
) {
    const email = new Email();
    email.subject = 'Test';
    email.status = options.sentAt ? EmailStatus.Sent : EmailStatus.Draft;
    email.json = {};
    email.organizationId = organization?.id ?? null;
    email.sentAt = options.sentAt;
    email.deletedAt = options.deletedAt ?? null;
    await email.save();
}

async function createAuditLog(organization: Organization | null, createdAt: Date) {
    const log = new AuditLog();
    log.type = AuditLogType.Unknown;
    log.organizationId = organization?.id ?? null;
    log.description = 'Test';
    log.createdAt = createdAt;
    await log.save();
}

/**
 * The counts of the platform also include everything other tests created, so these tests compare before and after.
 */
async function getPlatformDeletions(category: DataRetentionCategory) {
    const run = await countAll();
    const count = getCount(run.result.get('platform'), category, DataRetentionAction.Delete);
    return { due: count?.due ?? 0, upcoming: new Map(count?.upcoming ?? []) };
}

async function createEnabledOrganization() {
    const organization = await new OrganizationFactory({}).create();
    organization.privateMeta.featureFlags = ['data-retention'];
    await organization.save();
    return organization;
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

        // One call per member, order, organization and account, one for the data without an organization, and one to finish.
        // More calls would mean the cursor is not saved.
        const maxCalls =
            (await Member.select().count()) +
            (await Order.select().where('anonymizedAt', null).count()) +
            (await Organization.select().count()) +
            (await User.select().count()) +
            2;

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
        const organization = await createEnabledOrganization();
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

    test('In userMode organization, only organizations that turned it on are counted', async () => {
        TestUtils.setEnvironment('userMode', 'organization');
        const enabled = await createEnabledOrganization();
        const other = await new OrganizationFactory({}).create();
        for (const organization of [enabled, other]) {
            await setOrganizationTerms(organization, DataRetentionCategory.Members, {
                anonymizeAfterMonths: 12,
            });
            await setOrganizationTerms(organization, DataRetentionCategory.Orders, {
                anonymizeAfterMonths: 12,
            });
            const member = await createFormerMember(organization);
            member.organizationId = organization.id;
            await member.save();
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
            const order = await new OrderFactory({ webshop }).create();
            order.createdAt = longAgo;
            await order.save();
        }

        const run = await countAll();

        expect(
            getCount(
                run.result.get(enabled.id),
                DataRetentionCategory.Members,
                DataRetentionAction.Anonymize,
            )?.due,
        ).toBe(1);
        expect(
            getCount(
                run.result.get(enabled.id),
                DataRetentionCategory.Orders,
                DataRetentionAction.Anonymize,
            )?.due,
        ).toBe(1);
        expect(run.result.get(other.id)).toBeUndefined();
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
    describe('Categories that only follow a date', () => {
        async function getOrganizationDeletions(
            organization: Organization,
            category: DataRetentionCategory,
        ) {
            const run = await countAll();
            return getCount(run.result.get(organization.id), category, DataRetentionAction.Delete);
        }

        test('Sent e-mails are counted from their send date, drafts and deleted e-mails are not', async () => {
            const organization = await new OrganizationFactory({}).create();
            await setOrganizationTerms(organization, DataRetentionCategory.Emails, {
                deleteAfterMonths: 12,
            });
            const recent = monthsFromNow(-6);
            await createEmail(organization, { sentAt: longAgo });
            await createEmail(organization, { sentAt: longAgo });
            await createEmail(organization, { sentAt: recent });
            await createEmail(organization, { sentAt: null });
            await createEmail(organization, { sentAt: longAgo, deletedAt: new Date() });

            const count = await getOrganizationDeletions(
                organization,
                DataRetentionCategory.Emails,
            );

            expect(count?.due).toBe(2);
            expect(count?.upcoming.get(getMonthKey(monthsFromNow(6)))).toBe(1);
            expect([...count!.upcoming.values()].reduce((a, b) => a + b, 0)).toBe(1);
        });

        test('Documents are counted from their creation, except deleted documents', async () => {
            const organization = await new OrganizationFactory({}).create();
            await setOrganizationTerms(organization, DataRetentionCategory.Documents, {
                deleteAfterMonths: 12,
            });
            const group = await new GroupFactory({ organization }).create();
            const template = await new DocumentTemplateFactory({ groups: [group] }).create();
            for (const status of [DocumentStatus.Published, DocumentStatus.Deleted]) {
                const document = new Document();
                document.organizationId = organization.id;
                document.templateId = template.id;
                document.status = status;
                document.createdAt = longAgo;
                await document.save();
            }

            const count = await getOrganizationDeletions(
                organization,
                DataRetentionCategory.Documents,
            );

            expect(count?.due).toBe(1);
        });

        test('Audit logs are counted from their date, except the logs about the terms themselves', async () => {
            const organization = await new OrganizationFactory({}).create();
            await setOrganizationTerms(organization, DataRetentionCategory.AuditLogs, {
                deleteAfterMonths: 12,
            });
            await createAuditLog(organization, longAgo);

            const policy = new DataRetentionPolicy();
            policy.tenantId = '1';
            policy.organizationId = organization.id;
            policy.category = DataRetentionCategory.Emails;
            await policy.save();
            await DataRetentionAuditLogService.logPendingChangeApplied(
                policy,
                DataRetentionTerms.create({}),
            );
            await AuditLog.update()
                .set('createdAt', longAgo)
                .where('organizationId', organization.id)
                .where('type', AuditLogType.DataRetentionPendingChangeApplied)
                .update();

            const count = await getOrganizationDeletions(
                organization,
                DataRetentionCategory.AuditLogs,
            );

            expect(count?.due).toBe(1);
        });

        test('E-mails and audit logs without an organization follow the platform', async () => {
            await setPlatformTerms(DataRetentionCategory.AuditLogs, { deleteAfterMonths: 12 });
            await setPlatformTerms(DataRetentionCategory.Emails, { deleteAfterMonths: 12 });
            const auditLogsBefore = await getPlatformDeletions(DataRetentionCategory.AuditLogs);
            const emailsBefore = await getPlatformDeletions(DataRetentionCategory.Emails);

            await createAuditLog(null, longAgo);
            await createEmail(null, { sentAt: longAgo });

            const auditLogsAfter = await getPlatformDeletions(DataRetentionCategory.AuditLogs);
            const emailsAfter = await getPlatformDeletions(DataRetentionCategory.Emails);
            expect(auditLogsAfter.due - auditLogsBefore.due).toBe(1);
            expect(emailsAfter.due - emailsBefore.due).toBe(1);
        });

        test('Items of one day are only due when the latest of that day is due', async () => {
            const organization = await new OrganizationFactory({}).create();
            await setOrganizationTerms(organization, DataRetentionCategory.Emails, {
                deleteAfterMonths: 12,
            });

            // Three on one day and one on another day, both long ago
            for (let i = 0; i < 3; i++) {
                await createEmail(organization, { sentAt: longAgo });
            }
            await createEmail(organization, { sentAt: new Date('2018-06-01T10:00:00.000Z') });

            // Grouped per day in UTC: the start of this day has passed its term, the end has not
            const day = DateTime.now().toUTC().minus({ months: 12 }).startOf('day');
            await createEmail(organization, { sentAt: day.plus({ seconds: 1 }).toJSDate() });
            await createEmail(organization, {
                sentAt: day.endOf('day').startOf('second').toJSDate(),
            });

            const count = await getOrganizationDeletions(
                organization,
                DataRetentionCategory.Emails,
            );

            expect(count?.due).toBe(4);
            expect([...count!.upcoming.values()].reduce((a, b) => a + b, 0)).toBe(2);
        });

        test('Accounts are counted from their last activity, and only when they are not linked to anything', async () => {
            await setPlatformTerms(DataRetentionCategory.Accounts, { deleteAfterMonths: 3 });
            const organization = await new OrganizationFactory({}).create();
            const before = await getPlatformDeletions(DataRetentionCategory.Accounts);

            // Not active since the launch date: due 3 months after the launch date
            await new UserFactory({}).create();

            // Never counted: the member's own account, the system account and an API account
            const ownAccount = await new UserFactory({}).create();
            ownAccount.memberId = (await new MemberFactory({ organization }).create()).id;
            await ownAccount.save();
            if (!(await User.getByID('1'))) {
                const system = await new UserFactory({}).create();
                await User.update().set('id', '1').where('id', system.id).update();
            }
            await new UserFactory({ apiUser: true, verified: true }).create();

            const active = await new UserFactory({}).create();
            active.lastActiveAt = new Date();
            await active.save();

            const member = await new MemberFactory({ organization }).create();
            const parent = await new UserFactory({}).create();
            await Member.users.link(member, [parent]);

            await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const debtor = await new UserFactory({}).create();
            await new BalanceItemFactory({
                organizationId: organization.id,
                userId: debtor.id,
                amount: 1,
                unitPrice: 10_00,
            }).create();

            const after = await getPlatformDeletions(DataRetentionCategory.Accounts);
            const delta = (month: string) =>
                (after.upcoming.get(month) ?? 0) - (before.upcoming.get(month) ?? 0);

            // Only the account that was never active, and the active account, are counted
            const neverActiveDue = DateTime.fromJSDate(DATA_RETENTION_LAUNCH_DATE, {
                zone: Formatter.timezone,
            })
                .plus({ months: 3 })
                .toJSDate();
            const activeMonth = getMonthKey(monthsFromNow(3));
            if (neverActiveDue <= new Date()) {
                expect(after.due - before.due).toBe(1);
                expect(delta(activeMonth)).toBe(1);
            } else {
                const neverActiveMonth = getMonthKey(neverActiveDue);
                expect(after.due - before.due).toBe(0);
                expect(delta(neverActiveMonth) + delta(activeMonth)).toBe(
                    neverActiveMonth === activeMonth ? 4 : 2,
                );
            }
        });
    });
});
