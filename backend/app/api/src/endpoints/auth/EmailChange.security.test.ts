import { DatabaseInstance } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import type { Organization, Token, User } from '@stamhoofd/models';
import { EmailTemplateFactory, EmailVerificationCode, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { EmailTemplateType, NewUser, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../tests/helpers/TestServer.js';
import { SessionService } from '../../services/SessionService.js';
import { PatchUserEndpoint } from './PatchUserEndpoint.js';

/**
 * Tests that the code for an email change can't be guessed to take over the account that owns
 * the new address. Verifying the change merges a placeholder user without account at that
 * address into the requester's account.
 */
describe('Security.EmailChange', () => {
    const password = 'test-password-1234';

    beforeEach(async () => {
        await new EmailTemplateFactory({ type: EmailTemplateType.VerifyEmail, html: '<p>with code: {{confirmEmailCode}} {{confirmEmailUrl}}</p>' }).create();
        await new EmailTemplateFactory({ type: EmailTemplateType.VerifyEmailWithoutCode, html: '<p>link only: {{confirmEmailUrl}}</p>' }).create();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function requestEmailChange(organization: Organization, user: User, session: Token, email: string) {
        const request = Request.patch({
            path: '/user/' + user.id,
            host: organization.getApiHost(),
            headers: { authorization: 'Bearer ' + session.accessToken },
            body: NewUser.patch({ id: user.id, email }),
        });
        return await testServer.test(new PatchUserEndpoint(), request).then(() => null, (e: unknown) => e);
    }

    test('the response doesn\'t contain the verification token', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, password }).create();
        const victim = await new UserFactory({ organization, password }).create();

        const error = await requestEmailChange(organization, user, await SessionService.createSession(user), victim.email);

        expect(error).toMatchObject({ code: 'verify_email_link', meta: undefined });
        const [code] = await EmailVerificationCode.where({ userId: user.id });
        expect(JSON.stringify(error)).not.toContain(code.token);
    });

    test('the email only contains the link, not the code', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, password }).create();

        await requestEmailChange(organization, user, await SessionService.createSession(user), 'link-only@example.com');

        // The email is sent in the background
        const email = await vi.waitFor(async () => {
            const sent = (await EmailMocker.transactional.getSucceededEmails()).filter(e => e.to.includes('link-only@example.com'));
            expect(sent).toHaveLength(1);
            return sent[0];
        }, { timeout: 5000 });
        expect(email.html).toContain('link only: https://');
    });

    describe('nobody changes the address of another user', () => {
        async function expectNoEmailChange(organization: Organization, admin: User, victim: User) {
            const error = await requestEmailChange(organization, victim, await SessionService.createSession(admin), 'attacker@example.com');

            // The endpoint ignores the address when the caller may not change it
            expect(error).toBeNull();
            expect(await EmailVerificationCode.where({ userId: victim.id })).toHaveLength(0);
            await victim.refresh();
            expect(victim.email).not.toBe('attacker@example.com');
        }

        test('a full admin cannot change the email of a user with an account in their organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const parent = await new UserFactory({ organization, password }).create();

            await expectNoEmailChange(organization, admin, parent);
        });

        test('a full admin cannot change the email of an invited administrator who never signed in', async () => {
            // A typo in the invitation is fixed by removing the administrator and inviting again
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const invited = await new UserFactory({ organization, password: null, permissions: Permissions.create({ level: PermissionLevel.Read }) }).create();

            await expectNoEmailChange(organization, admin, invited);
        });

        test('in platform mode an organization admin cannot change the email of a platform-level user with permissions in their organization', async () => {
            // The victim was invited as administrator of this organization (CreateAdmin on an existing user)
            TestUtils.setEnvironment('userMode', 'platform');
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const victim = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Read }) }).create();

            await expectNoEmailChange(organization, admin, victim);
        });

        test('a platform admin cannot change the email of another user either', async () => {
            TestUtils.setEnvironment('userMode', 'platform');
            const organization = await new OrganizationFactory({}).create();
            const platformAdmin = await new UserFactory({ password, globalPermissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const user = await new UserFactory({ organization, password }).create();

            await expectNoEmailChange(organization, platformAdmin, user);
        });

        test('a user can still change their own email', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const error = await requestEmailChange(organization, user, await SessionService.createSession(user), 'new@example.com');

            expect(error).toMatchObject({ code: 'verify_email_link' });
            expect(await EmailVerificationCode.where({ userId: user.id })).toHaveLength(1);
        });
    });

    test('two requests at the same time can\'t mix up the address and the code', async () => {
        // The attacker knows the code and token for their own address (e.g. from logging in to
        // their unverified account) and changes their email to the victim's at the same time.
        const organization = await new OrganizationFactory({}).create();
        const attacker = await new UserFactory({ organization, password }).create();
        const victim = await new UserFactory({ organization, password }).create();
        const own = await EmailVerificationCode.createFor(attacker, attacker.email);
        own.expiresAt = new Date(Date.now() - 60 * 60 * 1000);
        await own.save();

        // Pause the save of the request for the own address, after it loaded the row
        let reached!: () => void;
        let resume!: () => void;
        const reachedPromise = new Promise<void>(resolve => reached = resolve);
        const resumePromise = new Promise<void>(resolve => resume = resolve);
        const original = DatabaseInstance.prototype.update;
        let paused = false;
        vi.spyOn(DatabaseInstance.prototype, 'update').mockImplementation(async function (this: DatabaseInstance, ...args: Parameters<DatabaseInstance['update']>) {
            if (!paused && args[0].startsWith('UPDATE `email_verification_codes`')) {
                paused = true;
                reached();
                await resumePromise;
            }
            return await original.call(this, ...args);
        });

        const ownRequest = EmailVerificationCode.createFor(attacker, attacker.email);
        await reachedPromise;
        const victimRequest = await EmailVerificationCode.createFor(attacker, victim.email);
        resume();
        const ownCode = await ownRequest;

        // The saved row is entirely from one request: never the victim's address with the code
        // that was sent to the attacker's own address
        const stored = await EmailVerificationCode.getByID(ownCode.id);
        const winner = stored!.token === ownCode.token ? ownCode : victimRequest;
        expect({ email: stored!.email, code: stored!.code, token: stored!.token }).toEqual({ email: winner.email, code: winner.code, token: winner.token });
    });
});
