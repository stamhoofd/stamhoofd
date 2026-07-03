import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import type { RateLimiter } from '@stamhoofd/models';
import { AuditLog, EmailTemplateFactory, Member, MemberFactory, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { AuditLogReplacementType, AuditLogType, EmailTemplateType, MemberDetails, Parent, ParentType, SecurityCodeSendMethod, SendMemberSecurityCodeRequest } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import type { SMSMocker } from '../../../../tests/helpers/SMSMocker.js';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initSMSApi } from '../../../../tests/init/index.js';
import { memberPhoneLookupLimiter, memberSecurityCodeSendLimiter, SendMemberSecurityCodeEndpoint, smsOrganizationLimiter, userSecurityCodeSendLimiter } from './SendMemberSecurityCodeEndpoint.js';

const baseUrl = `/members/security-code`;
const endpoint = new SendMemberSecurityCodeEndpoint();

const securityCode = 'ABCD1234WXYZ5678';
const formattedCode = 'ABCD-1234-WXYZ-5678';
const memberPhone = '+32 470 12 34 56'; // -> 32470123456
const parentPhone = '+32 471 98 76 54'; // -> 32471987654

function resetLimiter(limiter: RateLimiter) {
    for (const window of limiter.windows) {
        window.windows.clear();
        window.start = new Date();
    }
}

describe('Endpoint.SendMemberSecurityCode', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');

        // Rate limiters are in-memory singletons, reset them between tests
        resetLimiter(memberSecurityCodeSendLimiter);
        resetLimiter(userSecurityCodeSendLimiter);
        resetLimiter(smsOrganizationLimiter);
        resetLimiter(memberPhoneLookupLimiter);
    });

    async function setup(overrides: { phone?: string | null; parents?: Parent[] } = {}) {
        const organization = await new OrganizationFactory({}).create();
        await new EmailTemplateFactory({ type: EmailTemplateType.MemberSecurityCode }).create();

        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);

        const details = MemberDetails.create({
            firstName: 'Jef',
            lastName: 'Testman',
            birthDay: new Date(Date.UTC(2010, 4, 5)),
            email: 'kid@example.com',
            phone: overrides.phone !== undefined ? overrides.phone : memberPhone,
            securityCode,
            parents: overrides.parents !== undefined
                ? overrides.parents
                : [
                        Parent.create({
                            type: ParentType.Mother,
                            firstName: 'Anna',
                            lastName: 'Testman',
                            email: 'parent@example.com',
                            phone: parentPhone,
                        }),
                    ],
        });

        const member = await new MemberFactory({ organization, details }).create();
        return { organization, user, token, member };
    }

    function buildRequest(host: string, token: Token, body: SendMemberSecurityCodeRequest) {
        const request = Request.buildJson('POST', baseUrl, host, body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return request;
    }

    test('sends the code via email to all known email addresses', async () => {
        const { organization, token, member } = await setup();

        const request = buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.Email,
        }));

        const response = await testServer.test(endpoint, request);
        expect(response.body.method).toBe(SecurityCodeSendMethod.Email);

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails.length).toBe(2);
        const recipients = emails.map(e => e.to).join(', ');
        expect(recipients).toContain('kid@example.com');
        expect(recipients).toContain('parent@example.com');
        for (const email of emails) {
            expect(email.text).toContain(formattedCode);
        }
    });

    test('sends the code via SMS to the member phone number', async () => {
        const mocker: SMSMocker = initSMSApi();
        const { organization, token, member } = await setup();

        const request = buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.SMS,
        }));

        const response = await testServer.test(endpoint, request);

        expect(response.body.method).toBe(SecurityCodeSendMethod.SMS);
        expect(response.body.maskedRecipient).toBe('•• •• 56');

        expect(mocker.sentMessages.length).toBe(1);
        expect(mocker.lastMessage!.recipient).toEqual(32470123456);
        expect(mocker.lastMessage!.message).toContain(formattedCode);

        // No emails should have been sent
        expect(await EmailMocker.transactional.getSucceededCount()).toBe(0);
    });

    test('cycles to the next phone number on retries', async () => {
        const mocker: SMSMocker = initSMSApi();
        const { organization, token, member } = await setup();

        const body = SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.SMS,
            tryCount: 0,
        });

        await testServer.test(endpoint, buildRequest(organization.getApiHost(), token, body));
        expect(mocker.lastMessage!.recipient).toEqual(32470123456);

        // Allow a new send for the same member (5 minute limit)
        resetLimiter(memberSecurityCodeSendLimiter);

        const retry = SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.SMS,
            tryCount: 1,
        });
        const response = await testServer.test(endpoint, buildRequest(organization.getApiHost(), token, retry));

        expect(mocker.sentMessages.length).toBe(2);
        expect(mocker.lastMessage!.recipient).toEqual(32471987654);
        expect(response.body.maskedRecipient).toBe('•• •• 54');
    });

    test('only sends to the provided phone number when it matches a known number', async () => {
        const mocker: SMSMocker = initSMSApi();
        const { organization, token, member } = await setup();

        // Provide the parent number in national format. Even though tryCount 0 would normally select the
        // member number, an exact (normalized) match must win.
        const request = buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.SMS,
            tryCount: 0,
            phone: '0471 98 76 54',
        }));

        const response = await testServer.test(endpoint, request);

        expect(mocker.sentMessages.length).toBe(1);
        expect(mocker.lastMessage!.recipient).toEqual(32471987654);
        expect(response.body.maskedRecipient).toBe('•• •• 54');
    });

    test('throws when the provided phone number is not known for the member', async () => {
        const mocker: SMSMocker = initSMSApi();
        const { organization, token, member } = await setup();

        const request = buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.SMS,
            phone: '+32 490 00 00 00',
        }));

        await expect(testServer.test(endpoint, request))
            .rejects
            .toThrow(STExpect.errorWithCode('phone_not_found'));

        // No SMS may be sent to an unknown number
        expect(mocker.sentMessages.length).toBe(0);
    });

    test('rate limits phone number lookups per member to prevent enumeration', async () => {
        const mocker: SMSMocker = initSMSApi();
        const { organization, token, member } = await setup();

        // Simulate that the hourly phone lookup limit for this member is already reached
        for (let i = 0; i < 10; i++) {
            memberPhoneLookupLimiter.track(member.id, 1);
        }

        const request = buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.SMS,
            phone: '+32 490 00 00 00',
        }));

        await expect(testServer.test(endpoint, request))
            .rejects
            .toThrow(STExpect.errorWithCode('too_many_requests'));
        expect(mocker.sentMessages.length).toBe(0);
    });

    test('creates an audit log when a security code is requested via email', async () => {
        const { organization, user, token, member } = await setup();

        await testServer.test(endpoint, buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.Email,
        })));

        const log = await AuditLog.select()
            .where('type', AuditLogType.MemberSecurityCodeRequested)
            .where('objectId', member.id)
            .first(true);

        expect(log.userId).toBe(user.id);
        expect(log.organizationId).toBe(member.organizationId);
        expect(log.replacements.get('m')).toMatchObject({
            id: member.id,
            value: member.details.name,
            type: AuditLogReplacementType.Member,
        });
        expect(log.replacements.get('method')?.value).toBe('e-mail');
        expect(log.replacements.get('recipient')?.value).toContain('kid@example.com');
        expect(log.replacements.get('recipient')?.value).toContain('parent@example.com');
    });

    test('creates an audit log with the masked recipient when a security code is requested via SMS', async () => {
        initSMSApi();
        const { user, organization, token, member } = await setup();

        await testServer.test(endpoint, buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.SMS,
        })));

        const log = await AuditLog.select()
            .where('type', AuditLogType.MemberSecurityCodeRequested)
            .where('objectId', member.id)
            .first(true);

        expect(log.userId).toBe(user.id);
        expect(log.replacements.get('method')?.value).toBe('SMS');
        expect(log.replacements.get('recipient')?.value).toBe('•• •• 56');
    });

    test('generates a security code if the member has none', async () => {
        const { organization, token, member } = await setup();

        // Simulate an organization-mode member without a security code
        member.details.securityCode = null;
        await member.save();

        const request = buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.Email,
        }));

        await testServer.test(endpoint, request);

        const updated = await Member.getByID(member.id);
        expect(updated!.details.securityCode).toBeTruthy();
        expect(updated!.details.securityCode!.length).toBe(16);

        const formatted = Formatter.spaceString(updated!.details.securityCode!, 4, '-');
        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails.length).toBe(2);
        expect(emails[0].text).toContain(formatted);
    });

    test('throws when no member is found', async () => {
        const { organization, token } = await setup();

        const request = buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: 'not-found',
            method: SecurityCodeSendMethod.Email,
        }));

        await expect(testServer.test(endpoint, request))
            .rejects
            .toThrow(STExpect.errorWithCode('member_not_found'));
    });

    test('throws when the member has no phone number for SMS', async () => {
        initSMSApi();
        const { organization, token, member } = await setup({ phone: null, parents: [] });

        const request = buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.SMS,
        }));

        await expect(testServer.test(endpoint, request))
            .rejects
            .toThrow(STExpect.errorWithCode('no_phone'));
    });

    test('rate limits sending email per member', async () => {
        const { organization, token, member } = await setup();

        const body = () => SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.Email,
        });

        await testServer.test(endpoint, buildRequest(organization.getApiHost(), token, body()));

        await expect(testServer.test(endpoint, buildRequest(organization.getApiHost(), token, body())))
            .rejects
            .toThrow(STExpect.errorWithCode('too_many_requests'));
    });

    test('rate limits sending SMS per member', async () => {
        const mocker: SMSMocker = initSMSApi();

        const { organization, token, member } = await setup();

        const body = () => SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.SMS,
        });

        await testServer.test(endpoint, buildRequest(organization.getApiHost(), token, body()));
        await testServer.test(endpoint, buildRequest(organization.getApiHost(), token, body()));
        await testServer.test(endpoint, buildRequest(organization.getApiHost(), token, body()));

        await expect(testServer.test(endpoint, buildRequest(organization.getApiHost(), token, body())))
            .rejects
            .toThrow(STExpect.errorWithCode('too_many_requests'));
        expect(mocker.sentMessages.length).toBe(3);
    });

    test('rate limits SMS per organization to 25 per day', async () => {
        const mocker: SMSMocker = initSMSApi();
        const { organization, token, member } = await setup();

        // Simulate that the organization already sent 25 SMS today
        for (let i = 0; i < 25; i++) {
            smsOrganizationLimiter.track(member.organizationId ?? organization.id, 1);
        }

        const request = buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.SMS,
        }));

        await expect(testServer.test(endpoint, request))
            .rejects
            .toThrow(STExpect.errorWithCode('too_many_sms'));
        expect(mocker.sentMessages.length).toBe(0);
    });

    test('rate limits per user to prevent enumeration', async () => {
        const { organization, user, token, member } = await setup();

        // Simulate that the user already reached the hourly limit
        for (let i = 0; i < 20; i++) {
            userSecurityCodeSendLimiter.track(user.id, 1);
        }

        const request = buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.Email,
        }));

        await expect(testServer.test(endpoint, request))
            .rejects
            .toThrow(STExpect.errorWithCode('too_many_requests'));
    });

    test('reports an error when the SMS gateway fails', async () => {
        const mocker: SMSMocker = initSMSApi();
        mocker.forceFailure();
        const { organization, token, member } = await setup();

        const request = buildRequest(organization.getApiHost(), token, SendMemberSecurityCodeRequest.create({
            memberId: member.id,
            method: SecurityCodeSendMethod.SMS,
        }));

        await expect(testServer.test(endpoint, request))
            .rejects
            .toThrow(STExpect.errorWithCode('sms_failed'));
    });
});
