import { DecodedRequest, Request } from '@node/endpoints';
import { OrganizationFactory, Platform, Token, User, UserFactory } from '@stamhoofd/models';
import {
    LoginMethod,
    LoginMethodConfig,
    LoginProviderType,
    OpenIDClientConfiguration,
    Permissions,
    SessionClientType,
    UserMeta,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { ContextInstance } from '../helpers/Context.js';
import { SSOService, SSOServiceWithSession } from './SSOService.js';

/**
 * Simulates returning from a provider after a successful OIDC login. The supplied user is
 * the identity the provider claims, not an already authenticated application user, and
 * `claims` overrides what it asserts about that identity.
 *
 * Only the OIDC client is mocked: no provider is contacted and signature checks are
 * assumed to have succeeded. The pending session, cookie and request context drive the
 * real SSO callback, including database lookup, account updates and token issuance.
 * Returns its redirect URL for success/error assertions.
 */
async function callback(service: SSOService, user: User, claims: Record<string, unknown> = {}) {
    const session = {
        expires: new Date(Date.now() + 60_000),
        code_verifier: 'test-verifier',
        state: 'test-state',
        nonce: 'test-nonce',
        redirectUri: 'https://organization.example',
        spaState: 'test-client-state',
        providerType: LoginProviderType.SSO,
        organizationId: service.organization?.id,
        clientType: SessionClientType.Browser,
    };
    SSOService.sessionStorage.set('test-session', session);
    // The OIDC client has already verified the signature, audience and nonce. Whoever
    // controls the issuer controls the claims it asserts, including the email and subject.
    vi.spyOn(service, 'getClient').mockResolvedValue({
        callback: vi.fn().mockResolvedValue({
            claims: () => ({
                iss: service.configuration.issuer,
                sub: 'matching-subject',
                name: 'Claimed Identity',
                email: user.email,
                email_verified: true,
                ...claims,
            }),
        }),
    } as any);

    const request = new Request({
        method: 'POST',
        url: '/openid/callback',
        host: '',
        headers: { cookie: 'oid_session_id=test-session' },
    });
    const decoded = await DecodedRequest.fromRequest(request, {}, undefined, undefined);
    const context = new ContextInstance(request);
    const response = await ContextInstance.asyncLocalStorage.run(context, () =>
        new SSOServiceWithSession(session, service, decoded).callback(),
    );
    return new URL(response.headers.location as string);
}

/**
 * Exercises account authorization after OIDC verification: an organization issuer
 * may authenticate its own users, but its claims must not select a global account.
 */
describe('SSO callback account scope', () => {
    beforeEach(() => {
        // Organization mode still has global accounts; the lookup's global fallback
        // is what these regressions must exercise.
        TestUtils.setEnvironment('userMode', 'organization');
    });

    afterEach(() => {
        SSOService.sessionStorage.clear();
        vi.restoreAllMocks();
    });

    /** Creates an organization-scoped SSO service with its own enabled provider. */
    async function createService() {
        const organization = await new OrganizationFactory({}).create();
        organization.serverMeta.ssoConfiguration = OpenIDClientConfiguration.create({
            issuer: 'https://organization-idp.example',
            clientId: 'organization-client',
            clientSecret: 'organization-secret',
        });
        organization.meta.loginMethods.set(LoginMethod.SSO, LoginMethodConfig.create({}));
        return new SSOService({
            provider: LoginProviderType.SSO,
            organization,
            platform: await Platform.getForEditing(),
        });
    }

    /**
     * Neither an invitation with no linked identity nor an account with a matching
     * SSO subject may be authenticated through another organization's provider.
     * Both fixtures deliberately remain unverified and passwordless; the
     * linked case adds only the stored subject. Global permissions make the factory
     * create a global administrator rather than an organization-owned user.
     *
     * The organization provider asserts that account's verified email and matching
     * subject. Even valid claims must fail across scopes, without issuing a token
     * or changing the global account's verification, profile or identity links.
     */
    it.each(['invited', 'linked'])(
        'does not authenticate a global %s account through an organization issuer',
        async (kind) => {
            const service = await createService();
            const user = await new UserFactory({
                password: null,
                verified: false,
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            if (kind === 'linked') {
                user.meta = UserMeta.create({
                    loginProviderIds: new Map([[LoginProviderType.SSO, 'matching-subject']]),
                });
                await user.save();
            }
            const before = await User.getByID(user.id);

            const redirect = await callback(service, user);

            expect(redirect.searchParams.has('oid_rt')).toBe(false);
            expect(redirect.searchParams.has('error')).toBe(true);
            expect(await Token.where({ userId: user.id })).toHaveLength(0);
            const after = await User.getByID(user.id);
            expect(after?.verified).toBe(before?.verified);
            expect(after?.firstName).toBe(before?.firstName);
            expect(after?.meta).toEqual(before?.meta);
        },
    );

    /**
     * Positive control: the same callback may activate an invitation owned by its
     * organization. Requiring both a handoff token and a persisted token prevents
     * a blanket callback rejection from making the scope regressions pass.
     */
    it('authenticates an invited account owned by the organization', async () => {
        const service = await createService();
        const user = await new UserFactory({
            organization: service.organization!,
            password: null,
            verified: false,
        }).create();

        const redirect = await callback(service, user);

        expect(redirect.searchParams.has('error')).toBe(false);
        expect(redirect.searchParams.has('oid_rt')).toBe(true);
        expect(await Token.where({ userId: user.id })).toHaveLength(1);
        expect((await User.getByID(user.id))?.verified).toBe(true);
    });
});

/**
 * Exercises what the callback does with the provider's email verification claim. An
 * account that was never activated has no credential of its own, so the only thing tying
 * it to the person returning from the provider is the asserted address. A provider that
 * states it never verified that address hands out these accounts — placeholder users
 * created for a member's contact email, or an administrator invitation that was never
 * accepted — to whoever registered it there.
 */
describe('SSO callback email verification', () => {
    beforeEach(() => {
        // Organization-level SSO isn't used for login in platform mode, so the platform
        // identity provider is the one that authenticates these accounts.
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(() => {
        SSOService.sessionStorage.clear();
        vi.restoreAllMocks();
    });

    /** Creates a platform-scoped SSO service with the platform provider enabled. */
    async function createService() {
        const platform = await Platform.getForEditing();
        platform.serverConfig.ssoConfiguration = OpenIDClientConfiguration.create({
            issuer: 'https://platform-idp.example',
            clientId: 'platform-client',
            clientSecret: 'platform-secret',
        });
        platform.config.loginMethods.set(LoginMethod.SSO, LoginMethodConfig.create({}));
        return new SSOService({ provider: LoginProviderType.SSO, platform });
    }

    /**
     * An account that exists for its email address only: no password, no linked identity
     * and not verified.
     */
    async function createPlaceholderAccount() {
        return await new UserFactory({ password: null, verified: false }).create();
    }

    /**
     * The provider asserts the address but states it is unverified. The callback must not
     * hand over the account: no token, and no link, verification or profile written to it
     * that would make a later attempt succeed.
     */
    it('does not authenticate a placeholder account on an unverified email claim', async () => {
        const service = await createService();
        const user = await createPlaceholderAccount();
        const before = await User.getByID(user.id);

        const redirect = await callback(service, user, { email_verified: false });

        expect(redirect.searchParams.has('oid_rt')).toBe(false);
        expect(redirect.searchParams.has('error')).toBe(true);
        expect(await Token.where({ userId: user.id })).toHaveLength(0);
        const after = await User.getByID(user.id);
        expect(after?.verified).toBe(before?.verified);
        expect(after?.firstName).toBe(before?.firstName);
        expect(after?.meta).toEqual(before?.meta);
    });

    /**
     * A provider that states the address is verified activates the account, and so does
     * one that omits the claim: leaving it out says nothing about the address, and
     * rejecting those logins would lock out every provider that doesn't send it.
     *
     * Requiring both a handoff token and a persisted token also keeps a blanket callback
     * rejection from making the regression above pass.
     */
    it.each([
        ['a verified', true],
        ['no', undefined],
    ])('authenticates a placeholder account on %s email claim', async (_, emailVerified) => {
        const service = await createService();
        const user = await createPlaceholderAccount();

        const redirect = await callback(service, user, { email_verified: emailVerified });

        expect(redirect.searchParams.has('error')).toBe(false);
        expect(redirect.searchParams.has('oid_rt')).toBe(true);
        expect(await Token.where({ userId: user.id })).toHaveLength(1);
        expect((await User.getByID(user.id))?.verified).toBe(true);
    });
});
