import { Database } from '@node/database';
import { EmailMocker } from '@stamhoofd/email';
import type { Organization } from '@stamhoofd/models';
import { JudicialRecord, Member, MemberFactory, MemberResponsibilityRecordFactory, OrganizationFactory, Platform, PlatformResponsibilityFactory } from '@stamhoofd/models';
import type { MemberResponsibility } from '@stamhoofd/structures';
import { JUDICIAL_RECORD_VALIDITY_YEARS, JudicialRecordReviewStatus } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { JUDICIAL_RECORD_EXPIRY_WARNING_DAYS, sendExpiryWarnings } from './judicial-record-expiry-emails.js';

const seedMigration = path.resolve(import.meta.dirname, '../migrations/1794326104-default-judicial-record-email-templates.sql');

describe('judicialRecordExpiryEmails', () => {
    let organization: Organization;
    let withAge: MemberResponsibility;
    let withoutAge: MemberResponsibility;
    let originalResponsibilities: MemberResponsibility[];

    const now = new Date(2026, 5, 15);

    /** A review date whose decision lapses `inDays` days from `now`. Negative means it already lapsed. */
    function reviewedSoItExpiresIn(inDays: number): Date {
        return Formatter.luxon(now)
            .plus({ days: inDays })
            .minus({ years: JUDICIAL_RECORD_VALIDITY_YEARS })
            .toJSDate();
    }

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        organization = await new OrganizationFactory({}).create();

        const platform = await Platform.getForEditing();
        originalResponsibilities = platform.config.responsibilities;

        withAge = await new PlatformResponsibilityFactory({ name: 'Judicial record needed', judicialRecordMinimumAge: 18 }).create();
        withoutAge = await new PlatformResponsibilityFactory({ name: 'No judicial record needed' }).create();

        // The integration setup empties `email_templates` before every file, so the shipped seed is restored
        // here. Without a template nothing is sent and the mail assertions below would pass on an empty inbox.
        await Database.statement(await readFile(seedMigration, 'utf-8'));
    });

    afterAll(async () => {
        const platform = await Platform.getForEditing();
        platform.config.responsibilities = originalResponsibilities;
        await platform.save();
    });

    async function createMember(responsibility: MemberResponsibility): Promise<Member> {
        const member = await new MemberFactory({
            organization,
            firstName: 'Nora',
            lastName: 'Peeters',
            birthDay: { year: 1990, month: 3, day: 10 },
        }).create();

        member.details.email = 'nora@example.com';
        await member.save();

        await new MemberResponsibilityRecordFactory({
            member,
            organizationId: organization.id,
            responsibility,
            startDate: new Date(2024, 0, 1),
            endDate: null,
        }).create();

        return member;
    }

    async function createRecord(member: Member, { reviewStatus = JudicialRecordReviewStatus.Ok, reviewedAt, expiryNotifiedAt = null, supersededAt = null }: {
        reviewStatus?: JudicialRecordReviewStatus;
        reviewedAt: Date;
        expiryNotifiedAt?: Date | null;
        supersededAt?: Date | null;
    }): Promise<JudicialRecord> {
        const record = new JudicialRecord();
        record.memberId = member.id;
        record.reviewStatus = reviewStatus;
        record.reviewedAt = reviewedAt;
        record.identityHash = member.judicialIdentityHash!;
        record.expiryNotifiedAt = expiryNotifiedAt;
        record.supersededAt = supersededAt;
        await record.save();
        return record;
    }

    test('a decision that lapses inside the warning window is announced once', async () => {
        const member = await createMember(withAge);
        const record = await createRecord(member, { reviewedAt: reviewedSoItExpiresIn(JUDICIAL_RECORD_EXPIRY_WARNING_DAYS - 1) });

        expect(await sendExpiryWarnings(now)).toBe(1);

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].to).toContain('nora@example.com');

        // A second run finds nothing, which is the whole point of the column.
        expect(await sendExpiryWarnings(now)).toBe(0);
        expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(1);

        const reloaded = await JudicialRecord.getByID(record.id);
        expect(reloaded!.expiryNotifiedAt).not.toBeNull();
    });

    test('a decision that lapses after the window is left alone', async () => {
        const member = await createMember(withAge);
        await createRecord(member, { reviewedAt: reviewedSoItExpiresIn(JUDICIAL_RECORD_EXPIRY_WARNING_DAYS + 1) });

        expect(await sendExpiryWarnings(now)).toBe(0);
        expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);
    });

    test('a decision that already lapsed is still announced, so nobody is silently blocked', async () => {
        const member = await createMember(withAge);
        await createRecord(member, { reviewedAt: reviewedSoItExpiresIn(-10) });

        expect(await sendExpiryWarnings(now)).toBe(1);
    });

    test('a rejection is not announced, because the member was already told to deliver again', async () => {
        const member = await createMember(withAge);
        await createRecord(member, {
            reviewStatus: JudicialRecordReviewStatus.PermanentlyRejected,
            reviewedAt: reviewedSoItExpiresIn(1),
        });

        expect(await sendExpiryWarnings(now)).toBe(0);
    });

    test('a conditional acceptance is announced, because it was an approval', async () => {
        const member = await createMember(withAge);
        await createRecord(member, {
            reviewStatus: JudicialRecordReviewStatus.ConditionallyAccepted,
            reviewedAt: reviewedSoItExpiresIn(1),
        });

        expect(await sendExpiryWarnings(now)).toBe(1);
    });

    test('a superseded row is ignored, only the current one counts', async () => {
        const member = await createMember(withAge);
        await createRecord(member, {
            reviewedAt: reviewedSoItExpiresIn(1),
            supersededAt: new Date(2026, 0, 1),
        });

        expect(await sendExpiryWarnings(now)).toBe(0);
    });

    test('a member whose responsibility no longer asks for an extract is not chased', async () => {
        const member = await createMember(withoutAge);
        await createRecord(member, { reviewedAt: reviewedSoItExpiresIn(1) });

        expect(await sendExpiryWarnings(now)).toBe(0);
        expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);
    });

    test('a member without an email address is marked rather than reconsidered every night', async () => {
        const member = await createMember(withAge);
        member.details.email = null;
        await member.save();

        const record = await createRecord(member, { reviewedAt: reviewedSoItExpiresIn(1) });

        expect(await sendExpiryWarnings(now)).toBe(1);
        expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);

        const reloaded = await JudicialRecord.getByID(record.id);
        expect(reloaded!.expiryNotifiedAt).not.toBeNull();
    });
});
