import { Request } from '@node/endpoints';
import type { Organization } from '@stamhoofd/models';
import { EmailTemplateFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { EmailMocker } from '@stamhoofd/email';
import { EmailTemplateType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../tests/helpers/TestServer.js';
import {
    ForgotPasswordEndpoint,
    forgotPasswordEmailLimiter,
    forgotPasswordIPLimiter,
} from './ForgotPasswordEndpoint.js';
import {
    PollEmailVerificationEndpoint,
    pollEmailVerificationLimiter,
} from './PollEmailVerificationEndpoint.js';
import {
    RetryEmailVerificationEndpoint,
    retryEmailVerificationIPLimiter,
    retryEmailVerificationTokenLimiter,
} from './RetryEmailVerificationEndpoint.js';
import { SignupEndpoint, signupEmailLimiter, signupIPLimiter } from './SignupEndpoint.js';
import { VerifyEmailEndpoint, verifyEmailIPLimiter } from './VerifyEmailEndpoint.js';

const signupEndpoint = new SignupEndpoint();
const forgotPasswordEndpoint = new ForgotPasswordEndpoint();
const verifyEmailEndpoint = new VerifyEmailEndpoint();
const pollEndpoint = new PollEmailVerificationEndpoint();
const retryEndpoint = new RetryEmailVerificationEndpoint();

describe('Auth endpoint rate limits', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');

        // Rate limiters are in-memory singletons, reset them between tests
        signupIPLimiter.reset();
        signupEmailLimiter.reset();
        forgotPasswordIPLimiter.reset();
        forgotPasswordEmailLimiter.reset();
        verifyEmailIPLimiter.reset();
        pollEmailVerificationLimiter.reset();
        retryEmailVerificationIPLimiter.reset();
        retryEmailVerificationTokenLimiter.reset();

        await new EmailTemplateFactory({ type: EmailTemplateType.ForgotPassword }).create();
        await new EmailTemplateFactory({
            type: EmailTemplateType.ForgotPasswordButNoAccount,
        }).create();
    });

    function request(path: string, organization: Organization, body: object, ip = '1.2.3.4') {
        const r = Request.buildJson('POST', path, organization.getApiHost(), body);
        vi.spyOn(r, 'getIP').mockReturnValue(ip);
        return r;
    }

    describe('/sign-up', () => {
        test('signing up again for the same address stops triggering emails', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                password: 'victim-password-1234',
            }).create();

            const signup = (ip?: string) =>
                testServer.test(
                    signupEndpoint,
                    request(
                        '/sign-up',
                        organization,
                        { email: user.email.toUpperCase(), password: 'attacker-password-1234' },
                        ip,
                    ),
                );

            for (let i = 0; i < 3; i++) {
                await signup();
            }

            // Also from another address: the limit follows the mailbox that gets the email
            await expect(signup('5.6.7.8')).rejects.toMatchObject({ code: 'rate_limit' });
        });
    });

    describe('/forgot-password', () => {
        function forgotPassword(organization: Organization, email: string, ip?: string) {
            return testServer.test(
                forgotPasswordEndpoint,
                request('/forgot-password', organization, { email }, ip),
            );
        }

        test('an address can only be mailed a few times', async () => {
            const organization = await new OrganizationFactory({}).create();

            for (let i = 0; i < 3; i++) {
                await forgotPassword(organization, 'nobody@example.com');
            }

            await expect(
                forgotPassword(organization, 'nobody@example.com', '5.6.7.8'),
            ).rejects.toMatchObject({ code: 'rate_limit' });

            expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(3);
        });

        test('one address can only ask for a limited number of addresses', async () => {
            const organization = await new OrganizationFactory({}).create();

            for (let i = 0; i < 10; i++) {
                await forgotPassword(organization, `nobody${i}@example.com`);
            }

            await expect(
                forgotPassword(organization, 'nobody10@example.com'),
            ).rejects.toMatchObject({ code: 'rate_limit' });

            // Another address keeps its own budget
            await forgotPassword(organization, 'nobody10@example.com', '5.6.7.8');
        });
    });

    describe('/verify-email', () => {
        function verifyEmail(organization: Organization, ip?: string) {
            return testServer.test(
                verifyEmailEndpoint,
                request('/verify-email', organization, { token: 'unknown', code: '123456' }, ip),
            );
        }

        test('code attempts from one address are capped across codes', async () => {
            const organization = await new OrganizationFactory({}).create();
            verifyEmailIPLimiter.track('1.2.3.4', 60);

            await expect(verifyEmail(organization)).rejects.toMatchObject({ code: 'rate_limit' });
            await expect(verifyEmail(organization, '5.6.7.8')).rejects.toMatchObject({
                code: 'invalid_code',
            });
        });
    });

    describe('/verify-email/poll', () => {
        function poll(organization: Organization, token: string) {
            return testServer.test(
                pollEndpoint,
                request('/verify-email/poll', organization, { token }),
            );
        }

        test('polling is capped per token, not per address', async () => {
            const organization = await new OrganizationFactory({}).create();
            pollEmailVerificationLimiter.track('polled-token', 120);

            await expect(poll(organization, 'polled-token')).rejects.toMatchObject({
                code: 'rate_limit',
            });

            const response = await poll(organization, 'other-token');
            expect(response.body.valid).toBe(false);
        });
    });

    describe('/verify-email/retry', () => {
        function retry(organization: Organization, token: string, ip?: string) {
            return testServer.test(
                retryEndpoint,
                request('/verify-email/retry', organization, { token }, ip),
            );
        }

        test('a token can only ask for a limited number of resends', async () => {
            const organization = await new OrganizationFactory({}).create();

            for (let i = 0; i < 3; i++) {
                await retry(organization, 'some-token');
            }

            await expect(retry(organization, 'some-token', '5.6.7.8')).rejects.toMatchObject({
                code: 'rate_limit',
            });

            // Another token keeps its own budget
            await retry(organization, 'other-token');
        });
    });
});
