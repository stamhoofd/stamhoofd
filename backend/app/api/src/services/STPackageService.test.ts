import { EmailMocker } from '@stamhoofd/email';
import { EmailTemplateFactory, OrganizationFactory, STPackage, UserFactory } from '@stamhoofd/models';
import { EmailTemplateType, PermissionLevel, Permissions, STPackageMeta, STPackageType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { vi } from 'vitest';
import { STPackageService } from './STPackageService.js';

const DAY = 1000 * 60 * 60 * 24;

/**
 * A global (not organization scoped) template that only contains the replacements the service fills
 * in, so the rendered email can be asserted without depending on the real template contents.
 */
async function createExpirationTemplate(type: EmailTemplateType) {
    await new EmailTemplateFactory({
        type,
        html: '<p>organizationName: {{organizationName}}</p>'
            + '<p>packageName: {{packageName}}</p>'
            + '<p>validUntil: {{validUntil}}</p>'
            + '<p>validUntilDate: {{validUntilDate}}</p>'
            + '<p>renewUrl: {{renewUrl}}</p>',
    }).create();
}

async function createPackage(options: {
    organizationId: string;
    type: STPackageType;
    /**
     * Defaults to 10 days from now: inside the reminder window of every package type.
     */
    validUntil?: Date | null;
    removeAt?: Date | null;
    validAt?: Date | null;
}) {
    const pack = new STPackage();
    pack.organizationId = options.organizationId;
    pack.meta = STPackageMeta.create({
        type: options.type,
        startDate: new Date(Date.now() - 365 * DAY),
    });
    pack.validAt = options.validAt !== undefined ? options.validAt : new Date(Date.now() - 365 * DAY);
    pack.validUntil = options.validUntil !== undefined ? options.validUntil : new Date(Date.now() + 10 * DAY);
    pack.removeAt = options.removeAt ?? null;
    await pack.save();
    return pack;
}

async function createOrganizationWithAdmin() {
    const organization = await new OrganizationFactory({}).create();
    const admin = await new UserFactory({
        organization,
        firstName: 'Full',
        lastName: 'Admin',
        permissions: Permissions.create({ level: PermissionLevel.Full }),
    }).create();
    return { organization, admin };
}

describe('STPackageService', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('sendExpiryEmail', () => {
        test('Sends the reminder to the full admins of the organization and records it on the package', async () => {
            TestUtils.setEnvironment('environment', 'production');
            await createExpirationTemplate(EmailTemplateType.MembersExpirationReminder);

            const { organization, admin } = await createOrganizationWithAdmin();

            // A user without permissions should not receive the reminder
            const member = await new UserFactory({ organization }).create();

            const validUntil = new Date(Date.now() + 10 * DAY);
            const pack = await createPackage({ organizationId: organization.id, type: STPackageType.Members, validUntil });

            await STPackageService.sendExpiryEmail(pack);

            const emails = await EmailMocker.getSucceededEmails();
            expect(emails.length).toBe(1);
            expect(emails[0].to).toContain(admin.email);
            expect(emails[0].to).not.toContain(member.email);

            expect(emails[0].html).toContain('organizationName: ' + organization.name);
            expect(emails[0].html).toContain('packageName: ' + pack.meta.name);
            expect(emails[0].html).toContain('validUntil: ' + Formatter.dateTime(validUntil));
            expect(emails[0].html).toContain('validUntilDate: ' + Formatter.date(validUntil));
            expect(emails[0].html).toContain(`renewUrl: https://${STAMHOOFD.domains.dashboard ?? 'stamhoofd.app'}/${organization.i18n.locale}/beheerders/${organization.uri}/instellingen/functionaliteiten`);

            expect(pack.lastEmailAt).not.toBeNull();
            expect(pack.emailCount).toBe(1);

            const fromDatabase = await STPackage.getByID(pack.id);
            expect(fromDatabase!.lastEmailAt).not.toBeNull();
            expect(fromDatabase!.emailCount).toBe(1);
        });

        test('Counts the email, but does not set lastEmailAt, for a package type without a reminder', async () => {
            TestUtils.setEnvironment('environment', 'production');
            const { organization } = await createOrganizationWithAdmin();

            // LegacyMembers has no expiration reminder template type
            const pack = await createPackage({ organizationId: organization.id, type: STPackageType.LegacyMembers });

            await STPackageService.sendExpiryEmail(pack);

            expect(await EmailMocker.getSucceededCount()).toBe(0);
            expect(pack.lastEmailAt).toBeNull();
            expect(pack.emailCount).toBe(1);

            const fromDatabase = await STPackage.getByID(pack.id);
            expect(fromDatabase!.lastEmailAt).toBeNull();
            expect(fromDatabase!.emailCount).toBe(1);
        });

        test('Does not send outside production, but still records the email on the package', async () => {
            // The production guard only covers the send itself: the bookkeeping runs in every environment
            expect(STAMHOOFD.environment).not.toBe('production');
            await createExpirationTemplate(EmailTemplateType.MembersExpirationReminder);

            const { organization } = await createOrganizationWithAdmin();
            const pack = await createPackage({ organizationId: organization.id, type: STPackageType.Members });

            await STPackageService.sendExpiryEmail(pack);

            expect(await EmailMocker.getSucceededCount()).toBe(0);
            expect(pack.lastEmailAt).not.toBeNull();
            expect(pack.emailCount).toBe(1);

            const fromDatabase = await STPackage.getByID(pack.id);
            expect(fromDatabase!.lastEmailAt).not.toBeNull();
            expect(fromDatabase!.emailCount).toBe(1);
        });

        test('Logs and skips the email when the organization of the package no longer exists', async () => {
            TestUtils.setEnvironment('environment', 'production');
            await createExpirationTemplate(EmailTemplateType.MembersExpirationReminder);
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const pack = await createPackage({ organizationId: uuidv4(), type: STPackageType.Members });

            await STPackageService.sendExpiryEmail(pack);

            expect(consoleError).toHaveBeenCalledWith('Could not find package organization ' + pack.id);
            expect(await EmailMocker.getSucceededCount()).toBe(0);

            // A missing organization does not stop the bookkeeping
            expect(pack.emailCount).toBe(1);
        });

        test('Does not send or count a package that is not due', async () => {
            TestUtils.setEnvironment('environment', 'production');
            await createExpirationTemplate(EmailTemplateType.MembersExpirationReminder);

            const { organization } = await createOrganizationWithAdmin();

            const neverActivated = await createPackage({ organizationId: organization.id, type: STPackageType.Members, validAt: null });

            // Expires in 100 days, which is outside the 32 day window of a members package
            const notExpiringSoon = await createPackage({ organizationId: organization.id, type: STPackageType.Members, validUntil: new Date(Date.now() + 100 * DAY) });

            await STPackageService.sendExpiryEmail(neverActivated);
            await STPackageService.sendExpiryEmail(notExpiringSoon);

            expect(await EmailMocker.getSucceededCount()).toBe(0);
            expect(neverActivated.emailCount).toBe(0);
            expect(neverActivated.lastEmailAt).toBeNull();
            expect(notExpiringSoon.emailCount).toBe(0);
            expect(notExpiringSoon.lastEmailAt).toBeNull();
        });

        test('Counts, but does not send, a package that is already removed', async () => {
            TestUtils.setEnvironment('environment', 'production');
            await createExpirationTemplate(EmailTemplateType.MembersExpirationReminder);

            const { organization } = await createOrganizationWithAdmin();
            const pack = await createPackage({ organizationId: organization.id, type: STPackageType.Members, removeAt: new Date(Date.now() - DAY) });

            await STPackageService.sendExpiryEmail(pack);

            expect(await EmailMocker.getSucceededCount()).toBe(0);
            expect(pack.lastEmailAt).toBeNull();
            expect(pack.emailCount).toBe(1);

            const fromDatabase = await STPackage.getByID(pack.id);
            expect(fromDatabase!.emailCount).toBe(1);
        });
    });
});
