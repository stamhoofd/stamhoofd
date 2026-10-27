import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { GetEmailRecipientsCountEndpoint } from './GetEmailRecipientsCountEndpoint.js';
import { GetEmailRecipientsEndpoint } from './GetEmailRecipientsEndpoint.js';
import { AccessRight } from '@stamhoofd/types/AccessRight';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { PermissionsResourceType } from '@stamhoofd/types/PermissionsResourceType';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { CountFilteredRequest, EmailStatus, LimitedFilteredRequest, OrganizationEmail, Permissions, PermissionsResourceKey, Replacement, ResourcePermissions } from '@stamhoofd/structures';
import type { Organization, RegistrationPeriod, User, Token } from '@stamhoofd/models';
import { Email, EmailRecipient, OrganizationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { Request } from '@node/endpoints';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { vi } from 'vitest';

const baseUrl = `/email-recipients`;

describe('Endpoint.GetEmailRecipients', () => {
    const endpoint = new GetEmailRecipientsEndpoint();
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
                    [PermissionsResourceType.Senders, new Map([[PermissionsResourceKey.All, ResourcePermissions.create({
                        resourceName: sender.name!,
                        level: PermissionLevel.Read,
                    })]])],
                ]),
            }),
        })
            .create();

        token = await SessionService.createSession(user);

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

        token2 = await SessionService.createSession(user2);
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

    test('It masks secrets in stored replacements', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Sent;
        email.text = '{{loginDetails}} {{unsubscribeUrl}}';
        email.html = '<p>{{loginDetails}} {{unsubscribeUrl}}</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.senderId = sender.id;
        await email.save();

        const emailRecipient = new EmailRecipient();
        emailRecipient.email = 'jan.janssens@geenemail.com';
        emailRecipient.emailId = email.id;
        emailRecipient.organizationId = organization.id;
        emailRecipient.sentAt = new Date();
        emailRecipient.replacements = [
            Replacement.create({
                token: 'loginDetails',
                value: '',
                html: '<span class="style-inline-code">AAAA-BBBB-CCCC-DDDD</span>',
            }),
            Replacement.create({
                token: 'unsubscribeUrl',
                value: 'https://example.com/unsubscribe?token=secret-token-12345',
            }),
        ];

        // Rows saved before loginDetails was removed on save still contain security codes
        const spy = vi.spyOn(EmailRecipient, 'removeUnstoredReplacements').mockImplementation(r => r);
        await emailRecipient.save();
        spy.mockRestore();

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
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        const result = await testServer.test(endpoint, request);
        expect(result.body.results).toHaveLength(1);

        const serialized = JSON.stringify(result.body.results[0].replacements);
        expect(serialized).not.toContain('AAAA-BBBB-CCCC-DDDD');
        expect(serialized).not.toContain('secret-token-12345');
    });

    describe('Handcrafted filters', () => {
        // user2 can only read emails of sender2. The validator may skip the permission check only when
        // the request filter is guaranteed to narrow the results to emails it can access.
        let allowedEmail: Email;
        let forbiddenEmail: Email;
        let allowedRecipient: EmailRecipient;

        const createEmail = async (senderId: string) => {
            const email = new Email();
            email.subject = 'test subject';
            email.status = EmailStatus.Draft;
            email.text = 'test email';
            email.html = `<p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>`;
            email.json = {};
            email.organizationId = organization.id;
            email.senderId = senderId;
            await email.save();
            return email;
        };

        const createRecipient = async (email: Email, firstName: string) => {
            const emailRecipient = new EmailRecipient();
            emailRecipient.email = `${firstName.toLowerCase()}.janssens@geenemail.com`;
            emailRecipient.firstName = firstName;
            emailRecipient.lastName = 'Janssens';
            emailRecipient.emailId = email.id;
            emailRecipient.organizationId = organization.id;
            await emailRecipient.save();
            return emailRecipient;
        };

        beforeAll(async () => {
            allowedEmail = await createEmail(sender2.id);
            forbiddenEmail = await createEmail(sender.id);
            allowedRecipient = await createRecipient(allowedEmail, 'Allowed');
            await createRecipient(forbiddenEmail, 'Hidden');
        });

        const fetchIds = async (filter: StamhoofdFilter) => {
            const response = await testServer.test(endpoint, Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ filter, limit: 10 }),
                headers: { authorization: 'Bearer ' + token2.accessToken },
            }));
            expect(response.status).toBe(200);
            return response.body.results.map(r => r.id);
        };

        const count = async (filter: StamhoofdFilter) => {
            const response = await testServer.test(new GetEmailRecipientsCountEndpoint(), Request.get({
                path: `${baseUrl}/count`,
                host: organization.getApiHost(),
                query: new CountFilteredRequest({ filter }),
                headers: { authorization: 'Bearer ' + token2.accessToken },
            }));
            return response.body.count;
        };

        const expectDenied = async (filter: StamhoofdFilter) => {
            await expect(fetchIds(filter)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
            await expect(count(filter)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        };

        const expectVisible = async (filter: StamhoofdFilter, recipientIds: string[]) => {
            expect(await fetchIds(filter)).toIncludeSameMembers(recipientIds);
            expect(await count(filter)).toBe(recipientIds.length);
        };

        test('An email filter wrapped in a top-level array or $and returns the same recipients as the plain object', async () => {
            const expected = [allowedRecipient.id];
            await expectVisible({ emailId: allowedEmail.id }, expected);
            await expectVisible([{ emailId: allowedEmail.id }], expected);
            await expectVisible({ $and: [{ emailId: allowedEmail.id }] }, expected);
            await expectVisible({ $and: [[{ emailId: allowedEmail.id }]] }, expected);
            await expectVisible([{ $and: [{ emailId: allowedEmail.id }] }, { lastName: 'Janssens' }], expected);
            await expectVisible([{ emailId: { $in: [allowedEmail.id] } }], expected);
        });

        test('Extra conditions next to the email filter can only narrow the result', async () => {
            await expectVisible({
                $and: [{ emailId: allowedEmail.id }],
                $or: [{ firstName: 'Hidden' }, { firstName: 'Allowed' }],
            }, [allowedRecipient.id]);
            await expectVisible([{ emailId: allowedEmail.id }, { firstName: 'Hidden' }], []);
            await expectVisible([{ emailId: allowedEmail.id }, { emailId: forbiddenEmail.id }], []);
            await expectVisible({ $and: [{ emailId: allowedEmail.id }], $or: [{ emailId: forbiddenEmail.id }, { firstName: 'Hidden' }] }, []);
            await expectVisible([{ emailId: { $in: [allowedEmail.id], $neq: allowedEmail.id } }], []);
            await expectVisible([{ emailId: { $in: [allowedEmail.id], $or: [{ $eq: forbiddenEmail.id }] } }], []);
            await expectVisible({ emailId: allowedEmail.id, $or: [{ emailId: forbiddenEmail.id }, { firstName: 'Hidden' }] }, []);
            await expectVisible({ $and: [{ emailId: allowedEmail.id }], $or: [{ emailId: forbiddenEmail.id }, { emailId: allowedEmail.id }] }, [allowedRecipient.id]);
        });

        test('An email filter that does not narrow the result is rejected', async () => {
            await expectDenied([{ $or: [{ emailId: allowedEmail.id }, { firstName: 'Hidden' }] }]);
            await expectDenied({ $and: [{ $or: [{ emailId: allowedEmail.id }, { firstName: 'Hidden' }] }] });
            await expectDenied({ $and: [[{ $or: [{ emailId: allowedEmail.id }] }]] });
            await expectDenied({ $or: [{ $and: [{ emailId: allowedEmail.id }] }, { firstName: 'Hidden' }] });
            await expectDenied({ $not: { emailId: allowedEmail.id } });
            await expectDenied([{ $not: { emailId: allowedEmail.id } }]);
            await expectDenied({ $and: { emailId: allowedEmail.id } });
            await expectDenied([]);
            await expectDenied({ $and: [] });
            await expectDenied([{ firstName: 'Hidden' }]);
        });

        test('A forbidden email anywhere in the required position is rejected', async () => {
            await expectDenied([{ emailId: forbiddenEmail.id }]);
            await expectDenied({ $and: [{ emailId: forbiddenEmail.id }, { emailId: allowedEmail.id }] });
            await expectDenied([{ emailId: { $in: [allowedEmail.id, forbiddenEmail.id] } }]);
            await expectDenied({ $or: [{ emailId: allowedEmail.id }, { emailId: forbiddenEmail.id }] });
        });
    });
});
