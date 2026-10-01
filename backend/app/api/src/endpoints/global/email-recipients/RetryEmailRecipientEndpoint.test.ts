import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import type { Member, Organization, Token, User } from '@stamhoofd/models';
import { Email, EmailRecipient, MemberFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { EmailRecipientsStatus, EmailStatus, OrganizationEmail, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { RetryEmailRecipientEndpoint } from './RetryEmailRecipientEndpoint.js';

describe('Endpoint.RetryEmailRecipient', () => {
    const endpoint = new RetryEmailRecipientEndpoint();
    let organization: Organization;
    let sender: OrganizationEmail;
    let adminToken: Token;
    let recipientUser: User;
    let members: Member[];

    beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        organization = await new OrganizationFactory({}).create();
        sender = OrganizationEmail.create({
            email: 'kapoenen@voorbeeld.com',
            name: 'Kapoenen',
        });
        organization.privateMeta.emails.push(sender);
        await organization.save();

        const admin = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                resources: new Map([
                    [PermissionsResourceType.Senders, new Map([[sender.id, ResourcePermissions.create({
                        resourceName: sender.name!,
                        level: PermissionLevel.Write,
                    })]])],
                ]),
            }),
        }).create();
        adminToken = await SessionService.createSession(admin);

        // A parent with two linked members
        recipientUser = await new UserFactory({ organization, password: null }).create();
        members = [];
        for (const securityCode of ['AAAABBBBCCCCDDDD', 'EEEEFFFFGGGGHHHH']) {
            const member = await new MemberFactory({ organization, user: recipientUser }).create();
            member.details.securityCode = securityCode;
            await member.save();
            members.push(member);
        }
    });

    const retry = async (recipient: EmailRecipient) => {
        const request = Request.buildJson('POST', `/email-recipients/${recipient.id}/retry`, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + adminToken.accessToken;
        return await testServer.test(endpoint, request);
    };

    test('Does not return security codes of linked members after resending loginDetails', async () => {
        const email = new Email();
        email.subject = 'Login details';
        email.status = EmailStatus.Sent;
        email.recipientsStatus = EmailRecipientsStatus.Created;
        email.html = '<p>{{loginDetails}}</p><p>{{unsubscribeUrl}}</p>';
        email.text = '{{loginDetails}} {{unsubscribeUrl}}';
        email.json = {};
        email.fromAddress = sender.email;
        email.organizationId = organization.id;
        email.senderId = sender.id;
        email.sentAt = new Date();
        await email.save();

        const recipient = new EmailRecipient();
        recipient.emailId = email.id;
        recipient.organizationId = organization.id;
        recipient.email = recipientUser.email;
        recipient.userId = recipientUser.id;
        recipient.memberId = members[0].id;
        await recipient.save();

        const response = await retry(recipient);

        // The recipient itself still receives the real security codes
        expect(await EmailMocker.getSucceededCount()).toBe(1);
        const sentHtml = EmailMocker.getSucceededEmail(0).html;
        for (const member of members) {
            expect(sentHtml).toContain(Formatter.spaceString(member.details.securityCode!, 4, '-'));
        }

        expect(response.body.id).toBe(recipient.id);
        expect(response.body.sentAt).toBeInstanceOf(Date);

        const serialized = JSON.stringify(response.body.replacements);
        for (const member of members) {
            expect(serialized).not.toContain(member.details.securityCode!.substring(0, 4));
        }
        expect(response.body.replacements.find(r => r.token === 'loginDetails')?.html).toContain('••••');
        expect(response.body.replacements.find(r => r.token === 'unsubscribeUrl')?.value).toContain('token=example');

        await recipient.refresh();
        expect(recipient.replacements.find(r => r.token === 'loginDetails')).toBeUndefined();
    });
});
