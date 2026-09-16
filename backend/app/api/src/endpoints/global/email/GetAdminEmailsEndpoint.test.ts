import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, RegistrationPeriod, User, Token } from '@stamhoofd/models';
import { BalanceItemFactory, Email, EmailRecipient, MemberFactory, OrganizationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { AccessRight, BalanceItemStatus, BalanceItemType, EmailStatus, LimitedFilteredRequest, OrganizationEmail, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceKey, PermissionsResourceType, Replacement, ResourcePermissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetAdminEmailsEndpoint } from './GetAdminEmailsEndpoint.js';
import { Formatter } from '@stamhoofd/utility';
import { SessionService } from '../../../services/SessionService.js';

const baseUrl = `/email`;

describe('Endpoint.getAdminEmails', () => {
    const endpoint = new GetAdminEmailsEndpoint();
    let period: RegistrationPeriod;
    let organization: Organization;
    let userToken: Token;
    let user: User;
    let member: any; // MemberWithRegistrations type

    beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();

        organization = await new OrganizationFactory({ period })
            .create();

        user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        // Create a member associated with the user
        member = await new MemberFactory({
            organization,
            user,
        }).create();

        userToken = await SessionService.createSession(user);
    });

    const getAdminEmails = async (query: LimitedFilteredRequest = new LimitedFilteredRequest({ limit: 10 }), token: Token = userToken, testOrganization: Organization = organization) => {
        const request = Request.get({
            path: baseUrl,
            host: testOrganization.getApiHost(),
            query,
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        return await testServer.test(endpoint, request);
    };

    test('Should return empty list when no emails are sent to user', async () => {
        const response = await getAdminEmails();
        expect(response.body.results).toHaveLength(0);
    });

    test('Should strip sensitive information from loginDetails', async () => {
        // Create another user that will have sensitive data
        const sensitiveUser = await new UserFactory({
            organization,
        }).create();

        // Create an email
        const email = new Email();
        email.subject = 'Sensitive Data Email';
        email.status = EmailStatus.Sent;
        email.text = 'Email with sensitive replacements {{outstandingBalance}} {{loginDetails}} {{unsubscribeUrl}}';
        email.html = '<p>Email with sensitive replacements {{outstandingBalance}} {{loginDetails}} {{unsubscribeUrl}}</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        email.sentAt = new Date();
        await email.save();

        // Create a recipient for the sensitive user (with different user data than our test user)
        const sensitiveRecipient = new EmailRecipient();
        sensitiveRecipient.emailId = email.id;
        sensitiveRecipient.memberId = member.id; // Same member as our test user
        sensitiveRecipient.userId = sensitiveUser.id; // Different user ID
        sensitiveRecipient.email = sensitiveUser.email; // Different email
        sensitiveRecipient.firstName = member.details.firstName;
        sensitiveRecipient.lastName = member.details.lastName;
        sensitiveRecipient.sentAt = new Date();

        // Add sensitive replacements that should be stripped by the API
        sensitiveRecipient.replacements = [
            Replacement.create({
                token: 'loginDetails',
                value: '',
                html: `<p class="description"><em>Login with <strong>${sensitiveUser.email}</strong> Alice Security Code: <span class="style-inline-code">ABCD-EFGH-IJKL-MNOP</span></em></p>`,
            }),
            Replacement.create({
                token: 'unsubscribeUrl',
                value: 'https://example.com/unsubscribe?token=secret-token-12345',
            }),
            Replacement.create({
                token: 'signInUrl',
                value: 'https://example.com/login?token=private-signin-token-67890',
            }),
            Replacement.create({
                token: 'outstandingBalance',
                value: '€ 150.00',
            }),
            Replacement.create({
                token: 'balanceTable',
                html: '<table><tr><td>Private balance information</td><td>€ 150.00</td></tr></table>',
            }),
        ];

        await sensitiveRecipient.save();

        // Search specifically for this email to avoid interference from other tests
        const searchQuery = new LimitedFilteredRequest({
            limit: 10,
            search: 'Sensitive Data Email',
        });

        const response = await getAdminEmails(searchQuery);

        expect(response.body.results).toHaveLength(1);
        const emailResult = response.body.results[0];

        const recipient = emailResult.exampleRecipient!;
        expect(recipient).toBeDefined();

        // The original recipient struct keeps its original userId and email from the sensitive user
        expect(recipient.userId).toBe(sensitiveUser.id); // Original userId
        expect(recipient.email).toBe(sensitiveUser.email); // Original email

        // Verify that sensitive data has been properly processed
        expect(recipient.replacements).toBeDefined();
        expect(Array.isArray(recipient.replacements)).toBe(true);

        const allReplacementsString = JSON.stringify(recipient.replacements);
        expect(allReplacementsString).not.toContain('ABCD-EFGH-IJKL-MNOP'); // Original security code should be gone
        expect(allReplacementsString).not.toContain('secret-token-12345'); // Original sensitive unsubscribe token should be gone
        expect(allReplacementsString).not.toContain('private-signin-token-67890'); // Original sensitive signin token should be gone

        // Verify that safe, current-user-appropriate replacements are created
        const loginDetailsReplacement = recipient.replacements.find(r => r.token === 'loginDetails');
        const unsubscribeUrlReplacement = recipient.replacements.find(r => r.token === 'unsubscribeUrl');

        // loginDetails should exist and be empty/generic for web display
        expect(loginDetailsReplacement).toBeDefined();
        expect(loginDetailsReplacement!.html).not.toBe(undefined); // Should be empty for web display
        expect(loginDetailsReplacement!.value).toBe('');
        // Check html contains ••••
        expect(loginDetailsReplacement!.html).toContain('••••');

        // unsubscribeUrl should exist and be safe for web display
        expect(unsubscribeUrlReplacement).toBeDefined();
        expect(unsubscribeUrlReplacement!.value).toMatch(/^https:\/\//); // Should still be a valid URL
        expect(unsubscribeUrlReplacement!.value).not.toContain('secret-token-12345'); // Original sensitive token should be gone

        // This tests that EmailPreviewService.getStructureForUser properly handles sensitive data by:
        // 1. Removing original sensitive replacements from other users' data
        // 2. Creating fresh, appropriate replacements for the current viewer
        // 3. Ensuring web safety of all replacement values

        // Check outstandingBalance replacement IS not altered
        const balanceReplacement = recipient.replacements.find(r => r.token === 'outstandingBalance');
        expect(balanceReplacement).toBeDefined();
        expect(balanceReplacement!.value).toBe('€ 150.00'); // Should be corrected to the new user

        // Check balanceTable replacement IS not altered
        const balanceTableReplacement = recipient.replacements.find(r => r.token === 'balanceTable');
        expect(balanceTableReplacement).toBeDefined();
        expect(balanceTableReplacement!.html).toBe('<table><tr><td>Private balance information</td><td>€ 150.00</td></tr></table>'); // Should be corrected to the new user
    });
});

describe('Endpoint.getAdminEmails financial data', () => {
    const endpoint = new GetAdminEmailsEndpoint();
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
     * The example recipient of this email is that member.
     */
    const createEmailToMemberWithBalance = async (subject: string) => {
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
        email.subject = subject;
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

    const getEmail = async (subject: string, token: Token) => {
        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                limit: 10,
                search: subject,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        const response = await testServer.test(endpoint, request);
        expect(response.body.results).toHaveLength(1);
        return response.body.results[0];
    };

    test('The balance of the example recipient is hidden without MemberReadFinancialData', async () => {
        const { price } = await createEmailToMemberWithBalance('Balance preview hidden');

        const result = await getEmail('Balance preview hidden', readerToken);
        const replacements = result.exampleRecipient!.replacements;

        expect(JSON.stringify(replacements)).not.toContain(price);
        expect(replacements.find(r => r.token === 'outstandingBalance')?.value ?? '').not.toBe(price);
        expect(replacements.find(r => r.token === 'balanceTable')?.html ?? '').not.toContain(price);
    });

    test('The balance of the example recipient is visible with MemberReadFinancialData', async () => {
        const { price } = await createEmailToMemberWithBalance('Balance preview visible');

        const result = await getEmail('Balance preview visible', financialReaderToken);
        const replacements = result.exampleRecipient!.replacements;

        expect(replacements.find(r => r.token === 'outstandingBalance')?.value).toBe(price);
        expect(replacements.find(r => r.token === 'balanceTable')?.html).toContain(price);
    });
});
