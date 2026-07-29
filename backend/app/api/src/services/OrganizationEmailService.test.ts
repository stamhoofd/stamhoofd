import { EmailMocker } from '@stamhoofd/email';
import type { Organization } from '@stamhoofd/models';
import { EmailTemplateFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { EmailTemplateType, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { OrganizationEmailService } from './OrganizationEmailService.js';

const validateDNSRecordsMock = vi.hoisted(() => vi.fn());

vi.mock('@stamhoofd/models/helpers/DNSValidator.js', () => ({
    validateDNSRecords: validateDNSRecordsMock,
}));

const templateTypes = [
    EmailTemplateType.OrganizationStableDNS,
    EmailTemplateType.OrganizationUnstableDNS,
    EmailTemplateType.OrganizationValidDNS,
    EmailTemplateType.OrganizationInvalidDNS,
    EmailTemplateType.OrganizationDNSSetupComplete,
    EmailTemplateType.OrganizationDripWelcome,
];

/**
 * The template subject is the template type, so the subject of a sent email tells us
 * exactly which template was chosen.
 */
async function createTemplates() {
    for (const type of templateTypes) {
        await new EmailTemplateFactory({
            type,
            subject: type,
            html: '<p>{{organizationName}} - {{mailDomain}}</p>',
            text: '{{organizationName}} - {{mailDomain}}',
        }).create();
    }
}

async function createOrganizationWithAdmin(): Promise<Organization> {
    const organization = await new OrganizationFactory({}).create();
    await new UserFactory({
        organization,
        email: 'admin@example.com',
        firstName: 'Ad',
        lastName: 'Min',
        permissions: Permissions.create({ level: PermissionLevel.Full }),
    }).create();
    return organization;
}

function daysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * The notification emails localize the marketing domain, which is not part of the shared test environment.
 */
function setupEnvironment() {
    TestUtils.setEnvironment('userMode', 'organization');
    TestUtils.setEnvironment('domains', {
        ...STAMHOOFD.domains,
        marketing: { '': 'stamhoofd.dev', BE: 'be.stamhoofd.dev', NL: 'nl.stamhoofd.dev' },
    });
}

describe('OrganizationEmailService.updateDNSRecords notifications', () => {
    beforeAll(async () => {
        await createTemplates();
    });

    beforeEach(() => {
        setupEnvironment();
        validateDNSRecordsMock.mockReset();
    });

    test('Sends the setup complete email the first time the mail domain becomes valid', async () => {
        validateDNSRecordsMock.mockResolvedValue({ allValid: true, hasAllNonTXT: true });

        const organization = await createOrganizationWithAdmin();
        organization.privateMeta.pendingMailDomain = 'mail.example.com';
        organization.privateMeta.mailDomainActive = false;
        organization.serverMeta.didSendDomainSetupMail = false;
        await organization.save();

        await OrganizationEmailService.updateDNSRecords(organization);

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe(EmailTemplateType.OrganizationDNSSetupComplete);
        expect(emails[0].to).toContain('admin@example.com');

        // Default replacements
        expect(emails[0].html).toContain('mail.example.com');
        expect(emails[0].html).toContain(organization.name);

        // No bcc for this template
        expect(emails[0].bcc).toBeUndefined();

        expect(organization.privateMeta.mailDomain).toBe('mail.example.com');
        expect(organization.privateMeta.pendingMailDomain).toBe(null);
        expect(organization.privateMeta.mailDomainActive).toBe(true);
        expect(organization.serverMeta.didSendDomainSetupMail).toBe(true);
    });

    test('Sends the valid DNS email instead of the setup complete email once the setup email was sent before', async () => {
        validateDNSRecordsMock.mockResolvedValue({ allValid: true, hasAllNonTXT: true });

        const organization = await createOrganizationWithAdmin();
        organization.privateMeta.pendingMailDomain = 'mail.example.com';
        organization.privateMeta.mailDomainActive = false;
        organization.serverMeta.didSendDomainSetupMail = true;
        organization.serverMeta.DNSRecordWarningCount = 1;
        await organization.save();

        await OrganizationEmailService.updateDNSRecords(organization);

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe(EmailTemplateType.OrganizationValidDNS);
        expect(emails[0].bcc).toBeUndefined();
        expect(organization.serverMeta.DNSRecordWarningCount).toBe(0);
    });

    test('Sends the stable DNS email with a bcc when the DNS settings become stable again', async () => {
        validateDNSRecordsMock.mockResolvedValue({ allValid: true, hasAllNonTXT: true });

        const organization = await createOrganizationWithAdmin();
        organization.serverMeta.isDNSUnstable = true;
        organization.serverMeta.lastInvalidDNSDates = [];
        await organization.save();

        await OrganizationEmailService.updateDNSRecords(organization);

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe(EmailTemplateType.OrganizationStableDNS);
        expect(emails[0].bcc).toContain('simon@stamhoofd.be');
        expect(organization.serverMeta.isDNSUnstable).toBe(false);
    });

    test('Sends the unstable DNS email with a bcc when the DNS settings become unstable', async () => {
        validateDNSRecordsMock.mockResolvedValue({ allValid: false, hasAllNonTXT: false });

        const organization = await createOrganizationWithAdmin();
        organization.privateMeta.mailDomain = 'mail.example.com';
        organization.privateMeta.mailDomainActive = true;
        organization.serverMeta.isDNSUnstable = false;
        organization.serverMeta.firstInvalidDNSRecords = undefined;
        // 4 earlier failures + the one of this run makes the DNS unstable
        organization.serverMeta.lastInvalidDNSDates = [daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4)];
        await organization.save();

        await OrganizationEmailService.updateDNSRecords(organization);

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe(EmailTemplateType.OrganizationUnstableDNS);
        expect(emails[0].bcc).toContain('simon@stamhoofd.be');

        // The mail domain is disabled and kept as pending
        expect(organization.serverMeta.isDNSUnstable).toBe(true);
        expect(organization.privateMeta.mailDomain).toBe(null);
        expect(organization.privateMeta.pendingMailDomain).toBe('mail.example.com');
        expect(organization.privateMeta.mailDomainActive).toBe(false);
    });

    test('Sends the invalid DNS email once when the DNS settings break without becoming unstable', async () => {
        validateDNSRecordsMock.mockResolvedValue({ allValid: false, hasAllNonTXT: false });

        const organization = await createOrganizationWithAdmin();
        organization.privateMeta.mailDomain = 'mail.example.com';
        organization.privateMeta.mailDomainActive = true;
        organization.serverMeta.didSendDomainSetupMail = true;
        organization.serverMeta.DNSRecordWarningCount = 0;
        await organization.save();

        await OrganizationEmailService.updateDNSRecords(organization);

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe(EmailTemplateType.OrganizationInvalidDNS);
        expect(emails[0].bcc).toBeUndefined();
        expect(organization.serverMeta.DNSRecordWarningCount).toBe(1);

        // A second broken check does not warn again
        await OrganizationEmailService.updateDNSRecords(organization);
        expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(1);
    });
});

describe('OrganizationEmailService.checkDrips', () => {
    beforeAll(async () => {
        await createTemplates();
    });

    beforeEach(() => {
        setupEnvironment();
    });

    test('Sends the welcome drip email only once', async () => {
        const organization = await createOrganizationWithAdmin();

        await OrganizationEmailService.checkDrips(organization);

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe(EmailTemplateType.OrganizationDripWelcome);
        expect(organization.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWelcome)).toBe(true);

        await OrganizationEmailService.checkDrips(organization);
        expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(1);
    });
});
