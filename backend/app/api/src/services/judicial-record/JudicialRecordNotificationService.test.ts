import { Database } from '@node/database';
import { EmailMocker } from '@stamhoofd/email';
import type { Organization } from '@stamhoofd/models';
import {
    EmailTemplate,
    JudicialRecord,
    Member,
    MemberFactory,
    MemberResponsibilityRecordFactory,
    OrganizationFactory,
    UserFactory,
} from '@stamhoofd/models';
import {
    EmailTemplateType,
    JudicialRecordReviewDetails,
    JudicialRecordReviewDecision,
    MemberResponsibility,
    Permissions,
} from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { TestUtils } from '@stamhoofd/test-utils';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getEmailTemplate } from '../../helpers/EmailBuilder.js';
import { JudicialRecordNotificationService } from './JudicialRecordNotificationService.js';

const seedMigrations = [
    path.resolve(
        import.meta.dirname,
        '../../migrations/1794326107-default-judicial-record-email-templates.sql',
    ),
    path.resolve(
        import.meta.dirname,
        '../../migrations/1794326109-default-judicial-record-identity-email-template.sql',
    ),
];

describe('JudicialRecordNotificationService', () => {
    let organization: Organization;

    const judicialRecordTypes = [
        EmailTemplateType.JudicialRecordAwaitingReview,
        EmailTemplateType.JudicialRecordApproved,
        EmailTemplateType.JudicialRecordConditionallyAccepted,
        EmailTemplateType.JudicialRecordTemporarilyRejected,
        EmailTemplateType.JudicialRecordPermanentlyRejected,
        EmailTemplateType.JudicialRecordExpiringSoon,
        EmailTemplateType.JudicialRecordIdentityChanged,
    ];

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        organization = await new OrganizationFactory({}).create();

        // The integration setup empties `email_templates` before every file, migration seeds included, so the
        // seed is applied again here. Running the migration's own SQL rather than an EmailTemplateFactory is
        // the point: a factory row would prove the service sends mail while saying nothing about whether the
        // content that ships actually exists or resolves.
        for (const seedMigration of seedMigrations) {
            await Database.statement(await readFile(seedMigration, 'utf-8'));
        }
    });

    async function createMember({
        email = 'nora@example.com',
    }: { email?: string | null } = {}): Promise<Member> {
        const member = await new MemberFactory({
            organization,
            firstName: 'Nora',
            lastName: 'Peeters',
        }).create();
        member.details.email = email;
        await member.save();
        return member;
    }

    async function createRecord(
        member: Member,
        reviewDecision: JudicialRecordReviewDecision,
        {
            comment = null,
            reviewedAt = new Date(),
        }: { comment?: string | null; reviewedAt?: Date | null } = {},
    ): Promise<JudicialRecord> {
        const record = new JudicialRecord();
        record.memberId = member.id;
        record.reviewDecision = reviewDecision;
        record.reviewedAt = reviewedAt;
        record.identityHash = member.identityHash!;
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
            const sql = (
                await Promise.all(seedMigrations.map((file) => readFile(file, 'utf-8')))
            ).join('\n');
            const seeded = Object.values(EmailTemplateType).filter((type) =>
                type.startsWith('JudicialRecord'),
            );

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
            [JudicialRecordReviewDecision.Ok, 'Je hoeft nu niets te doen'],
            [JudicialRecordReviewDecision.ConditionallyAccepted, 'met deze voorwaarden'],
            [
                JudicialRecordReviewDecision.TemporarilyRejected,
                'Je moet een nieuw uittreksel afleveren',
            ],
            [JudicialRecordReviewDecision.PermanentlyRejected, 'definitief afgekeurd'],
        ])('%s tells the member what was decided', async (reviewDecision, expectedPhrase) => {
            const member = await createMember();
            const record = await createRecord(member, reviewDecision);

            await JudicialRecordNotificationService.sendDecision(record, member);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails).toHaveLength(1);
            expect(emails[0].to).toContain('nora@example.com');
            expect(emails[0].text).toContain(expectedPhrase);
        });

        test('nothing is sent while nobody has looked at the extract', async () => {
            const member = await createMember();
            const record = await createRecord(member, JudicialRecordReviewDecision.UnderReview, {
                reviewedAt: null,
            });

            await JudicialRecordNotificationService.sendDecision(record, member);

            expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);
        });

        test('a member without an email address is skipped rather than failing', async () => {
            const member = await createMember({ email: null });
            const record = await createRecord(member, JudicialRecordReviewDecision.Ok);

            await JudicialRecordNotificationService.sendDecision(record, member);

            expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);
        });

        test('the conditions a reviewer wrote down reach the member', async () => {
            const member = await createMember();
            const record = await createRecord(
                member,
                JudicialRecordReviewDecision.ConditionallyAccepted,
                {
                    comment: 'Niet alleen met minderjarigen werken',
                },
            );

            await JudicialRecordNotificationService.sendDecision(record, member);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails[0].text).toContain('Niet alleen met minderjarigen werken');
        });

        test('an approval carries no reviewer comment and no empty placeholder', async () => {
            const member = await createMember();
            const record = await createRecord(member, JudicialRecordReviewDecision.Ok);

            await JudicialRecordNotificationService.sendDecision(record, member);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails[0].text).not.toContain('{{feedbackText}}');
        });
    });

    describe('sendExpiryWarning', () => {
        test('the member is told the date the decision stops counting', async () => {
            const member = await createMember();
            const record = await createRecord(member, JudicialRecordReviewDecision.Ok, {
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
            const record = await createRecord(member, JudicialRecordReviewDecision.UnderReview, {
                reviewedAt: null,
            });

            await JudicialRecordNotificationService.sendExpiryWarning(record, member);

            expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);
        });
    });

    /**
     * The most common send on a platform has no organization at all: a member has none of their own, and an
     * extract the automatic checks approved carries no `reviewDetails` to name one. Resolving the template
     * from a null organization matches on type alone, so this asserts the platform wording is what goes out.
     */
    describe('a send with no organization at all', () => {
        test('resolves the platform row rather than whichever one the database returns first', async () => {
            const member = await new MemberFactory({
                firstName: 'Nora',
                lastName: 'Peeters',
            }).create();
            member.details.email = 'nora@example.com';

            // What a member looks like on a platform: registered through organizations, belonging to none.
            member.organizationId = null;
            await member.save();

            // A competing organization row, which is what makes this test discriminate: without it the
            // unfiltered lookup finds the platform row anyway and would pass whether or not the fix is there.
            const organizationTemplate = new EmailTemplate();

            // Sorts before the seeded platform row's id, so an unfiltered `limit 1` returns this one. Without
            // a fixed id the lookup has no ORDER BY and the winner depends on which uuid happened to be
            // generated, which makes the difference between a guard and a coin flip.
            organizationTemplate.id = '00000000-0000-4000-8000-000000000001';
            organizationTemplate.organizationId = organization.id;
            organizationTemplate.type = EmailTemplateType.JudicialRecordApproved;
            organizationTemplate.subject = 'Wording of one single organization';
            organizationTemplate.text = '{{greeting}} wording of one single organization';
            organizationTemplate.html = '<p>{{greeting}} wording of one single organization</p>';
            organizationTemplate.json = '{}';
            await organizationTemplate.save();

            const record = new JudicialRecord();
            record.memberId = member.id;
            record.reviewDecision = JudicialRecordReviewDecision.Ok;
            record.reviewedAt = new Date();
            record.identityHash = member.identityHash!;
            record.reviewDetails = null;
            await record.save();

            await JudicialRecordNotificationService.sendDecision(record, member);

            // Read straight from the table rather than through `getEmailTemplate`: resolving the expected
            // value through the function under test makes both sides agree whatever it does, which is a test
            // that cannot fail.
            const platformRows = await EmailTemplate.select()
                .where('type', EmailTemplateType.JudicialRecordApproved)
                .where('organizationId', null)
                .limit(1)
                .fetch();

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails).toHaveLength(1);
            expect(emails[0].subject).toBe(platformRows[0].subject);
            expect(emails[0].subject).not.toBe(organizationTemplate.subject);
        });
    });

    describe('sendAwaitingReview', () => {
        async function createAwaitingRecord(member: Member): Promise<JudicialRecord> {
            const record = new JudicialRecord();
            record.memberId = member.id;
            record.reviewDecision = JudicialRecordReviewDecision.UnderReview;
            record.reviewedAt = null;
            record.identityHash = member.identityHash!;
            await record.save();
            return record;
        }

        test('a platform admin holding the review right is called', async () => {
            const member = await createMember();
            const record = await createAwaitingRecord(member);
            const reviewer = await new UserFactory({
                email: 'wies@example.com',
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const loaded = await Member.getByIdWithUsersAndRegistrations(member.id);
            await JudicialRecordNotificationService.sendAwaitingReview(record, loaded!);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails).toHaveLength(1);
            expect(emails[0].to).toContain(reviewer.email);
            expect(emails[0].text).toContain(member.details.firstName);
        });

        /**
         * On a platform the review right is never implied by access, so a candidate list filtered by
         * permission level rather than by the right would mail exactly the wrong people. Organization mode
         * answers the opposite way, which is the case below.
         */
        test('an organization admin without the right is not called, however much access they have', async () => {
            const member = await createMember();
            const record = await createAwaitingRecord(member);

            await new UserFactory({
                email: 'orgadmin@example.com',
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const loaded = await Member.getByIdWithUsersAndRegistrations(member.id);
            await JudicialRecordNotificationService.sendAwaitingReview(record, loaded!);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails.flatMap((email) => email.to)).not.toContain('orgadmin@example.com');
        });

        /**
         * In organization mode full access does carry the review right, so the same administrator the platform
         * case refuses is a recipient here. Pinned from the notification side as well as from the access right,
         * because this is where the consequence is felt: changing who holds the right silently changes who is
         * told that a member's judicial record extract is waiting.
         *
         * This is also the only case that exercises the organization scoping. The platform reviewer is found
         * through `getPlatformAdmins`, which ignores it entirely.
         */
        describe('userMode organization', () => {
            beforeEach(() => {
                TestUtils.setEnvironment('userMode', 'organization');
            });

            test('a full organization admin is called, because the right comes with full access here', async () => {
                const responsibility = MemberResponsibility.create({
                    name: 'Organization reviewer needed',
                    organizationBased: true,
                    judicialRecordMinimumAge: 18,
                });
                organization.privateMeta.responsibilities.push(responsibility);
                await organization.save();

                const member = await new MemberFactory({
                    organization,
                    firstName: 'Nora',
                    lastName: 'Peeters',
                    birthDay: { year: 1990, month: 1, day: 1 },
                }).create();
                member.details.email = 'nora@example.com';
                await member.save();

                await new MemberResponsibilityRecordFactory({
                    member,
                    organizationId: organization.id,
                    responsibility,
                    startDate: new Date(2020, 0, 1),
                }).create();

                const record = await createAwaitingRecord(member);

                const admin = await new UserFactory({
                    email: 'orgfulladmin@example.com',
                    organization,
                    permissions: Permissions.create({ level: PermissionLevel.Full }),
                }).create();

                const loaded = await Member.getByIdWithUsersAndRegistrations(member.id);
                await JudicialRecordNotificationService.sendAwaitingReview(record, loaded!);

                const emails = await EmailMocker.transactional.getSucceededEmails();
                expect(emails.flatMap((email) => email.to)).toContain(admin.email);
            });
        });
    });

    describe('sendIdentityChanged', () => {
        test('the member is told the approval no longer matches, and where to deliver', async () => {
            const member = await createMember();
            const record = await createRecord(member, JudicialRecordReviewDecision.Ok);

            await JudicialRecordNotificationService.sendIdentityChanged(record, member);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails).toHaveLength(1);
            expect(emails[0].to).toContain('nora@example.com');
            expect(emails[0].text).toContain('strafregister/' + member.id);
        });

        /**
         * An administrator correcting a spelling is the usual trigger, so a text that reads as an accusation
         * is aimed at the one person who did nothing.
         */
        test('the text states a fact about the record rather than blaming the member', async () => {
            const member = await createMember();
            const record = await createRecord(member, JudicialRecordReviewDecision.Ok);

            await JudicialRecordNotificationService.sendIdentityChanged(record, member);

            const [email] = await EmailMocker.transactional.getSucceededEmails();
            const text = (email.text ?? '').toLowerCase();

            expect(text).toContain('is gewijzigd');
            expect(text).not.toContain('je hebt');
            expect(text).not.toContain('jouw fout');
            expect(text).not.toContain('onjuist');
        });

        test('a member without an email address is skipped rather than failing', async () => {
            const member = await createMember({ email: null });
            const record = await createRecord(member, JudicialRecordReviewDecision.Ok);

            await JudicialRecordNotificationService.sendIdentityChanged(record, member);

            expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);
        });
    });
});
