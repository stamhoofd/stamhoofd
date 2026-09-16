import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { GetEmailRecipientsEndpoint } from './GetEmailRecipientsEndpoint.js';
import { AccessRight, EmailStatus, LimitedFilteredRequest, OrganizationEmail, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceKey, PermissionsResourceType, Replacement, ResourcePermissions } from '@stamhoofd/structures';
import type { Organization, RegistrationPeriod, User, Token } from '@stamhoofd/models';
import { BalanceItemFactory, Email, EmailRecipient, MemberFactory, OrganizationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { BalanceItemStatus, BalanceItemType } from '@stamhoofd/structures';
import { Request } from '@simonbackx/simple-endpoints';
import { Formatter } from '@stamhoofd/utility';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';

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
});

describe('Endpoint.GetEmailRecipients financial data', () => {
    const endpoint = new GetEmailRecipientsEndpoint();
    let period: RegistrationPeriod;
    let organization: Organization;
    let sender: OrganizationEmail;
    let emailReaderRole: PermissionRoleDetailed;
    let financialEmailReaderRole: PermissionRoleDetailed;

    /** Token of an admin that can read all emails, but has no access right to read financial data */
    let readerToken: Token;

    /** Token of an admin that can read all emails and is allowed to read financial data */
    let financialReaderToken: Token;

    beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();

        const senderResources = () => new Map([
            [PermissionsResourceType.Senders, new Map([[PermissionsResourceKey.All, ResourcePermissions.create({
                resourceName: 'Alle afzenders',
                level: PermissionLevel.Read,
            })]])],
        ]);

        emailReaderRole = PermissionRoleDetailed.create({
            name: 'Email reader',
            resources: senderResources(),
        });

        financialEmailReaderRole = PermissionRoleDetailed.create({
            name: 'Email reader with financial access',
            accessRights: [AccessRight.MemberReadFinancialData],
            resources: senderResources(),
        });

        organization = await new OrganizationFactory({ period, roles: [emailReaderRole, financialEmailReaderRole] }).create();

        sender = OrganizationEmail.create({
            email: 'groepsleiding@voorbeeld.com',
            name: 'Groepsleiding',
        });
        organization.privateMeta.emails.push(sender);
        await organization.save();

        const reader = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                roles: [emailReaderRole],
            }),
        }).create();
        readerToken = await SessionService.createSession(reader);

        const financialReader = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                roles: [financialEmailReaderRole],
            }),
        }).create();
        financialReaderToken = await SessionService.createSession(financialReader);
    });

    /**
     * Creates a sent email with a single recipient: a member that still has an open balance.
     */
    const createEmailToMemberWithBalance = async () => {
        const memberUser = await new UserFactory({ organization }).create();
        const member = await new MemberFactory({ organization, user: memberUser }).create();

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            userId: memberUser.id,
            type: BalanceItemType.Other,
            amount: 1,
            unitPrice: 1_234500,
            status: BalanceItemStatus.Due,
            description: 'Openstaand lidgeld',
        }).create();

        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Sent;
        email.text = 'test email';
        email.html = `<p>test email {{balanceTable}}</p>`;
        email.json = {};
        email.organizationId = organization.id;
        email.senderId = sender.id;
        email.sentAt = new Date();
        await email.save();

        const emailRecipient = new EmailRecipient();
        emailRecipient.emailId = email.id;
        emailRecipient.organizationId = organization.id;
        emailRecipient.memberId = member.id;
        emailRecipient.userId = memberUser.id;
        emailRecipient.email = memberUser.email;
        emailRecipient.firstName = member.details.firstName;
        emailRecipient.lastName = member.details.lastName;
        emailRecipient.sentAt = new Date();
        await emailRecipient.save();

        return { email, emailRecipient, member, memberUser, price: Formatter.price(balanceItem.priceOpen) };
    };

    const getRecipients = async (emailId: string, token: Token) => {
        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter: {
                    emailId,
                },
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        return await testServer.test(endpoint, request);
    };

    test('The balance of a recipient is hidden without MemberReadFinancialData', async () => {
        const { email, price } = await createEmailToMemberWithBalance();

        const result = await getRecipients(email.id, readerToken);
        expect(result.body.results).toHaveLength(1);

        const replacements = result.body.results[0].replacements;
        expect(JSON.stringify(replacements)).not.toContain(price);

        expect(replacements.find(r => r.token === 'outstandingBalance')?.value ?? '').not.toBe(price);
        expect(replacements.find(r => r.token === 'balanceTable')?.html ?? '').not.toContain(price);
    });

    test('The balance of a recipient is visible with MemberReadFinancialData', async () => {
        const { email, price } = await createEmailToMemberWithBalance();

        const result = await getRecipients(email.id, financialReaderToken);
        expect(result.body.results).toHaveLength(1);

        const replacements = result.body.results[0].replacements;
        expect(replacements.find(r => r.token === 'outstandingBalance')?.value).toBe(price);
        expect(replacements.find(r => r.token === 'balanceTable')?.html).toContain(price);
    });

    test('Balance replacements stored on a recipient are hidden without MemberReadFinancialData', async () => {
        const { email, emailRecipient, price } = await createEmailToMemberWithBalance();

        // Balance replacements are stored on the recipient at the time of sending: these must be
        // stripped as well, they are not regenerated for sent emails.
        emailRecipient.replacements = [
            Replacement.create({
                token: 'outstandingBalance',
                value: price,
            }),
            Replacement.create({
                token: 'balanceTable',
                value: '',
                html: `<table><tr><td>Openstaand lidgeld</td><td>${price}</td></tr></table>`,
            }),
        ];
        await emailRecipient.save();

        const result = await getRecipients(email.id, readerToken);
        expect(result.body.results).toHaveLength(1);

        const replacements = result.body.results[0].replacements;
        expect(JSON.stringify(replacements)).not.toContain(price);
    });
});
