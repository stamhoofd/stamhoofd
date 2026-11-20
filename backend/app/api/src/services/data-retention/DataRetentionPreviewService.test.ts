import type { Organization } from '@stamhoofd/models';
import {
    DataRetentionPolicy,
    Email,
    MemberFactory,
    OrderFactory,
    OrganizationFactory,
    RegistrationFactory,
    WebshopFactory,
} from '@stamhoofd/models';
import {
    DataRetentionAction,
    DataRetentionCategory,
    DataRetentionTerms,
    EmailStatus,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { DataRetentionPreviewService } from './DataRetentionPreviewService.js';

const longAgo = new Date('2018-08-31T00:00:00.000Z');
const later = () => new Date(Date.now() + 60 * 1000);

/**
 * By default the platform protects members registered in the last 2 periods, which includes the periods the factories use.
 */
async function turnOffPlatformProtection() {
    const policy = new DataRetentionPolicy();
    policy.tenantId = '1';
    policy.category = DataRetentionCategory.Members;
    await policy.save();
}

async function createFormerMember(organization: Organization, endDate = longAgo) {
    const member = await new MemberFactory({ organization }).create();
    const registration = await new RegistrationFactory({ member, organization }).create();
    registration.endDate = endDate;
    await registration.save();
    return member;
}

function monthsAgo(months: number, days = 0) {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    date.setDate(date.getDate() - days);
    return date;
}

async function setOrganizationTerms(
    organization: Organization,
    category: DataRetentionCategory,
    terms: { anonymizeAfterMonths?: number; deleteAfterMonths?: number },
    pending?: { terms: DataRetentionTerms; from: Date },
) {
    const policy = new DataRetentionPolicy();
    policy.tenantId = '1';
    policy.organizationId = organization.id;
    policy.category = category;
    policy.anonymizeAfterMonths = terms.anonymizeAfterMonths ?? null;
    policy.deleteAfterMonths = terms.deleteAfterMonths ?? null;
    policy.setPendingTerms(pending ?? null);
    await policy.save();
}

function getCount(
    counts: { category: DataRetentionCategory; action: DataRetentionAction; due: number }[] | null,
    action: DataRetentionAction,
) {
    return counts?.find((c) => c.action === action);
}

describe('DataRetentionPreviewService', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        await DataRetentionPolicy.delete();
        await turnOffPlatformProtection();
    });

    test('A first term counts the members of the organization that are due once it applies', async () => {
        const organization = await new OrganizationFactory({}).create();
        const other = await new OrganizationFactory({}).create();
        await createFormerMember(organization);
        await createFormerMember(organization);
        await createFormerMember(other);

        const preview = await DataRetentionPreviewService.preview(
            organization,
            DataRetentionCategory.Members,
            DataRetentionTerms.create({ anonymizeAfterMonths: 12 }),
            later(),
        );

        expect(preview.waits).toBe(true);
        expect(preview.from.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
        expect(getCount(preview.counts, DataRetentionAction.Anonymize)?.due).toBe(2);
    });

    test('A longer term does not wait, so nothing is counted', async () => {
        const organization = await new OrganizationFactory({}).create();
        const policy = new DataRetentionPolicy();
        policy.tenantId = '1';
        policy.organizationId = organization.id;
        policy.category = DataRetentionCategory.Members;
        policy.anonymizeAfterMonths = 12;
        await policy.save();
        await createFormerMember(organization);

        const preview = await DataRetentionPreviewService.preview(
            organization,
            DataRetentionCategory.Members,
            DataRetentionTerms.create({ anonymizeAfterMonths: 24 }),
            later(),
        );

        expect(preview.waits).toBe(false);
        expect(preview.counts).toBeNull();
    });

    test('A count that does not finish in time has no numbers', async () => {
        const organization = await new OrganizationFactory({}).create();
        await createFormerMember(organization);

        const preview = await DataRetentionPreviewService.preview(
            organization,
            DataRetentionCategory.Members,
            DataRetentionTerms.create({ anonymizeAfterMonths: 12 }),
            new Date(Date.now() - 1000),
        );

        expect(preview.waits).toBe(true);
        expect(preview.counts).toBeNull();
    });

    test('Categories that follow a date are counted for the organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        for (const sentAt of [longAgo, longAgo, new Date()]) {
            const email = new Email();
            email.subject = 'Test';
            email.status = EmailStatus.Sent;
            email.json = {};
            email.organizationId = organization.id;
            email.sentAt = sentAt;
            await email.save();
        }

        const preview = await DataRetentionPreviewService.preview(
            organization,
            DataRetentionCategory.Emails,
            DataRetentionTerms.create({ deleteAfterMonths: 12 }),
            later(),
        );

        expect(getCount(preview.counts, DataRetentionAction.Delete)?.due).toBe(2);
    });

    test('The platform counts the members of every organization', async () => {
        const first = await new OrganizationFactory({}).create();
        const second = await new OrganizationFactory({}).create();
        await createFormerMember(first);
        await createFormerMember(second);

        const preview = await DataRetentionPreviewService.preview(
            null,
            DataRetentionCategory.Members,
            DataRetentionTerms.create({ anonymizeAfterMonths: 12 }),
            later(),
        );

        expect(getCount(preview.counts, DataRetentionAction.Anonymize)?.due).toBeGreaterThanOrEqual(
            2,
        );
    });

    test('Only what the change processes sooner is counted, as on the day it applies', async () => {
        TestUtils.setEnvironment('userMode', 'organization');
        const organization = await new OrganizationFactory({}).create();
        await setOrganizationTerms(organization, DataRetentionCategory.Members, {
            anonymizeAfterMonths: 24,
        });
        // Already processed with the current term of 2 years
        await createFormerMember(organization, longAgo);
        // Only processed with the new term of 1 year
        await createFormerMember(organization, monthsAgo(18));
        // Its new term passes after today, but before the change applies after 30 days
        await createFormerMember(organization, monthsAgo(11, 15));

        const preview = await DataRetentionPreviewService.preview(
            organization,
            DataRetentionCategory.Members,
            DataRetentionTerms.create({ anonymizeAfterMonths: 12 }),
            later(),
        );

        expect(preview.waits).toBe(true);
        expect(getCount(preview.counts, DataRetentionAction.Anonymize)?.due).toBe(2);
    });

    test('Saving the same waiting change again keeps its date', async () => {
        const organization = await new OrganizationFactory({}).create();
        const pendingFrom = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
        pendingFrom.setMilliseconds(0);
        await setOrganizationTerms(
            organization,
            DataRetentionCategory.Members,
            {},
            { terms: DataRetentionTerms.create({ anonymizeAfterMonths: 12 }), from: pendingFrom },
        );

        const preview = await DataRetentionPreviewService.preview(
            organization,
            DataRetentionCategory.Members,
            DataRetentionTerms.create({ anonymizeAfterMonths: 12 }),
            later(),
        );

        expect(preview.waits).toBe(true);
        expect(preview.from).toEqual(pendingFrom);
    });

    test('Orders of the organization are counted', async () => {
        const organization = await new OrganizationFactory({}).create();
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
        for (const createdAt of [longAgo, new Date()]) {
            const order = await new OrderFactory({ webshop }).create();
            order.createdAt = createdAt;
            await order.save();
        }

        const preview = await DataRetentionPreviewService.preview(
            organization,
            DataRetentionCategory.Orders,
            DataRetentionTerms.create({ anonymizeAfterMonths: 12 }),
            later(),
        );

        expect(getCount(preview.counts, DataRetentionAction.Anonymize)?.due).toBe(1);
    });
});
