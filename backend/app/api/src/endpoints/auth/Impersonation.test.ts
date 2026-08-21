import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import type { Organization } from '@stamhoofd/models';
import { AuditLog, ImpersonationToken, MemberFactory, OrganizationFactory, Platform, RegistrationFactory, Token, User, UserFactory, UserSession } from '@stamhoofd/models';
import { AuditLogType, BooleanStatus, MemberDetails, MemberWithRegistrationsBlob, NewUser, PermissionLevel, Permissions, Token as TokenStruct, UserPermissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../tests/helpers/TestServer.js';
import '../../audit-logs/init.js';
import { AuditLogService } from '../../services/AuditLogService.js';
import { IMPERSONATION_SESSION_DURATION, SessionService } from '../../services/SessionService.js';
import { GetUserMembersEndpoint } from '../global/registration/GetUserMembersEndpoint.js';
import { PatchUserMembersEndpoint } from '../global/registration/PatchUserMembersEndpoint.js';
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
    }
    catch (e) {
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

        test('only sees the members the administrator may see as well', async () => {
            TestUtils.setEnvironment('userMode', 'platform');

            const organization = await new OrganizationFactory({}).create();
            await enableImpersonation(organization);
            const other = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const user = await new UserFactory({ password }).create();

            // Two children of the same parent, in two different organizations. The
            // administrator only runs one of them.
            const own = await new MemberFactory({ user }).create();
            await new RegistrationFactory({ member: own, organization }).create();

            const elsewhere = await new MemberFactory({ user }).create();
            await new RegistrationFactory({ member: elsewhere, organization: other }).create();

            const session = await impersonate(organization, admin, user);
            const response = await testServer.test(new GetUserMembersEndpoint(), membersRequest(organization, session));

            const ids = response.body.members.map(m => m.id);
            expect(ids).toContain(own.id);
            expect(ids).not.toContain(elsewhere.id);
        });
    });

    /**
     * A parent sees more of their own children than most administrators do. An
     * administrator that steps into such an account may not pick that up along the way:
     * what they get to see stays what they could see themselves.
     */
    describe('member data of the account being looked at', () => {
        const readMemberFirstName = 'Leesbaar';

        async function markSensitive(member: Awaited<ReturnType<MemberFactory['create']>>) {
            member.details.nationalRegisterNumber = '123454123';
            member.details.requiresFinancialSupport = BooleanStatus.create({ value: true });
            await member.save();
            return member;
        }

        /**
         * A platform administrator that runs one organization in full, has plain read access
         * to a second and none at all to a third. The parent they step into has a child in
         * each: the full access is what lets them impersonate, and the other two children are
         * there to check that stepping in never widens what the administrator may read - a
         * member they can only read shows without its national register number or financial
         * data, and a member they cannot read is hidden entirely.
         */
        async function setupPartialAccessAdmin() {
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

            const readMember = await markSensitive(await new MemberFactory({ user, firstName: readMemberFirstName }).create());
            await new RegistrationFactory({ member: readMember, organization: readOrganization }).create();

            const hiddenMember = await markSensitive(await new MemberFactory({ user }).create());
            await new RegistrationFactory({ member: hiddenMember, organization: noAccessOrganization }).create();

            return { fullOrganization, admin, user, fullMember, readMember, hiddenMember };
        }

        test('the members endpoint hides members and fields the administrator may not read', async () => {
            const { fullOrganization, admin, user, fullMember, readMember, hiddenMember } = await setupPartialAccessAdmin();

            const session = await impersonate(fullOrganization, admin, user);
            const response = await testServer.test(new GetUserMembersEndpoint(), membersRequest(fullOrganization, session));

            const ids = response.body.members.map(m => m.id);
            // A member the administrator cannot access is not part of the family the session sees.
            expect(ids).not.toContain(hiddenMember.id);
            // The members the administrator may access are there.
            expect(ids).toContain(fullMember.id);
            expect(ids).toContain(readMember.id);

            // Only read access to the member's organization: the member itself comes through,
            // but the fields that need more than read access do not.
            const read = response.body.members.find(m => m.id === readMember.id)!;
            expect(read.details.firstName).toBe(readMemberFirstName);
            expect(read.details.nationalRegisterNumber).toBeNull();
            expect(read.details.requiresFinancialSupport).toBeNull();
        });

        test('the user endpoint hides members and fields the administrator may not read', async () => {
            const { fullOrganization, admin, user, fullMember, readMember, hiddenMember } = await setupPartialAccessAdmin();

            const session = await impersonate(fullOrganization, admin, user);
            const response = await testServer.test(userEndpoint, bearer(Request.buildJson('GET', '/v1/user', fullOrganization.getApiHost()), (await Token.getByAccessToken(session.accessToken))!));

            const ids = response.body.members.members.map(m => m.id);
            expect(ids).not.toContain(hiddenMember.id);
            expect(ids).toContain(fullMember.id);
            expect(ids).toContain(readMember.id);

            const read = response.body.members.members.find(m => m.id === readMember.id)!;
            expect(read.details.firstName).toBe(readMemberFirstName);
            expect(read.details.nationalRegisterNumber).toBeNull();
            expect(read.details.requiresFinancialSupport).toBeNull();
        });

        test('the members patch endpoint hides members and fields the administrator may not read', async () => {
            const { fullOrganization, admin, user, fullMember, readMember, hiddenMember } = await setupPartialAccessAdmin();

            const session = await impersonate(fullOrganization, admin, user);

            // Even an empty patch returns the family blob, so it has to be narrowed exactly
            // like the reads: the response must never carry a member the administrator cannot
            // access.
            const body = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
            const response = await testServer.test(new PatchUserMembersEndpoint(), Request.patch({
                path: '/members',
                host: fullOrganization.getApiHost(),
                headers: { authorization: 'Bearer ' + session.accessToken },
                body,
            }));

            const ids = response.body.members.map(m => m.id);
            expect(ids).not.toContain(hiddenMember.id);
            expect(ids).toContain(fullMember.id);
            expect(ids).toContain(readMember.id);

            const read = response.body.members.find(m => m.id === readMember.id)!;
            expect(read.details.firstName).toBe(readMemberFirstName);
            expect(read.details.nationalRegisterNumber).toBeNull();
            expect(read.details.requiresFinancialSupport).toBeNull();
        });

        test('changes to the family go to the impersonated account, not to the administrator', async () => {
            const { organization, admin, user, member } = await setup();

            const session = await impersonate(organization, admin, user);

            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({ phone: '+32478123456' }),
            });
            const body = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
            body.addPatch(patch);

            const response = await testServer.test(new PatchUserMembersEndpoint(), Request.patch({
                path: '/members',
                host: organization.getApiHost(),
                headers: { authorization: 'Bearer ' + session.accessToken },
                body,
            }));

            // The member of the impersonated account, not of the administrator's own family
            expect(response.body.members.map(m => m.id)).toEqual([member.id]);

            await member.refresh();
            expect(member.details.phone).toBe('+32478123456');
        });
    });
});
