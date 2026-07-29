import { EmailMocker } from '@stamhoofd/email';
import type { Organization } from '@stamhoofd/models';
import { EmailTemplateFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { EmailTemplateType, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { OrganizationEmailService } from './OrganizationEmailService.js';

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

function setupEnvironment() {
    TestUtils.setEnvironment('userMode', 'organization');

    // The notification emails localize the marketing domain, which the shared test environment does not set
    TestUtils.setEnvironment('domains', {
        ...STAMHOOFD.domains,
        marketing: { '': 'stamhoofd.dev', BE: 'be.stamhoofd.dev', NL: 'nl.stamhoofd.dev' },
    });
}

describe('OrganizationEmailService.checkDrips', () => {
    beforeAll(async () => {
        await new EmailTemplateFactory({
            type: EmailTemplateType.OrganizationDripWelcome,
            subject: EmailTemplateType.OrganizationDripWelcome,
            html: '<p>{{organizationName}} - {{mailDomain}}</p>',
            text: '{{organizationName}} - {{mailDomain}}',
        }).create();
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
