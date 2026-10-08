import { Request } from '@simonbackx/simple-endpoints';
import { AuditLog, EmailVerificationCode, Member, MemberFactory, OrganizationFactory, Token, User, UserFactory } from '@stamhoofd/models';
import type { Organization } from '@stamhoofd/models';
import { AuditLogType, LoginProviderType, PermissionLevel, PermissionRole, Permissions, Token as TokenStruct, UserMeta } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../tests/helpers/TestServer.js';
import { SessionService } from '../../services/SessionService.js';
import { VerifyEmailEndpoint } from './VerifyEmailEndpoint.js';

describe('Endpoint.VerifyEmail', () => {
    const endpoint = new VerifyEmailEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    /**
     * Create a user with permissions for the given organization.
     */
    async function createUserWithPermissions(organization: Organization, email: string, permissions?: Permissions) {
        return await new UserFactory({
            organization,
            email,
            permissions,
        }).create();
    }

    /**
     * A user that was created for an email address (e.g. of a parent) but never signed in.
     */
    async function createPlaceholderUser(organization: Organization, email: string) {
        return await new UserFactory({
            organization,
            email,
            password: null,
        }).create();
    }

    /**
     * Build a verification code for the given user that will change the user's email to `newEmail`
     * on verification, and run the endpoint with it from a session of that user (changing your own
     * address while signed in), or without a session.
     */
    async function verifyEmail(organization: Organization, user: User, newEmail: string, { signedIn = true }: { signedIn?: boolean } = {}) {
        const code = await EmailVerificationCode.createFor(user, newEmail);

        const request = Request.buildJson('POST', '/verify-email', organization.getApiHost(), {
            token: code.token,
            code: code.code,
        });

        if (signedIn) {
            const session = await SessionService.createSession(user);
            request.headers.authorization = 'Bearer ' + session.accessToken;
        }

        return await testServer.test(endpoint, request);
    }

    test('an existing account at the new address is never merged: the change is refused', async () => {
        // The owner of that mailbox may be the one clicking a link someone else requested
        const organization = await new OrganizationFactory({}).create();
        const requester = await createUserWithPermissions(organization, 'requester@example.com');
        const victim = await createUserWithPermissions(organization, 'victim@example.com', Permissions.create({
            level: PermissionLevel.Full,
            roles: [PermissionRole.create({ id: 'role-b', name: 'Role B' })],
        }));
        const member = await new MemberFactory({ organization, user: victim }).create();

        await expect(verifyEmail(organization, requester, victim.email)).rejects.toMatchObject({ code: 'email_in_use' });

        const refreshedVictim = await User.getByID(victim.id);
        expect(refreshedVictim).toBeDefined();
        expect(refreshedVictim!.permissions!.organizationPermissions.get(organization.id)?.level).toBe(PermissionLevel.Full);
        expect((await Member.getMembersWithRegistrationForUser(refreshedVictim!)).map(m => m.id)).toEqual([member.id]);

        const refreshedRequester = await User.getByID(requester.id);
        expect(refreshedRequester!.email).toBe('requester@example.com');
        expect(refreshedRequester!.permissions).toBeNull();
        expect(await Member.getMembersWithRegistrationForUser(refreshedRequester!)).toHaveLength(0);
    });

    test('an account that only signs in through a login provider is not merged either', async () => {
        const organization = await new OrganizationFactory({}).create();
        const requester = await createUserWithPermissions(organization, 'requester@example.com');
        const victim = await createPlaceholderUser(organization, 'victim@example.com');
        victim.meta = victim.meta ?? UserMeta.create({});
        victim.meta.loginProviderIds = new Map([[LoginProviderType.SSO, 'subject-1']]);
        await victim.save();
        expect(victim.hasAccount()).toBe(true);

        await expect(verifyEmail(organization, requester, victim.email)).rejects.toMatchObject({ code: 'email_in_use' });
        expect(await User.getByID(victim.id)).toBeDefined();
    });

    test('a placeholder user at the new address is merged into the kept user', async () => {
        const organization = await new OrganizationFactory({}).create();
        const keptUser = await createUserWithPermissions(organization, 'kept@example.com', Permissions.create({
            roles: [PermissionRole.create({ id: 'role-a', name: 'Role A' })],
        }));
        const placeholder = await createPlaceholderUser(organization, 'parent@example.com');
        const member = await new MemberFactory({ organization, user: placeholder }).create();

        const response = await verifyEmail(organization, keptUser, placeholder.email);
        expect(response.status).toBe(200);

        expect(await User.getByID(placeholder.id)).toBeUndefined();

        const refreshed = await User.getByID(keptUser.id);
        expect(refreshed!.email).toBe('parent@example.com');
        expect(refreshed!.permissions!.organizationPermissions.get(organization.id)?.roles.map(r => r.id)).toEqual(['role-a']);
        expect((await Member.getMembersWithRegistrationForUser(refreshed!)).map(m => m.id)).toEqual([member.id]);
    });

    test('reassigns audit logs of the deleted placeholder user to the kept user', async () => {
        const organization = await new OrganizationFactory({}).create();

        const keptUser = await createUserWithPermissions(organization, 'kept@example.com');
        const otherUser = await createPlaceholderUser(organization, 'other@example.com');

        // An audit log performed by the user that will be deleted
        const auditLog = new AuditLog();
        auditLog.type = AuditLogType.Unknown;
        auditLog.userId = otherUser.id;
        auditLog.organizationId = organization.id;
        auditLog.description = 'Performed by the other user';
        await auditLog.save();

        const response = await verifyEmail(organization, keptUser, otherUser.email);
        expect(response.status).toBe(200);

        expect(await User.getByID(otherUser.id)).toBeUndefined();

        // The audit log is now attributed to the kept user
        const refreshedLog = await AuditLog.getByID(auditLog.id);
        expect(refreshedLog).toBeDefined();
        expect(refreshedLog!.userId).toBe(keptUser.id);
    });

    test('verifies the email and returns a valid token when merging a placeholder user', async () => {
        const organization = await new OrganizationFactory({}).create();

        const keptUser = await createUserWithPermissions(organization, 'kept@example.com', Permissions.create({
            roles: [PermissionRole.create({ id: 'role-a', name: 'Role A' })],
        }));
        const otherUser = await createPlaceholderUser(organization, 'other@example.com');

        const response = await verifyEmail(organization, keptUser, otherUser.email);

        expect(response.body).toBeInstanceOf(TokenStruct);
        if (!(response.body instanceof TokenStruct)) {
            throw new Error('Expected TokenStruct');
        }

        // The returned token belongs to the kept user
        const token = await Token.getByAccessToken(response.body.accessToken);
        expect(token).toBeDefined();
        expect(token!.user.id).toBe(keptUser.id);

        const refreshed = await User.getByID(keptUser.id);
        expect(refreshed!.verified).toBe(true);
        expect(refreshed!.email).toBe('other@example.com');
    });

    test('verifying the current address without a session returns a token', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, verified: false }).create();

        const response = await verifyEmail(organization, user, user.email, { signedIn: false });

        expect(response.body).toBeInstanceOf(TokenStruct);
        const token = await Token.getByAccessToken((response.body as TokenStruct).accessToken);
        expect(token!.user.id).toBe(user.id);
        expect((await User.getByID(user.id))!.verified).toBe(true);
    });

    test('an email change confirmed without a session returns a token', async () => {
        // Opening the link on another device than the one the change was requested from
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, email: 'owner@example.com' }).create();

        const response = await verifyEmail(organization, user, 'new@example.com', { signedIn: false });

        expect(response.body).toBeInstanceOf(TokenStruct);
        expect((await Token.getByAccessToken((response.body as TokenStruct).accessToken))!.user.id).toBe(user.id);
        expect((await User.getByID(user.id))!.email).toBe('new@example.com');
    });

    test('parallel wrong guesses cannot exceed the maximum number of tries', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const code = await EmailVerificationCode.createFor(user, user.email);

        // Avoid the real code and the '111111' test bypass
        const wrongCode = ['000000', '000001', '000002'].find(c => c !== code.code)!;

        const guess = (c: string) => testServer.test(endpoint, Request.buildJson('POST', '/verify-email', organization.getApiHost(), {
            token: code.token,
            code: c,
        }));

        const results = await Promise.allSettled(
            Array.from({ length: EmailVerificationCode.MAX_TRIES * 2 }, () => guess(wrongCode)),
        );
        expect(results.every(r => r.status === 'rejected')).toBe(true);

        const stored = await EmailVerificationCode.getByID(code.id);
        expect(stored!.tries).toBe(EmailVerificationCode.MAX_TRIES);

        await expect(guess(code.code)).rejects.toMatchObject({ code: 'too_many_attempts' });
    });
});
