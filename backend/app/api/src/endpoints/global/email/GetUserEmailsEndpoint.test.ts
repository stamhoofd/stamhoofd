import { Request } from '@simonbackx/simple-endpoints';
import { Email, EmailRecipient, MemberFactory, Organization, OrganizationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { EmailStatus, LimitedFilteredRequest } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer';
import { GetUserEmailsEndpoint } from './GetUserEmailsEndpoint';

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
