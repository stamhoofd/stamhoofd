import { Request } from '@simonbackx/simple-endpoints';
import type { Organization } from '@stamhoofd/models';
import { EmailVerificationCode, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../tests/helpers/TestServer.js';
import { PollEmailVerificationEndpoint } from './PollEmailVerificationEndpoint.js';
import { SignupEndpoint } from './SignupEndpoint.js';
import { VerifyEmailEndpoint } from './VerifyEmailEndpoint.js';

describe('Endpoint.Signup', () => {
    const signupEndpoint = new SignupEndpoint();
    const verifyEndpoint = new VerifyEmailEndpoint();
    const pollEndpoint = new PollEmailVerificationEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    async function signup(organization: Organization, email: string) {
        const response = await testServer.test(signupEndpoint, Request.buildJson('POST', '/sign-up', organization.getApiHost(), {
            email,
            password: 'attacker-password-1234',
        }));
        return response.body.token;
    }

    async function storedCodeFor(token: string) {
        const [code] = await EmailVerificationCode.where({ token }, { limit: 1 });
        expect(code).toBeDefined();
        return code.code;
    }

    async function poll(organization: Organization, token: string) {
        const response = await testServer.test(pollEndpoint, Request.buildJson('POST', '/verify-email/poll', organization.getApiHost(), { token }));
        return response.body.valid;
    }

    function verify(organization: Organization, token: string, code: string) {
        return testServer.test(verifyEndpoint, Request.buildJson('POST', '/verify-email', organization.getApiHost(), { token, code }));
    }

    test('the token returned for an existing account cannot be used to sign in', async () => {
        const organization = await new OrganizationFactory({}).create();
        const victim = await new UserFactory({ organization, password: 'victim-password-1234' }).create();

        const token = await signup(organization, victim.email);

        // Indistinguishable from a new signup, so the existence of the account is not exposed
        expect(await poll(organization, token)).toBe(true);

        // Even with the right code for this token, no session is handed out
        const code = await storedCodeFor(token);
        await expect(verify(organization, token, code)).rejects.toMatchObject({ code: 'invalid_code' });

        expect(await Token.where({ userId: victim.id })).toHaveLength(0);
    });

    test('repeated signups for an existing account reuse the token, like a real code', async () => {
        const organization = await new OrganizationFactory({}).create();
        const existing = await new UserFactory({ organization, password: 'victim-password-1234' }).create();

        const token = await signup(organization, existing.email);
        expect(await signup(organization, existing.email)).toBe(token);
        expect(await EmailVerificationCode.where({ email: existing.email })).toHaveLength(1);
    });

    test('a new user can verify their email with the code for the returned token', async () => {
        const organization = await new OrganizationFactory({}).create();

        const token = await signup(organization, 'new-user@example.com');
        expect(await poll(organization, token)).toBe(true);

        const code = await storedCodeFor(token);
        const response = await verify(organization, token, code);
        expect(response.status).toBe(200);
    });
});
