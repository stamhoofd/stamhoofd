import { DecodedRequest, Request } from '@node/endpoints';
import { OrganizationFactory, Platform, Token, User, UserFactory } from '@stamhoofd/models';
import { LoginMethod, LoginMethodConfig, LoginProviderType, OpenIDClientConfiguration, Permissions, SessionClientType, UserMeta } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { ContextInstance } from '../helpers/Context.js';
import { SSOService, SSOServiceWithSession } from './SSOService.js';

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
        return new SSOService({ provider: LoginProviderType.SSO, organization, platform: await Platform.getForEditing() });
    }

    /**
     * Simulates returning from this organization's provider after a successful OIDC
     * login. The supplied user is the identity the provider claims, not an already
     * authenticated application user.
     *
     * Only the OIDC client is mocked: no provider is contacted and signature checks
     * are assumed to have succeeded. The pending session, cookie and request context
     * drive the real SSO callback, including database lookup, account updates and
     * token issuance. Returns its redirect URL for success/error assertions.
     */
    async function callback(service: SSOService, user: User) {
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
        // The OIDC client has already verified the signature, audience and nonce. The
        // organization controls this issuer, including the email and subject it asserts.
        vi.spyOn(service, 'getClient').mockResolvedValue({
            callback: vi.fn().mockResolvedValue({
                claims: () => ({
                    iss: service.configuration.issuer,
                    sub: 'matching-subject',
                    name: 'Claimed Identity',
                    email: user.email,
                    email_verified: true,
                }),
            }),
        } as any);

        const request = new Request({ method: 'POST', url: '/openid/callback', host: '', headers: { cookie: 'oid_session_id=test-session' } });
        const decoded = await DecodedRequest.fromRequest(request, {}, undefined, undefined);
        const context = new ContextInstance(request);
        const response = await ContextInstance.asyncLocalStorage.run(context, () => new SSOServiceWithSession(session, service, decoded).callback());
        return new URL(response.headers.location as string);
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
    it.each(['invited', 'linked'])('does not authenticate a global %s account through an organization issuer', async (kind) => {
        const service = await createService();
        const user = await new UserFactory({
            password: null,
            verified: false,
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        if (kind === 'linked') {
            user.meta = UserMeta.create({ loginProviderIds: new Map([[LoginProviderType.SSO, 'matching-subject']]) });
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
    });

    /**
     * Positive control: the same callback may activate an invitation owned by its
     * organization. Requiring both a handoff token and a persisted token prevents
     * a blanket callback rejection from making the scope regressions pass.
     */
    it('authenticates an invited account owned by the organization', async () => {
        const service = await createService();
        const user = await new UserFactory({ organization: service.organization!, password: null, verified: false }).create();

        const redirect = await callback(service, user);

        expect(redirect.searchParams.has('error')).toBe(false);
        expect(redirect.searchParams.has('oid_rt')).toBe(true);
        expect(await Token.where({ userId: user.id })).toHaveLength(1);
        expect((await User.getByID(user.id))?.verified).toBe(true);
    });
});
