import { Request } from '@simonbackx/simple-endpoints';
import { Email, EmailRecipient, MemberFactory, Organization, OrganizationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { EmailStatus, LimitedFilteredRequest, Replacement } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetUserEmailsEndpoint } from './GetUserEmailsEndpoint.js';
import { Formatter } from '@stamhoofd/utility';

const baseUrl = `/user/email`;

describe('Endpoint.GetUserEmails', () => {
    const endpoint = new GetUserEmailsEndpoint();
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
        }).create();

        // Create a member associated with the user
        member = await new MemberFactory({
            organization,
            user,
        }).create();

        userToken = await Token.createToken(user);
    });

    afterEach(async () => {
        // Delete all emails
        await Email.delete();
    });

    const getUserEmails = async (query: LimitedFilteredRequest = new LimitedFilteredRequest({ limit: 10 }), token: Token = userToken, testOrganization: Organization = organization) => {
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
        const response = await getUserEmails();
        expect(response.body.results).toHaveLength(0);
    });

    test('Should return sent email when it is sent to user', async () => {
        // Create an email
        const email = new Email();
        email.subject = 'Test Email Subject';
        email.status = EmailStatus.Sent;
        email.text = 'This is a test email content';
        email.html = '<p>This is a test email content</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        email.sentAt = new Date();
        await email.save();

        // Create an email recipient linked to the member
        const emailRecipient = new EmailRecipient();
        emailRecipient.emailId = email.id;
        emailRecipient.memberId = member.id;
        emailRecipient.userId = user.id;
        emailRecipient.email = user.email;
        emailRecipient.firstName = member.details.firstName;
        emailRecipient.lastName = member.details.lastName;
        emailRecipient.sentAt = new Date();
        await emailRecipient.save();

        const response = await getUserEmails();

        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].subject).toBe('Test Email Subject');
        expect(response.body.results[0].id).toBe(email.id);
        expect(response.body.results[0].status).toBe(EmailStatus.Sent);
    });

    test('Should not return draft emails', async () => {
        // Create a draft email
        const email = new Email();
        email.subject = 'Draft Email';
        email.status = EmailStatus.Draft;
        email.text = 'This is a draft email';
        email.html = '<p>This is a draft email</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        await email.save();

        // Create an email recipient linked to the member
        const emailRecipient = new EmailRecipient();
        emailRecipient.emailId = email.id;
        emailRecipient.memberId = member.id;
        emailRecipient.userId = user.id;
        emailRecipient.email = user.email;
        emailRecipient.firstName = member.details.firstName;
        emailRecipient.lastName = member.details.lastName;
        await emailRecipient.save();

        const response = await getUserEmails();

        // Should not include the draft email
        expect(response.body.results.find(e => e.id === email.id)).toBeUndefined();
    });

    test('Should not return emails with showInMemberPortal = false', async () => {
        // Create an email with showInMemberPortal = false
        const email = new Email();
        email.subject = 'Hidden Email';
        email.status = EmailStatus.Sent;
        email.text = 'This email should be hidden';
        email.html = '<p>This email should be hidden</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.showInMemberPortal = false; // This should hide the email
        email.sentAt = new Date();
        await email.save();

        // Create an email recipient linked to the member
        const emailRecipient = new EmailRecipient();
        emailRecipient.emailId = email.id;
        emailRecipient.memberId = member.id;
        emailRecipient.userId = user.id;
        emailRecipient.email = user.email;
        emailRecipient.firstName = member.details.firstName;
        emailRecipient.lastName = member.details.lastName;
        emailRecipient.sentAt = new Date();
        await emailRecipient.save();

        const response = await getUserEmails();

        // Should not include the hidden email
        expect(response.body.results.find(e => e.id === email.id)).toBeUndefined();
    });

    test('Should not return emails sent to other users', async () => {
        // Create another user and member
        const otherUser = await new UserFactory({
            organization,
        }).create();

        const otherMember = await new MemberFactory({
            organization,
            user: otherUser,
        }).create();

        // Create an email
        const email = new Email();
        email.subject = 'Email for Other User';
        email.status = EmailStatus.Sent;
        email.text = 'This email is for another user';
        email.html = '<p>This email is for another user</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        email.sentAt = new Date();
        await email.save();

        // Create an email recipient linked to the OTHER member
        const emailRecipient = new EmailRecipient();
        emailRecipient.emailId = email.id;
        emailRecipient.memberId = otherMember.id;
        emailRecipient.userId = otherUser.id;
        emailRecipient.email = otherUser.email;
        emailRecipient.firstName = otherMember.details.firstName;
        emailRecipient.lastName = otherMember.details.lastName;
        emailRecipient.sentAt = new Date();
        await emailRecipient.save();

        const response = await getUserEmails();

        // Should not include emails sent to other users
        expect(response.body.results.find(e => e.id === email.id)).toBeUndefined();
    });

    test('Should not return deleted emails', async () => {
        // Create a deleted email
        const email = new Email();
        email.subject = 'Deleted Email';
        email.status = EmailStatus.Sent;
        email.text = 'This email has been deleted';
        email.html = '<p>This email has been deleted</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        email.sentAt = new Date();
        email.deletedAt = new Date(); // Mark as deleted
        await email.save();

        // Create an email recipient linked to the member
        const emailRecipient = new EmailRecipient();
        emailRecipient.emailId = email.id;
        emailRecipient.memberId = member.id;
        emailRecipient.userId = user.id;
        emailRecipient.email = user.email;
        emailRecipient.firstName = member.details.firstName;
        emailRecipient.lastName = member.details.lastName;
        emailRecipient.sentAt = new Date();
        await emailRecipient.save();

        const response = await getUserEmails();

        // Should not include the deleted email
        expect(response.body.results.find(e => e.id === email.id)).toBeUndefined();
    });

    test('Should filter emails by subject when search is provided', async () => {
        // Create first email
        const email1 = new Email();
        email1.subject = 'Important Meeting Reminder';
        email1.status = EmailStatus.Sent;
        email1.text = 'Meeting content';
        email1.html = '<p>Meeting content</p>';
        email1.json = {};
        email1.organizationId = organization.id;
        email1.showInMemberPortal = true;
        email1.sentAt = new Date();
        await email1.save();

        // Create second email
        const email2 = new Email();
        email2.subject = 'Newsletter Update';
        email2.status = EmailStatus.Sent;
        email2.text = 'Newsletter content';
        email2.html = '<p>Newsletter content</p>';
        email2.json = {};
        email2.organizationId = organization.id;
        email2.showInMemberPortal = true;
        email2.sentAt = new Date();
        await email2.save();

        // Create recipients for both emails
        const recipient1 = new EmailRecipient();
        recipient1.emailId = email1.id;
        recipient1.memberId = member.id;
        recipient1.userId = user.id;
        recipient1.email = user.email;
        recipient1.firstName = member.details.firstName;
        recipient1.lastName = member.details.lastName;
        recipient1.sentAt = new Date();
        await recipient1.save();

        const recipient2 = new EmailRecipient();
        recipient2.emailId = email2.id;
        recipient2.memberId = member.id;
        recipient2.userId = user.id;
        recipient2.email = user.email;
        recipient2.firstName = member.details.firstName;
        recipient2.lastName = member.details.lastName;
        recipient2.sentAt = new Date();
        await recipient2.save();

        // Search for "Meeting"
        const searchQuery = new LimitedFilteredRequest({
            limit: 10,
            search: 'Meeting',
        });

        const response = await getUserEmails(searchQuery);

        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].subject).toBe('Important Meeting Reminder');
    });

    test('Should respect pagination limit', async () => {
        // Create multiple emails
        const emails: Email[] = [];
        for (let i = 0; i < 5; i++) {
            const email = new Email();
            email.subject = `Test Email ${i}`;
            email.status = EmailStatus.Sent;
            email.text = `Content ${i}`;
            email.html = `<p>Content ${i}</p>`;
            email.json = {};
            email.organizationId = organization.id;
            email.showInMemberPortal = true;
            email.sentAt = new Date();
            await email.save();
            emails.push(email);
        }

        // Create recipients for all emails
        const recipients: EmailRecipient[] = [];
        for (const email of emails) {
            const recipient = new EmailRecipient();
            recipient.emailId = email.id;
            recipient.memberId = member.id;
            recipient.userId = user.id;
            recipient.email = user.email;
            recipient.firstName = member.details.firstName;
            recipient.lastName = member.details.lastName;
            recipient.sentAt = new Date();
            await recipient.save();
            recipients.push(recipient);
        }

        // Test with limit of 3
        const limitedQuery = new LimitedFilteredRequest({
            limit: 3,
        });

        const response = await getUserEmails(limitedQuery);

        expect(response.body.results).toHaveLength(3);
        expect(response.body.next).toBeDefined(); // Should have next page
    });

    test('Should return correct recipient when email has multiple recipients matching same user', async () => {
        // Create an email
        const email = new Email();
        email.subject = 'Multiple Recipients Email';
        email.status = EmailStatus.Sent;
        email.text = 'Email with multiple recipients';
        email.html = '<p>Email with multiple recipients</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        email.sentAt = new Date();
        await email.save();

        // Create multiple recipients for the same user/member combination
        // First recipient: exact match (userId and email match)
        const exactMatchRecipient = new EmailRecipient();
        exactMatchRecipient.emailId = email.id;
        exactMatchRecipient.memberId = member.id;
        exactMatchRecipient.userId = user.id;
        exactMatchRecipient.email = user.email;
        exactMatchRecipient.firstName = 'Exact';
        exactMatchRecipient.lastName = 'Match';
        exactMatchRecipient.sentAt = new Date();
        await exactMatchRecipient.save();

        // Second recipient: member match only (no userId or email)
        const memberOnlyRecipient = new EmailRecipient();
        memberOnlyRecipient.emailId = email.id;
        memberOnlyRecipient.memberId = member.id;
        memberOnlyRecipient.userId = null;
        memberOnlyRecipient.email = null;
        memberOnlyRecipient.firstName = 'Member';
        memberOnlyRecipient.lastName = 'Only';
        memberOnlyRecipient.sentAt = new Date();
        await memberOnlyRecipient.save();

        // Third recipient: any data but same member
        const anyDataRecipient = new EmailRecipient();
        anyDataRecipient.emailId = email.id;
        anyDataRecipient.memberId = member.id;
        anyDataRecipient.userId = null; // No specific user
        anyDataRecipient.email = 'other@example.com'; // Different email
        anyDataRecipient.firstName = 'Any';
        anyDataRecipient.lastName = 'Data';
        anyDataRecipient.sentAt = new Date();
        await anyDataRecipient.save();

        // Search specifically for this email to avoid interference from other tests
        const searchQuery = new LimitedFilteredRequest({
            limit: 10,
            search: 'Multiple Recipients Email',
        });

        const response = await getUserEmails(searchQuery);

        expect(response.body.results).toHaveLength(1);
        const emailResult = response.body.results[0];

        // Should prefer the exact match recipient
        expect(emailResult.recipients).toHaveLength(1);
        expect(emailResult.recipients[0].id).toBe(exactMatchRecipient.id);
    });

    test('Should return generic data when recipient has no matching user id or email', async () => {
        // Create an email
        const email = new Email();
        email.subject = 'Generic Recipient Email';
        email.status = EmailStatus.Sent;
        email.text = 'Email with generic recipient';
        email.html = '<p>Email with generic recipient</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        email.sentAt = new Date();
        await email.save();

        // Create a recipient with no userId or email (generic member data)
        const genericRecipient = new EmailRecipient();
        genericRecipient.emailId = email.id;
        genericRecipient.memberId = member.id;
        genericRecipient.userId = null; // No specific user
        genericRecipient.email = null; // No specific email
        genericRecipient.firstName = 'Generic';
        genericRecipient.lastName = 'Member';
        genericRecipient.sentAt = new Date();
        await genericRecipient.save();

        // Search specifically for this email to avoid interference from other tests
        const searchQuery = new LimitedFilteredRequest({
            limit: 10,
            search: 'Generic Recipient Email',
        });

        const response = await getUserEmails(searchQuery);

        expect(response.body.results).toHaveLength(1);
        const emailResult = response.body.results[0];

        // Should return the generic recipient data
        expect(emailResult.recipients).toHaveLength(1);
        expect(emailResult.recipients[0].id).toBe(genericRecipient.id);
        expect(emailResult.recipients[0].replacements).toBeDefined();
    });

    test('Should strip sensitive information from email replacements for non-matching recipients', async () => {
        // Create another user that will have sensitive data
        const sensitiveUser = await new UserFactory({
            organization,
        }).create();

        // Create an email
        const email = new Email();
        email.subject = 'Sensitive Data Email';
        email.status = EmailStatus.Sent;
        email.text = 'Email with sensitive replacements {{outstandingBalance}} {{loginDetails}} {{unsubscribeUrl}}';
        email.html = '<p>Email with sensitive replacements {{outstandingBalance}} {{loginDetails}} {{unsubscribeUrl}}</p>{{balanceTable}}';
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

        const response = await getUserEmails(searchQuery);

        expect(response.body.results).toHaveLength(1);
        const emailResult = response.body.results[0];

        expect(emailResult.recipients).toHaveLength(1);
        const recipient = emailResult.recipients[0];

        // The original recipient struct keeps its original userId and email from the sensitive user, but returns different data:
        expect(recipient.userId).toBe(user.id); // new userId
        expect(recipient.email).toBe(user.email); // new email

        // Verify that sensitive data has been properly processed
        expect(recipient.replacements).toBeDefined();
        expect(Array.isArray(recipient.replacements)).toBe(true);

        // The system should:
        // 1. Strip sensitive replacements from the original recipient (done with willFill: true)
        // 2. Create new appropriate replacements for the current viewing user (done with fillRecipientReplacements)
        // 3. Apply web display filtering (done with stripRecipientReplacementsForWebDisplay)

        // The original sensitive data (ABCD-EFGH-IJKL-MNOP, secret-token-12345, private-signin-token-67890)
        // should be completely gone because:
        // - stripSensitiveRecipientReplacements removes the original replacements
        // - fillRecipientReplacements creates new ones for the current user
        // - stripRecipientReplacementsForWebDisplay makes them safe for web display

        const allReplacementsString = JSON.stringify(recipient.replacements);
        expect(allReplacementsString).not.toContain('ABCD-EFGH-IJKL-MNOP'); // Original security code should be gone
        expect(allReplacementsString).not.toContain('secret-token-12345'); // Original sensitive unsubscribe token should be gone
        expect(allReplacementsString).not.toContain('private-signin-token-67890'); // Original sensitive signin token should be gone

        // Verify that safe, current-user-appropriate replacements are created
        const loginDetailsReplacement = recipient.replacements.find(r => r.token === 'loginDetails');
        const unsubscribeUrlReplacement = recipient.replacements.find(r => r.token === 'unsubscribeUrl');

        // loginDetails should exist and be empty/generic for web display
        expect(loginDetailsReplacement).toBeDefined();
        expect(loginDetailsReplacement!.html).toBe(undefined); // Should be empty for web display
        expect(loginDetailsReplacement!.value).toBe('');

        // unsubscribeUrl should exist and be safe for web display
        expect(unsubscribeUrlReplacement).toBeDefined();
        expect(unsubscribeUrlReplacement!.value).toMatch(/^https:\/\//); // Should still be a valid URL
        expect(unsubscribeUrlReplacement!.value).not.toContain('secret-token-12345'); // Original sensitive token should be gone

        // This tests that Email.getStructureForUser properly handles sensitive data by:
        // 1. Removing original sensitive replacements from other users' data
        // 2. Creating fresh, appropriate replacements for the current viewer
        // 3. Ensuring web safety of all replacement values

        // Check outstandingBalance replacement
        const balanceReplacement = recipient.replacements.find(r => r.token === 'outstandingBalance');
        expect(balanceReplacement).toBeDefined();
        expect(balanceReplacement!.value).toBe(Formatter.price(0)); // Should be corrected to the new user

        // Check balanceTable replacement
        const balanceTableReplacement = recipient.replacements.find(r => r.token === 'balanceTable');
        expect(balanceTableReplacement).toBeDefined();
        expect(balanceTableReplacement!.html).toBe('<p class="description">' + $t('4c4f6571-f7b5-469d-a16f-b1547b43a610') + '</p>');
    });

    test('Should return one recipient for each member the user is associated with, if the email is different for each member', async () => {
        // Create another member associated with the same user
        const secondMember = await new MemberFactory({
            organization,
            user,
        }).create();

        // Create an email
        const email = new Email();
        email.subject = 'Email for Multiple Members';
        email.status = EmailStatus.Sent;
        email.text = 'Member name: {{memberFirstName}}';
        email.html = '<p>Member name: {{memberFirstName}}</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        email.sentAt = new Date();
        await email.save();

        // Create an email recipient linked to the FIRST member
        const recipient1 = new EmailRecipient();
        recipient1.emailId = email.id;
        recipient1.memberId = member.id; // First member
        recipient1.userId = user.id;
        recipient1.email = user.email;
        recipient1.firstName = member.details.firstName;
        recipient1.lastName = member.details.lastName;
        recipient1.replacements = [
            Replacement.create({
                token: 'memberFirstName',
                value: member.details.firstName,
            }),
        ];
        recipient1.sentAt = new Date();
        await recipient1.save();

        // Create an email recipient linked to the SECOND member
        const recipient2 = new EmailRecipient();
        recipient2.emailId = email.id;
        recipient2.memberId = secondMember.id; // Second member
        recipient2.userId = user.id;
        recipient2.email = user.email;
        recipient2.firstName = secondMember.details.firstName;
        recipient2.lastName = secondMember.details.lastName;
        recipient2.sentAt = new Date();
        recipient2.replacements = [
            Replacement.create({
                token: 'memberFirstName',
                value: secondMember.details.firstName,
            }),
        ];
        await recipient2.save();

        const response = await getUserEmails(
            new LimitedFilteredRequest({ limit: 10, search: 'Email for Multiple Members' }),
        );

        expect(response.body.results).toHaveLength(1);
        const emailResult = response.body.results[0];

        // Should include both members as separate recipients
        expect(emailResult.recipients).toHaveLength(2);
        const firstNames = emailResult.recipients.map(r => r.member?.firstName);
        expect(firstNames).toContain(member.details.firstName);
        expect(firstNames).toContain(secondMember.details.firstName);
    });

    test('Should return a merged recipient for each member the user is associated with, if the email is the same for each member', async () => {
        // Create another member associated with the same user
        const secondMember = await new MemberFactory({
            organization,
            user,
        }).create();

        // Create an email
        const email = new Email();
        email.subject = 'Email for Multiple Members';
        email.status = EmailStatus.Sent;
        email.text = 'Same content';
        email.html = '<p>Same content</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        email.sentAt = new Date();
        await email.save();

        // Create an email recipient linked to the FIRST member
        const recipient1 = new EmailRecipient();
        recipient1.emailId = email.id;
        recipient1.memberId = member.id; // First member
        recipient1.userId = user.id;
        recipient1.email = user.email;
        recipient1.firstName = member.details.firstName;
        recipient1.lastName = member.details.lastName;
        recipient1.replacements = [
            // will get automatically removed because it is not used
            Replacement.create({
                token: 'memberFirstName',
                value: member.details.firstName,
            }),
        ];
        recipient1.sentAt = new Date();
        await recipient1.save();

        // Create an email recipient linked to the SECOND member
        const recipient2 = new EmailRecipient();
        recipient2.emailId = email.id;
        recipient2.memberId = secondMember.id; // Second member
        recipient2.userId = user.id;
        recipient2.email = user.email;
        recipient2.firstName = secondMember.details.firstName;
        recipient2.lastName = secondMember.details.lastName;
        recipient2.sentAt = new Date();
        recipient2.replacements = [
            // will get automatically removed because it is not used
            Replacement.create({
                token: 'memberFirstName',
                value: secondMember.details.firstName,
            }),
        ];
        await recipient2.save();

        const response = await getUserEmails(
            new LimitedFilteredRequest({ limit: 10, search: 'Email for Multiple Members' }),
        );

        expect(response.body.results).toHaveLength(1);
        const emailResult = response.body.results[0];

        // Should include both members as separate recipients
        expect(emailResult.recipients).toHaveLength(1);
    });

    test('Should not return emails from other members the user does not have access to', async () => {
        // Create another user and member
        const otherUser = await new UserFactory({
            organization,
        }).create();

        const otherMember = await new MemberFactory({
            organization,
            user: otherUser,
        }).create();

        // Create an email
        const email = new Email();
        email.subject = 'Email for Other Member';
        email.status = EmailStatus.Sent;
        email.text = 'This email is for another member';
        email.html = '<p>This email is for another member</p>';
        email.json = {};
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        email.sentAt = new Date();
        await email.save();

        // Create an email recipient linked to the OTHER member
        const emailRecipient = new EmailRecipient();
        emailRecipient.emailId = email.id;
        emailRecipient.memberId = otherMember.id; // Different member
        emailRecipient.userId = otherUser.id;
        emailRecipient.email = otherUser.email;
        emailRecipient.firstName = otherMember.details.firstName;
        emailRecipient.lastName = otherMember.details.lastName;
        emailRecipient.sentAt = new Date();
        await emailRecipient.save();

        const response = await getUserEmails();

        // Should not include emails sent to other members
        expect(response.body.results.find(e => e.id === email.id)).toBeUndefined();

        // Test that is IS included if we request the same data via the 'otherUser' token
        const otherUserToken = await Token.createToken(otherUser);
        const responseForOtherUser = await getUserEmails(new LimitedFilteredRequest({ limit: 10 }), otherUserToken);
        expect(responseForOtherUser.body.results.find(e => e.id === email.id)).toBeDefined();
    });

    test('Should throw error when not authenticated', async () => {
        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({ limit: 10 }),
        });
        // No authorization header

        await expect(testServer.test(endpoint, request)).rejects.toThrow();
    });

    test('Should throw error with invalid token', async () => {
        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({ limit: 10 }),
            headers: {
                authorization: 'Bearer invalid_token',
            },
        });

        await expect(testServer.test(endpoint, request)).rejects.toThrow();
    });
});
