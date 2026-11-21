import { Request } from '@node/endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { EmailVerificationCode, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../tests/helpers/TestServer.js';
import { CreateTokenEndpoint } from './CreateTokenEndpoint.js';
import { SignupEndpoint } from './SignupEndpoint.js';
import { VerifyEmailEndpoint } from './VerifyEmailEndpoint.js';

/**
 * Signing up with the address of a user without an account (an invited admin, or a parent linked
 * by email) sets the password of the requester on that user, and only the emailed verification
 * code stands between them and the account. Tests that the code can't be guessed by requesting
 * new ones.
 */
describe('Security.Signup', () => {
    const attackerPassword = 'attacker-password-1234';

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    function signup(organization: Organization, email: string) {
        return testServer.test(
            new SignupEndpoint(),
            Request.buildJson('POST', '/sign-up', organization.getApiHost(), {
                email,
                password: attackerPassword,
            }),
        );
    }

    function login(organization: Organization, email: string) {
        return testServer.test(
            new CreateTokenEndpoint(),
            Request.buildJson('POST', '/oauth/token', organization.getApiHost(), {
                grant_type: 'password',
                username: email,
                password: attackerPassword,
            }),
        );
    }

    async function codeFor(user: User) {
        const [code] = await EmailVerificationCode.where({ userId: user.id }, { limit: 1 });
        expect(code).toBeDefined();
        return code;
    }

    /**
     * Guess wrong codes until the current code of this user has no tries left.
     */
    async function exhaustGuesses(organization: Organization, user: User) {
        const { token, code } = await codeFor(user);
        const wrongCodes = Array.from({ length: EmailVerificationCode.MAX_TRIES + 2 }, (_, i) =>
            String(i).padStart(EmailVerificationCode.CODE_LENGTH, '0'),
        ).filter((c) => c !== code && c !== '111111');

        for (const wrongCode of wrongCodes.slice(0, EmailVerificationCode.MAX_TRIES)) {
            await expect(
                testServer.test(
                    new VerifyEmailEndpoint(),
                    Request.buildJson('POST', '/verify-email', organization.getApiHost(), {
                        token,
                        code: wrongCode,
                    }),
                ),
            ).toReject();
        }
    }

    test('signing in again cannot keep handing out new codes to guess', async () => {
        const organization = await new OrganizationFactory({}).create();
        const victim = await new UserFactory({ organization, password: null }).create();

        // Claiming the address sets the attacker's password on the victim, so from here on they
        // can sign in. The account stays unusable until the emailed code verifies the address.
        await signup(organization, victim.email);

        for (let i = 1; i < EmailVerificationCode.MAX_GENERATED_CODES; i++) {
            await exhaustGuesses(organization, victim);

            // Every sign-in with the password they set issues a new code, which resets the tries
            await expect(login(organization, victim.email)).rejects.toMatchObject({
                code: 'verify_email',
            });
            expect((await codeFor(victim)).tries).toBe(0);
        }

        await exhaustGuesses(organization, victim);

        await expect(login(organization, victim.email)).rejects.toMatchObject({
            code: 'too_many_attempts',
        });
        expect((await codeFor(victim)).generatedCount).toBe(
            EmailVerificationCode.MAX_GENERATED_CODES,
        );
        expect(await Token.where({ userId: victim.id })).toHaveLength(0);
    });

    test('signing up again does not hand out a code for a user that now has a password', async () => {
        // The password set by the first sign-up makes this an account, so later sign-ups get a
        // decoy token like any other existing account
        const organization = await new OrganizationFactory({}).create();
        const victim = await new UserFactory({ organization, password: null }).create();

        const first = await signup(organization, victim.email);
        const second = await signup(organization, victim.email);

        expect(second.body.token).not.toBe(first.body.token);
        const [decoy] = await EmailVerificationCode.where(
            { token: second.body.token },
            { limit: 1 },
        );
        expect(decoy.userId).toBeNull();
    });
});
