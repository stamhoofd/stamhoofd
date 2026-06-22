import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, RegistrationPeriod, User } from '@stamhoofd/models';
import { Email, EmailRecipient, OrganizationFactory, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { AccessRight, CountFilteredRequest, EmailStatus, LimitedFilteredRequest, OrganizationEmail, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetEmailRecipientsCountEndpoint } from './GetEmailRecipientsCountEndpoint.js';
import { GetEmailRecipientsEndpoint } from './GetEmailRecipientsEndpoint.js';

const baseUrl = `/email-recipients`;

describe('Endpoint.GetEmailRecipients', () => {
    const endpoint = new GetEmailRecipientsEndpoint();
    const countEndpoint = new GetEmailRecipientsCountEndpoint();
    let period: RegistrationPeriod;
    let organization: Organization;
    let token: Token;
    let user: User;
    let sender: OrganizationEmail;
    let sender2: OrganizationEmail;

    let token2: Token;
    let user2: User;

    beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();

        organization = await new OrganizationFactory({ period })
            .create();

        sender = OrganizationEmail.create({
            email: 'groepsleiding@voorbeeld.com',
            name: 'Groepsleiding',
        });
        sender2 = OrganizationEmail.create({
            email: 'kapoenen@voorbeeld.com',
            name: 'Kapoenen',
        });

        organization.privateMeta.emails.push(sender);
        organization.privateMeta.emails.push(sender2);
        await organization.save();

        user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                resources: new Map([
                    [PermissionsResourceType.Senders, new Map([['', ResourcePermissions.create({
                        resourceName: sender.name!,
                        level: PermissionLevel.Read,
                    })]])],
                ]),
            }),
        })
            .create();

        token = await Token.createToken(user);

        user2 = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                resources: new Map([
                    [PermissionsResourceType.Senders, new Map([[sender2.id, ResourcePermissions.create({
                        resourceName: sender.name!,
                        level: PermissionLevel.Read,
                    })]])],
                ]),
            }),
        })
            .create();

        token2 = await Token.createToken(user2);
    });

    beforeEach(async () => {
        await EmailRecipient.delete();
        await Email.delete();
    });

    test('It can request all email recipients if read permission for all senders', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email';
        email.html = `<p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>`;
        email.json = {};
        email.organizationId = organization.id;
        email.senderId = sender.id;
        await email.save();

        const emailRecipient = new EmailRecipient();
        emailRecipient.email = 'jan.janssens@geenemail.com';
        emailRecipient.firstName = 'Jan';
        emailRecipient.lastName = 'Janssens';
        emailRecipient.emailId = email.id;
        emailRecipient.organizationId = organization.id;
        await emailRecipient.save();

        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter: {},
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        const result = await testServer.test(endpoint, request);
        expect(result.body.results).toHaveLength(1);
        expect(result.body.results[0]).toMatchObject({
            id: emailRecipient.id,
        });
    });

    test('It only counts email recipients of the scoped organization', async () => {
        const otherOrganization = await new OrganizationFactory({ period }).create();
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email';
        email.html = `<p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>`;
        email.json = {};
        email.organizationId = organization.id;
        email.senderId = sender.id;
        await email.save();

        const otherEmail = new Email();
        otherEmail.subject = 'test subject';
        otherEmail.status = EmailStatus.Draft;
        otherEmail.text = 'test email';
        otherEmail.html = `<p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>`;
        otherEmail.json = {};
        otherEmail.organizationId = otherOrganization.id;
        await otherEmail.save();

        const emailRecipient = new EmailRecipient();
        emailRecipient.email = 'jan.janssens@geenemail.com';
        emailRecipient.firstName = 'Jan';
        emailRecipient.lastName = 'Janssens';
        emailRecipient.emailId = email.id;
        emailRecipient.organizationId = organization.id;
        await emailRecipient.save();

        const otherEmailRecipient = new EmailRecipient();
        otherEmailRecipient.email = 'piet.peeters@geenemail.com';
        otherEmailRecipient.firstName = 'Piet';
        otherEmailRecipient.lastName = 'Peeters';
        otherEmailRecipient.emailId = otherEmail.id;
        otherEmailRecipient.organizationId = otherOrganization.id;
        await otherEmailRecipient.save();

        const request = Request.get({
            path: baseUrl + '/count',
            host: organization.getApiHost(),
            query: new CountFilteredRequest({
                filter: {},
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        const result = await testServer.test(countEndpoint, request);
        expect(result.body.count).toBe(1);
    });

    test('It can not request all email recipients if not read permission for all senders', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email';
        email.html = `<p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>`;
        email.json = {};
        email.organizationId = organization.id;
        email.senderId = sender2.id;
        await email.save();

        const emailRecipient = new EmailRecipient();
        emailRecipient.email = 'jan.janssens@geenemail.com';
        emailRecipient.firstName = 'Jan';
        emailRecipient.lastName = 'Janssens';
        emailRecipient.emailId = email.id;
        emailRecipient.organizationId = organization.id;
        await emailRecipient.save();

        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter: {},
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + token2.accessToken,
            },
        });
        await expect(testServer.test(endpoint, request))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('It request all email recipients of a single email if read permission for that sender', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email';
        email.html = `<p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>`;
        email.json = {};
        email.organizationId = organization.id;
        email.senderId = sender2.id;
        await email.save();

        const emailRecipient = new EmailRecipient();
        emailRecipient.email = 'jan.janssens@geenemail.com';
        emailRecipient.firstName = 'Jan';
        emailRecipient.lastName = 'Janssens';
        emailRecipient.emailId = email.id;
        emailRecipient.organizationId = organization.id;
        await emailRecipient.save();

        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter: {
                    emailId: email.id,
                },
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + token2.accessToken,
            },
        });
        const result = await testServer.test(endpoint, request);
        expect(result.body.results).toHaveLength(1);
        expect(result.body.results[0]).toMatchObject({
            id: emailRecipient.id,
        });
    });

    test('It can request all email recipients of a single email in combination with other filters', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email';
        email.html = `<p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>`;
        email.json = {};
        email.organizationId = organization.id;
        email.senderId = sender2.id;
        await email.save();

        const emailRecipient = new EmailRecipient();
        emailRecipient.email = 'jan.janssens@geenemail.com';
        emailRecipient.firstName = 'Jan';
        emailRecipient.lastName = 'Janssens';
        emailRecipient.emailId = email.id;
        emailRecipient.organizationId = organization.id;
        await emailRecipient.save();

        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter: {
                    emailId: email.id,
                    email: {
                        $contains: 'jan',
                    },
                },
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + token2.accessToken,
            },
        });
        const result = await testServer.test(endpoint, request);
        expect(result.body.results).toHaveLength(1);
        expect(result.body.results[0]).toMatchObject({
            id: emailRecipient.id,
        });
    });

    test('[Regression] It can request all email recipients of a single email in combination with $and filters', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email';
        email.html = `<p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>`;
        email.json = {};
        email.organizationId = organization.id;
        email.senderId = sender2.id;
        await email.save();

        const emailRecipient = new EmailRecipient();
        emailRecipient.email = 'jan.janssens@geenemail.com';
        emailRecipient.firstName = 'Jan';
        emailRecipient.lastName = 'Janssens';
        emailRecipient.emailId = email.id;
        emailRecipient.organizationId = organization.id;
        await emailRecipient.save();

        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter: {
                    $and: [
                        { emailId: email.id },
                        { email: { $contains: 'jan' } },
                    ],
                },
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + token2.accessToken,
            },
        });
        const result = await testServer.test(endpoint, request);
        expect(result.body.results).toHaveLength(1);
        expect(result.body.results[0]).toMatchObject({
            id: emailRecipient.id,
        });
    });

    test('[Regression] It can request all email recipients of a single email in combination with multiple $and filters', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email';
        email.html = `<p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>`;
        email.json = {};
        email.organizationId = organization.id;
        email.senderId = sender2.id;
        await email.save();

        const emailRecipient = new EmailRecipient();
        emailRecipient.email = 'jan.janssens@geenemail.com';
        emailRecipient.firstName = 'Jan';
        emailRecipient.lastName = 'Janssens';
        emailRecipient.emailId = email.id;
        emailRecipient.organizationId = organization.id;
        await emailRecipient.save();

        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter: {
                    $and: [
                        { emailId: email.id },
                        { email: { $contains: 'jan' } },
                    ],
                    email: { $contains: 'ssens' },
                },
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + token2.accessToken,
            },
        });
        const result = await testServer.test(endpoint, request);
        expect(result.body.results).toHaveLength(1);
        expect(result.body.results[0]).toMatchObject({
            id: emailRecipient.id,
        });
    });

    test('It cannot request all email recipients of a single email in combination with $or filters', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email';
        email.html = `<p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>`;
        email.json = {};
        email.organizationId = organization.id;
        email.senderId = sender2.id;
        await email.save();

        const emailRecipient = new EmailRecipient();
        emailRecipient.email = 'jan.janssens@geenemail.com';
        emailRecipient.firstName = 'Jan';
        emailRecipient.lastName = 'Janssens';
        emailRecipient.emailId = email.id;
        emailRecipient.organizationId = organization.id;
        await emailRecipient.save();

        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter: {
                    $or: [
                        { emailId: email.id },
                        { email: { $contains: 'jan' } },
                    ],
                },
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + token2.accessToken,
            },
        });
        await expect(testServer.test(endpoint, request))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('It cannot request all email recipients of a single email if read permission for another sender', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email';
        email.html = `<p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>`;
        email.json = {};
        email.organizationId = organization.id;
        email.senderId = sender.id;
        await email.save();

        const emailRecipient = new EmailRecipient();
        emailRecipient.email = 'jan.janssens@geenemail.com';
        emailRecipient.firstName = 'Jan';
        emailRecipient.lastName = 'Janssens';
        emailRecipient.emailId = email.id;
        emailRecipient.organizationId = organization.id;
        await emailRecipient.save();

        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter: {
                    emailId: email.id,
                },
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + token2.accessToken,
            },
        });
        await expect(testServer.test(endpoint, request))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));
    });
});
