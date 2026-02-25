import { Request } from '@simonbackx/simple-endpoints';
import { Email, EmailRecipient, MemberFactory, Organization, OrganizationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { EmailStatus, LimitedFilteredRequest, PermissionLevel, Permissions, Replacement } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetAdminEmailsEndpoint } from './GetAdminEmailsEndpoint.js';
import { Formatter } from '@stamhoofd/utility';

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

        userToken = await Token.createToken(user);
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

        // This tests that Email.getStructureForUser properly handles sensitive data by:
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
