import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { SimpleError } from '@simonbackx/simple-errors';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import type { Organization } from '@stamhoofd/models';
import { AuditLog, ImpersonationToken, MemberFactory, OrganizationFactory, Platform, RegistrationFactory, Token, User, UserFactory, UserSession } from '@stamhoofd/models';
import { AuditLogType, BooleanStatus, NewUser, PermissionLevel, Permissions, Token as TokenStruct, UserPermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../tests/helpers/TestServer.js';
import '../../audit-logs/init.js';
import { AuditLogService } from '../../services/AuditLogService.js';
import { IMPERSONATION_SESSION_DURATION, SessionService } from '../../services/SessionService.js';
import { GetUserMembersEndpoint } from '../global/registration/GetUserMembersEndpoint.js';
import { CreateTokenEndpoint } from './CreateTokenEndpoint.js';
import { DeleteUserEndpoint } from './DeleteUserEndpoint.js';
import { GetMFAStatusEndpoint } from './GetMFAStatusEndpoint.js';
import { GetUserEndpoint } from './GetUserEndpoint.js';
import { PatchUserEndpoint } from './PatchUserEndpoint.js';
import { RedeemImpersonationEndpoint } from './RedeemImpersonationEndpoint.js';
import { StartImpersonationEndpoint } from './StartImpersonationEndpoint.js';

/**
 * Signing in as another user.
 *
 * Two things are being tested here: that an administrator can look at the application
 * through the eyes of one of their users, and that this never becomes more than looking -
 * the session stays the administrator's, it cannot reach anything they could not reach
 * themselves, and it cannot take the account over.
 */

const startEndpoint = new StartImpersonationEndpoint();
const redeemEndpoint = new RedeemImpersonationEndpoint();
const userEndpoint = new GetUserEndpoint();

const password = 'test-password-1234';
const adminIp = '81.164.1.1';

function firstError(e: unknown): SimpleError {
    if (isSimpleErrors(e)) {
        return e.errors[0];
    }
    if (isSimpleError(e)) {
        return e;
    }
    throw new Error('Not a SimpleError: ' + String(e));
}

async function captureError(promise: Promise<unknown>): Promise<SimpleError> {
    try {
        await promise;
    } catch (e) {
        return firstError(e);
    }
    throw new Error('Expected the request to be rejected, but it succeeded');
}

/**
 * Give the request an address. Without a socket the whole request has no address at all,
 * which would make the address check pass by accident.
 */
function from(request: Request, ip: string): Request {
    request.headers['x-forwarded-for'] = ip;
    request.request = { socket: { remoteAddress: '127.0.0.1' } } as any;
    return request;
}

function bearer(request: Request, token: { accessToken: string }): Request {
    request.headers.authorization = 'Bearer ' + token.accessToken;
    return request;
}

function startRequest(organization: Organization | null, userId: string, ip = adminIp) {
    return from(Request.buildJson('POST', '/impersonation', organization?.getApiHost(), { userId }), ip);
}

function redeemRequest(organization: Organization | null, ticket: string, ip = adminIp) {
    return from(Request.buildJson('POST', '/impersonation/token', organization?.getApiHost(), { ticket }), ip);
}

async function createTicket(organization: Organization | null, admin: User, target: User, ip = adminIp): Promise<string> {
    const token = await SessionService.createSession(admin);
    const response = await testServer.test(startEndpoint, bearer(startRequest(organization, target.id, ip), token));
    return response.body.ticket;
}

function patchUserRequest(organization: Organization, session: TokenStruct, body: AutoEncoderPatchType<NewUser>) {
    return Request.patch({
        path: '/user/' + body.id,
        host: organization.getApiHost(),
        headers: { authorization: 'Bearer ' + session.accessToken },
        body,
    });
}

/**
 * The full flow: an administrator asks for a link and opens it.
 */
async function impersonate(organization: Organization | null, admin: User, target: User): Promise<TokenStruct> {
    const ticket = await createTicket(organization, admin, target);
    const response = await testServer.test(redeemEndpoint, redeemRequest(organization, ticket));
    return response.body;
}

/**
 * Impersonation is opt-in: platform wide, or per organization by a platform admin.
 */
async function enableImpersonation(organization: Organization) {
    organization.privateMeta.featureFlags = ['impersonation'];
    await organization.save();
}

async function setPlatformFeatureFlags(featureFlags: string[]) {
    const platform = await Platform.getForEditing();
    platform.config.featureFlags = featureFlags;
    await platform.save();
}

/**
 * An organization with a full administrator and a member whose parent has an account.
 */
async function setup() {
    const organization = await new OrganizationFactory({}).create();
    await enableImpersonation(organization);
    const admin = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
    const user = await new UserFactory({ organization, password }).create();
    const member = await new MemberFactory({ organization, user }).create();
    await new RegistrationFactory({ member, organization }).create();

    return { organization, admin, user, member };
}

function membersRequest(organization: Organization, session: TokenStruct) {
    return bearer(Request.buildJson('GET', '/user/members', organization.getApiHost()), session);
}

const readMemberFirstName = 'Leesbaar';

async function markSensitive(member: Awaited<ReturnType<MemberFactory['create']>>) {
    member.details.nationalRegisterNumber = '123454123';
    member.details.requiresFinancialSupport = BooleanStatus.create({ value: true });
    await member.save();
    return member;
}

describe('Impersonation', () => {
    // Model changes are only audit logged when the listener is running, which normally
    // happens while booting the server. Test files are isolated, so this stays local.
    beforeAll(() => {
        AuditLogService.listen();
    });

    afterEach(async () => {
        await setPlatformFeatureFlags([]);
    });

    describe('the feature flag', () => {
        test('without it nobody can impersonate', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const user = await new UserFactory({ organization, password }).create();

            const token = await SessionService.createSession(admin);
            const error = await captureError(testServer.test(startEndpoint, bearer(startRequest(organization, user.id), token)));
            expect(error.code).toBe('feature_disabled');
        });

        test('the platform flag enables it for every organization', async () => {
            await setPlatformFeatureFlags(['impersonation']);
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const user = await new UserFactory({ organization, password }).create();

            const token = await impersonate(organization, admin, user);
            expect((await Token.getByAccessToken(token.accessToken))!.session.impersonatedUserId).toBe(user.id);
        });

        test('a link that was made before the flag was turned off no longer works', async () => {
            const { organization, admin, user } = await setup();
            const ticket = await createTicket(organization, admin, user);

            organization.privateMeta.featureFlags = [];
            await organization.save();

            const error = await captureError(testServer.test(redeemEndpoint, redeemRequest(organization, ticket)));
            expect(error.code).toBe('invalid_impersonation_ticket');
        });
    });

    describe('starting an impersonation', () => {
        test('a full admin gets a link and can trade it for a session', async () => {
            const { organization, admin, user } = await setup();

            const token = await impersonate(organization, admin, user);
            expect(token).toBeInstanceOf(TokenStruct);

            // The session stays the administrator's, it only carries the other account.
            const saved = await Token.getByAccessToken(token.accessToken);
            expect(saved!.userId).toBe(admin.id);
            expect(saved!.session.impersonatedUserId).toBe(user.id);
        });

        test('the frontend is told it is the impersonated user, and who is really acting', async () => {
            const { organization, admin, user } = await setup();
            const token = await impersonate(organization, admin, user);

            const response = await testServer.test(userEndpoint, bearer(Request.buildJson('GET', '/v1/user', organization.getApiHost()), (await Token.getByAccessToken(token.accessToken))!));

            expect(response.body.id).toBe(user.id);
            expect(response.body.email).toBe(user.email);
            expect(response.body.impersonatedBy?.id).toBe(admin.id);
            expect(response.body.impersonatedBy?.email).toBe(admin.email);
        });

        test('using the link is written to the audit log', async () => {
            const { organization, admin, user } = await setup();
            await impersonate(organization, admin, user);

            const logs = await AuditLog.select().where('type', AuditLogType.UserImpersonated).where('objectId', user.id).fetch();
            expect(logs.length).toBe(1);
            expect(logs[0].userId).toBe(admin.id);
            expect(logs[0].organizationId).toBe(organization.id);
        });

        test('an administrator without full access cannot start one', async () => {
            const organization = await new OrganizationFactory({}).create();
            await enableImpersonation(organization);
            const admin = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Write }) }).create();
            const user = await new UserFactory({ organization, password }).create();
            await new MemberFactory({ organization, user }).create();

            const token = await SessionService.createSession(admin);
            const error = await captureError(testServer.test(startEndpoint, bearer(startRequest(organization, user.id), token)));
            expect(error.code).toBe('permission_denied');
        });

        test('an admin cannot impersonate a user of another organization', async () => {
            const { organization, admin } = await setup();
            const other = await new OrganizationFactory({}).create();
            const stranger = await new UserFactory({ organization: other, password }).create();
            await new MemberFactory({ organization: other, user: stranger }).create();

            const token = await SessionService.createSession(admin);
            const error = await captureError(testServer.test(startEndpoint, bearer(startRequest(organization, stranger.id), token)));
            expect(error.code).toBe('permission_denied');
        });

        test('in platform mode an organization admin can impersonate an administrator of their own organization', async () => {
            TestUtils.setEnvironment('userMode', 'platform');
            const organization = await new OrganizationFactory({}).create();
            await enableImpersonation(organization);
            const admin = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const colleague = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Write }) }).create();

            const token = await impersonate(organization, admin, colleague);
            expect((await Token.getByAccessToken(token.accessToken))!.session.impersonatedUserId).toBe(colleague.id);
        });

        test('an organization admin cannot impersonate a platform admin', async () => {
            TestUtils.setEnvironment('userMode', 'platform');
            const organization = await new OrganizationFactory({}).create();
            await enableImpersonation(organization);
            const admin = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const platformAdmin = await new UserFactory({ password, globalPermissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const token = await SessionService.createSession(admin);
            const error = await captureError(testServer.test(startEndpoint, bearer(startRequest(organization, platformAdmin.id), token)));
            expect(error.code).toBe('permission_denied');
        });

        test('an impersonated session cannot start another impersonation', async () => {
            const { organization, admin, user } = await setup();
            const session = await impersonate(organization, admin, user);
            const other = await new UserFactory({ organization, password }).create();
            await new MemberFactory({ organization, user: other }).create();

            const error = await captureError(testServer.test(startEndpoint, bearer(startRequest(organization, other.id), (await Token.getByAccessToken(session.accessToken))!)));
            expect(error.code).toBe('not_allowed_while_impersonating');
        });
    });

    describe('the link', () => {
        test('only works once', async () => {
            const { organization, admin, user } = await setup();
            const ticket = await createTicket(organization, admin, user);

            await testServer.test(redeemEndpoint, redeemRequest(organization, ticket));

            const error = await captureError(testServer.test(redeemEndpoint, redeemRequest(organization, ticket)));
            expect(error.code).toBe('invalid_impersonation_ticket');
        });

        test('only works from the address that asked for it', async () => {
            const { organization, admin, user } = await setup();
            const ticket = await createTicket(organization, admin, user);

            const error = await captureError(testServer.test(redeemEndpoint, redeemRequest(organization, ticket, '81.164.9.9')));
            expect(error.code).toBe('invalid_impersonation_ticket');

            // The ticket is not consumed by a failed attempt: the administrator can still
            // open their own link.
            const response = await testServer.test(redeemEndpoint, redeemRequest(organization, ticket));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });

        test('stops working after it expires', async () => {
            const { organization, admin, user } = await setup();
            const ticket = await createTicket(organization, admin, user);

            const model = (await ImpersonationToken.getValid(ticket))!;
            model.expiresAt = new Date(Date.now() - 1000);
            await model.save();

            const error = await captureError(testServer.test(redeemEndpoint, redeemRequest(organization, ticket)));
            expect(error.code).toBe('invalid_impersonation_ticket');
        });

        test('stops working when the administrator loses their permissions', async () => {
            const { organization, admin, user } = await setup();
            const ticket = await createTicket(organization, admin, user);

            admin.permissions = null;
            await admin.save();

            const error = await captureError(testServer.test(redeemEndpoint, redeemRequest(organization, ticket)));
            expect(error.code).toBe('permission_denied');
        });

        test('a made up ticket is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const error = await captureError(testServer.test(redeemEndpoint, redeemRequest(organization, 'not-a-real-ticket')));
            expect(error.code).toBe('invalid_impersonation_ticket');
        });
    });

    describe('the resulting session', () => {
        test('ends as soon as the administrator loses their permissions', async () => {
            const { organization, admin, user } = await setup();
            const session = await impersonate(organization, admin, user);

            admin.permissions = null;
            await admin.save();

            const error = await captureError(testServer.test(userEndpoint, bearer(Request.buildJson('GET', '/v1/user', organization.getApiHost()), (await Token.getByAccessToken(session.accessToken))!)));
            expect(error.code).toBe('invalid_access_token');
        });

        test('cannot be renewed', async () => {
            const { organization, admin, user } = await setup();
            const session = await impersonate(organization, admin, user);

            const error = await captureError(testServer.test(new CreateTokenEndpoint(), Request.buildJson('POST', '/oauth/token', organization.getApiHost(), {
                grant_type: 'refresh_token',
                refresh_token: session.refreshToken,
            })));
            expect(error.code).toBe('invalid_refresh_token');
        });

        test('does not sign the administrator out elsewhere when it expires', async () => {
            const { organization, admin, user } = await setup();
            const ownSession = await SessionService.createSession(admin);
            const session = await impersonate(organization, admin, user);

            const token = (await Token.getByAccessToken(session.accessToken))!;
            token.refreshTokenValidUntil = new Date(Date.now() - 1000);
            await token.save();

            expect(await SessionService.getByRefreshToken(session.refreshToken)).toBeUndefined();

            expect(await UserSession.getByID(token.sessionId)).toBeUndefined();
            expect(await Token.getByAccessToken(ownSession.accessToken)).toBeDefined();
        });

        test('cannot change the password of the account it looks at', async () => {
            const { organization, admin, user } = await setup();
            const session = await impersonate(organization, admin, user);

            const error = await captureError(testServer.test(new PatchUserEndpoint(), patchUserRequest(organization, session, NewUser.patch({
                id: user.id,
                password: 'a-brand-new-password',
            }))));
            expect(error.code).toBe('not_allowed_while_impersonating');

            // The account still belongs to whoever knows the original password.
            expect(await User.login(organization.id, user.email, password)).toBeDefined();
        });

        test('cannot change the email address of the account it looks at', async () => {
            const { organization, admin, user } = await setup();
            const session = await impersonate(organization, admin, user);

            const error = await captureError(testServer.test(new PatchUserEndpoint(), patchUserRequest(organization, session, NewUser.patch({
                id: user.id,
                email: 'somebody-else@example.com',
            }))));
            expect(error.code).toBe('not_allowed_while_impersonating');
        });

        test('attributes what it changes to the administrator, not to the account it looks at', async () => {
            const organization = await new OrganizationFactory({}).create();
            await enableImpersonation(organization);
            const admin = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const colleague = await new UserFactory({ organization, password, firstName: 'Oude', lastName: 'Naam', permissions: Permissions.create({ level: PermissionLevel.Write }) }).create();

            const session = await impersonate(organization, admin, colleague);
            await testServer.test(new PatchUserEndpoint(), patchUserRequest(organization, session, NewUser.patch({
                id: colleague.id,
                firstName: 'Nieuwe',
            })));

            const logs = await AuditLog.select().where('type', AuditLogType.UserEdited).where('objectId', colleague.id).fetch();
            expect(logs.length).toBe(1);
            expect(logs[0].userId).toBe(admin.id);
        });

        test('cannot delete the account', async () => {
            const { organization, admin, user } = await setup();
            const session = await impersonate(organization, admin, user);

            const error = await captureError(testServer.test(new DeleteUserEndpoint(), bearer(Request.buildJson('DELETE', '/v1/user', organization.getApiHost()), (await Token.getByAccessToken(session.accessToken))!)));
            expect(error.code).toBe('not_allowed_while_impersonating');
        });

        test('lives for a fixed time', async () => {
            const { organization, admin, user } = await setup();
            const session = await impersonate(organization, admin, user);

            const token = (await Token.getByAccessToken(session.accessToken))!;
            expect(token.accessTokenValidUntil.getTime()).toBeGreaterThan(Date.now() + IMPERSONATION_SESSION_DURATION - 10_000);
            expect(token.accessTokenValidUntil.getTime()).toBeLessThanOrEqual(Date.now() + IMPERSONATION_SESSION_DURATION);
            expect(token.refreshTokenValidUntil).toEqual(token.accessTokenValidUntil);
        });

        test('is never fresh, so second factors cannot be managed', async () => {
            const { organization, admin, user } = await setup();
            const session = await impersonate(organization, admin, user);

            const token = (await Token.getByAccessToken(session.accessToken))!;
            expect(token.isFresh()).toBe(false);

            const error = await captureError(testServer.test(new GetMFAStatusEndpoint(), bearer(Request.buildJson('GET', '/v1/mfa', organization.getApiHost()), token)));
            expect(error.code).toBe('not_allowed_while_impersonating');
        });

        test('is dropped when the account changes its password', async () => {
            const { organization, admin, user } = await setup();
            const session = await impersonate(organization, admin, user);

            await SessionService.clearFor({ userId: user.id, keepAccessToken: 'some-other-session' });

            expect(await Token.getByAccessToken(session.accessToken)).toBeUndefined();
        });

        test('is dropped when the account changes its second factors, while the administrator stays signed in elsewhere', async () => {
            const { organization, admin, user } = await setup();
            const ownSession = await SessionService.createSession(admin);
            const session = await impersonate(organization, admin, user);

            await SessionService.deleteOtherSessions({ userId: user.id, keepAccessToken: null });

            expect(await Token.getByAccessToken(session.accessToken)).toBeUndefined();
            expect(await Token.getByAccessToken(ownSession.accessToken)).toBeDefined();
        });
    });

    test('an admin gets locked out of an existing impersonation session when losing access rights', async () => {
        TestUtils.setEnvironment('userMode', 'platform');

        const fullOrganization = await new OrganizationFactory({}).create();
        await enableImpersonation(fullOrganization);
        const readOrganization = await new OrganizationFactory({}).create();
        const noAccessOrganization = await new OrganizationFactory({}).create();

        const admin = await new UserFactory({ password }).create();
        admin.permissions = UserPermissions.create({});
        admin.permissions.organizationPermissions.set(fullOrganization.id, Permissions.create({ level: PermissionLevel.Full }));
        admin.permissions.organizationPermissions.set(readOrganization.id, Permissions.create({ level: PermissionLevel.Read }));
        await admin.save();

        const user = await new UserFactory({ password }).create();

        const fullMember = await markSensitive(await new MemberFactory({ user }).create());
        await new RegistrationFactory({ member: fullMember, organization: fullOrganization }).create();

        const session = await impersonate(fullOrganization, admin, user);
        await expect(testServer.test(new GetUserMembersEndpoint(), membersRequest(fullOrganization, session))).toResolve();

        const readMember = await markSensitive(await new MemberFactory({ user, firstName: readMemberFirstName }).create());
        await new RegistrationFactory({ member: readMember, organization: readOrganization }).create();

        const hiddenMember = await markSensitive(await new MemberFactory({ user }).create());
        await new RegistrationFactory({ member: hiddenMember, organization: noAccessOrganization }).create();

        // Existing session stopped working
        await expect(testServer.test(new GetUserMembersEndpoint(), membersRequest(fullOrganization, session))).rejects.toThrow(STExpect.errorWithCode('invalid_access_token'));

        // New sessions no longer possible
        await expect(impersonate(fullOrganization, admin, user)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
    });
});
