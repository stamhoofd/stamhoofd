import { Database } from '@node/database';
import { EmailMocker } from '@stamhoofd/email';
import type { Organization } from '@stamhoofd/models';
import { JudicialRecord, Member, MemberFactory, OrganizationFactory } from '@stamhoofd/models';
import { EmailTemplateType, JudicialRecordReviewDetails, JudicialRecordReviewStatus } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getEmailTemplate } from '../../helpers/EmailBuilder.js';
import { JudicialRecordNotificationService } from './JudicialRecordNotificationService.js';

const seedMigration = path.resolve(import.meta.dirname, '../../migrations/1794326104-default-judicial-record-email-templates.sql');

describe('JudicialRecordNotificationService', () => {
    let organization: Organization;

    const judicialRecordTypes = [
        EmailTemplateType.JudicialRecordAwaitingReview,
        EmailTemplateType.JudicialRecordApproved,
        EmailTemplateType.JudicialRecordConditionallyAccepted,
        EmailTemplateType.JudicialRecordTemporarilyRejected,
        EmailTemplateType.JudicialRecordPermanentlyRejected,
        EmailTemplateType.JudicialRecordExpiringSoon,
    ];

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        organization = await new OrganizationFactory({}).create();

        // The integration setup empties `email_templates` before every file, migration seeds included, so the
        // seed is applied again here. Running the migration's own SQL rather than an EmailTemplateFactory is
        // the point: a factory row would prove the service sends mail while saying nothing about whether the
        // content that ships actually exists or resolves.
        await Database.statement(await readFile(seedMigration, 'utf-8'));
    });

    async function createMember({ email = 'nora@example.com' }: { email?: string | null } = {}): Promise<Member> {
        const member = await new MemberFactory({ organization, firstName: 'Nora', lastName: 'Peeters' }).create();
        member.details.email = email;
        await member.save();
        return member;
    }

    async function createRecord(member: Member, reviewStatus: JudicialRecordReviewStatus, { comment = null, reviewedAt = new Date() }: { comment?: string | null; reviewedAt?: Date | null } = {}): Promise<JudicialRecord> {
        const record = new JudicialRecord();
        record.memberId = member.id;
        record.reviewStatus = reviewStatus;
        record.reviewedAt = reviewedAt;
        record.identityHash = member.judicialIdentityHash!;
        record.reviewDetails = JudicialRecordReviewDetails.create({
            name: 'Wouter',
            email: 'wouter@example.com',
            organizationId: organization.id,
            comment,
        });
        await record.save();
        return record;
    }

    /**
     * A template type without a seeded row sends nothing at all - silently in production, and in test
     * `getEmailTemplate` returns undefined before any email is built. So these assert the seed resolves
     * rather than that the service was called, which would pass just as well with no template in the
     * database and no mail ever leaving.
     */
    describe('seeded default templates', () => {
        test.each(judicialRecordTypes)('%s resolves to the platform level row', async (type) => {
            const template = await getEmailTemplate({ type, organizationId: organization.id });

            expect(template).toBeDefined();
            expect(template!.organizationId).toBeNull();
            expect(template!.subject).not.toBe('');
            expect(template!.text).toContain('{{greeting}}');
        });

        test('every judicial record template type has a seed, so a new type cannot ship unsendable', async () => {
            const sql = await readFile(seedMigration, 'utf-8');
            const seeded = Object.values(EmailTemplateType).filter(type => type.startsWith('JudicialRecord'));

            expect(seeded).toHaveLength(judicialRecordTypes.length);

            for (const type of seeded) {
                expect(sql).toContain(`'${type}'`);
            }
        });

        test('the member templates link to the delivery flow and the reviewer template does not', async () => {
            for (const type of judicialRecordTypes) {
                const template = await getEmailTemplate({ type, organizationId: organization.id });

                if (type === EmailTemplateType.JudicialRecordAwaitingReview) {
                    expect(template!.text).toContain('{{reviewUrl}}');
                    expect(template!.text).not.toContain('{{judicialRecordUrl}}');
                }
            }
        });

        test('no template calls an extract an attest', async () => {
            for (const type of judicialRecordTypes) {
                const template = await getEmailTemplate({ type, organizationId: organization.id });

                expect(template!.subject.toLowerCase()).not.toContain('attest');
                expect(template!.text.toLowerCase()).not.toContain('attest');
                expect(template!.text.toLowerCase()).toContain('uittreksel');
            }
        });
    });

    describe('sendDecision', () => {
        test.each([
            [JudicialRecordReviewStatus.Ok, 'Je hoeft nu niets te doen'],
            [JudicialRecordReviewStatus.ConditionallyAccepted, 'met deze voorwaarden'],
            [JudicialRecordReviewStatus.TemporarilyRejected, 'Je moet een nieuw uittreksel afleveren'],
            [JudicialRecordReviewStatus.PermanentlyRejected, 'definitief afgekeurd'],
        ])('%s tells the member what was decided', async (reviewStatus, expectedPhrase) => {
            const member = await createMember();
            const record = await createRecord(member, reviewStatus);

            await JudicialRecordNotificationService.sendDecision(record, member);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails).toHaveLength(1);
            expect(emails[0].to).toContain('nora@example.com');
            expect(emails[0].text).toContain(expectedPhrase);
        });

        test('nothing is sent while nobody has looked at the extract', async () => {
            const member = await createMember();
            const record = await createRecord(member, JudicialRecordReviewStatus.UnderReview, { reviewedAt: null });

            await JudicialRecordNotificationService.sendDecision(record, member);

            expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);
        });

        test('a member without an email address is skipped rather than failing', async () => {
            const member = await createMember({ email: null });
            const record = await createRecord(member, JudicialRecordReviewStatus.Ok);

            await JudicialRecordNotificationService.sendDecision(record, member);

            expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);
        });

        test('the conditions a reviewer wrote down reach the member', async () => {
            const member = await createMember();
            const record = await createRecord(member, JudicialRecordReviewStatus.ConditionallyAccepted, {
                comment: 'Niet alleen met minderjarigen werken',
            });

            await JudicialRecordNotificationService.sendDecision(record, member);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails[0].text).toContain('Niet alleen met minderjarigen werken');
        });

        test('an approval carries no reviewer comment and no empty placeholder', async () => {
            const member = await createMember();
            const record = await createRecord(member, JudicialRecordReviewStatus.Ok);

            await JudicialRecordNotificationService.sendDecision(record, member);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails[0].text).not.toContain('{{feedbackText}}');
        });
    });

    describe('sendExpiryWarning', () => {
        test('the member is told the date the decision stops counting', async () => {
            const member = await createMember();
            const record = await createRecord(member, JudicialRecordReviewStatus.Ok, {
                reviewedAt: new Date(2024, 0, 15),
            });

            await JudicialRecordNotificationService.sendExpiryWarning(record, member);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails).toHaveLength(1);
            // Three years after the review, not after the document was signed.
            expect(emails[0].text).toContain('2027');
            expect(emails[0].text).toContain('strafregister/' + member.id);
        });

        test('a record nobody decided has no expiry to warn about', async () => {
            const member = await createMember();
            const record = await createRecord(member, JudicialRecordReviewStatus.UnderReview, { reviewedAt: null });

            await JudicialRecordNotificationService.sendExpiryWarning(record, member);

            expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);
        });
    });
});
