// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { ssoClientId, ssoClientSecret, ssoUserEmail, ssoUserPassword } from '@stamhoofd/cli';
import { MFARecoveryCode, MFATOTP, Platform, Token, User, UserFactory } from '@stamhoofd/models';
import { MFATestHelper } from '@stamhoofd/backend/tests/helpers';
import { LoginMethod, LoginMethodConfig, LoginProviderType, OpenIDClientConfiguration, PermissionLevel, Permissions, UserPermissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { TwoFactorFlow } from '../flows/TwoFactorFlow.js';
import { WorkerData } from '../helpers/index.js';
import { setPlatformRequiresTwoFactor } from '../init/setPlatformRequiresTwoFactor.js';
import { CaddyConfigHelper } from '../setup/helpers/CaddyConfigHelper.js';

const PASSWORD = 'testAbc123456';

/**
 * Logging in on a platform account through the local SSO server (Keycloak) that is started for
 * the whole e2e run (see SsoHelper). The realm holds a single test user, so every test starts
 * from an empty users table.
 */
test.describe('SSO login', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
    });

    test.beforeEach(async () => {
        // Each test decides whether the SSO user already exists, so drop the users of the previous test.
        await WorkerData.resetDatabase();
        await enableSSOForPlatform();
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('creates an account for a user that signs in for the first time', async ({ page, pages }) => {
        await pages.dashboard.goto();
        await signInThroughSSO(page);

        // A platform user without permissions lands in the member portal.
        await expect(page.getByTestId('members-start-view')).toBeVisible({ timeout: 30_000 });

        const user = await User.getForRegister(null, ssoUserEmail);
        expect(user).toBeDefined();
        expect(user!.firstName).toBe('Local');
        expect(user!.lastName).toBe('SSO User');
        expect(user!.verified).toBe(true);

        // The account is SSO-only: no password was set, and the provider is linked.
        expect(user!.hasPasswordBasedAccount()).toBe(false);
        expect(user!.meta?.loginProviderIds.get(LoginProviderType.SSO)).toBeTruthy();
    });

    test('signs in on an existing account and links the SSO provider to it', async ({ page, pages }) => {
        // An admin that was invited but never picked a password: their account is claimed by SSO.
        const existingUser = await new UserFactory({
            email: ssoUserEmail,
            password: null,
            firstName: 'Invited',
            lastName: 'Admin',
            globalPermissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        await pages.dashboard.goto();
        await signInThroughSSO(page);

        // An admin ends up in the organization selection instead of the member portal.
        await expect(page.getByTestId('organization-search-input')).toBeVisible({ timeout: 30_000 });

        const user = await User.getForRegister(null, ssoUserEmail);
        expect(user).toBeDefined();

        // Same account, so the permissions are kept instead of a second account being created.
        expect(user!.id).toBe(existingUser.id);
        expect(user!.permissions?.globalPermissions?.level).toBe(PermissionLevel.Full);
        expect(user!.meta?.loginProviderIds.get(LoginProviderType.SSO)).toBeTruthy();
    });

    /**
     * The identity provider only proves who the user is: that is the first factor.
     *
     * A second factor the user enrolled themselves is still verified. Enrollment, on the
     * other hand, is not forced on an SSO-only account: the provider applies its own
     * policy, and there is no password to work around it with. An account that does have a
     * password is forced, because that password stays a way in that skips the provider.
     */
    test.describe('two-factor authentication', () => {
        test.afterEach(async () => {
            // The platform row survives resetDatabase()
            await setPlatformRequiresTwoFactor(false);
            await setPlatformFeatureFlags([]);
        });

        test('an enrolled second factor still has to be passed', async ({ page, pages }) => {
            const user = await new UserFactory({
                email: ssoUserEmail,
                password: null,
                firstName: 'Local',
                lastName: 'SSO User',
            }).create();
            const { secret } = await MFATestHelper.addConfirmedTOTP(user);

            await pages.dashboard.goto();
            await signInThroughSSO(page);

            // Signing in at the provider is not enough: the account is protected.
            await new TwoFactorFlow({ page }).passTOTPChallenge(secret);

            await expect(page.getByTestId('members-start-view')).toBeVisible({ timeout: 30_000 });
        });

        test('an SSO-only account is not forced to enroll', async ({ page, pages }) => {
            await setPlatformRequiresTwoFactor(true);

            const existingUser = await new UserFactory({
                email: ssoUserEmail,
                password: null,
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            await pages.dashboard.goto();
            await signInThroughSSO(page);

            // Straight into the app: the provider is trusted to apply its own second factor.
            await expect(page.getByTestId('organization-search-input')).toBeVisible({ timeout: 30_000 });
            expect(await MFATOTP.getConfirmedForUser(existingUser.id)).toHaveLength(0);
        });

        test('an account that also has a password is still forced to enroll', async ({ page, pages, browser }) => {
            // An account cannot start out with both: linkLoginProvider refuses to attach a
            // provider to a password account, exactly so nobody can claim one through SSO.
            // The combination is reached the other way around - this account signs in
            // through SSO first, and only then gets a password and admin permissions.
            await pages.dashboard.goto();
            await signInThroughSSO(page);
            await expect(page.getByTestId('members-start-view')).toBeVisible({ timeout: 30_000 });

            const user = await User.getForRegister(null, ssoUserEmail);
            expect(user).toBeDefined();

            user!.password = await User.hash(PASSWORD);
            user!.permissions = UserPermissions.create({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            });
            await user!.save();
            await setPlatformRequiresTwoFactor(true);

            // A clean browser session signs in through SSO again.
            const context = await browser.newContext();
            try {
                const secondPage = await context.newPage();
                await secondPage.goto(WorkerData.urls.dashboard);
                await signInThroughSSO(secondPage);

                // The password stays a way in that skips the provider, so signing in there
                // does not satisfy the requirement: a second factor is set up first.
                await new TwoFactorFlow({ page: secondPage }).completeForcedSetup();
                await expect(secondPage.getByTestId('organization-search-input')).toBeVisible({ timeout: 30_000 });
            } finally {
                await context.close();
            }

            expect(await MFATOTP.getConfirmedForUser(user!.id)).toHaveLength(1);
            expect(await MFARecoveryCode.getUnusedForUser(user!.id)).toHaveLength(10);
        });

        /**
         * Managing two-factor authentication needs a session that recently authenticated. An
         * SSO-only account has no password to confirm with, so it confirms its identity at the
         * provider instead.
         */
        test('an SSO-only account confirms its identity at the provider', async ({ page, pages }) => {
            await setPlatformFeatureFlags(['mfa']);

            const user = await new UserFactory({
                email: ssoUserEmail,
                password: null,
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            await pages.dashboard.goto();
            await signInThroughSSO(page);
            await expect(page.getByTestId('organization-search-input')).toBeVisible({ timeout: 30_000 });

            // An SSO login hands out a session that never authenticated recently.
            expect((await Token.where({ userId: user.id })).some(t => t.isFresh())).toBe(false);

            await openMFASettings(page);
            await page.getByTestId('add-totp').click();

            const reauthView = page.getByTestId('reauthenticate-view');
            await expect(reauthView).toBeVisible({ timeout: 20_000 });

            // Nothing to type: the account has no password.
            await expect(reauthView.getByTestId('reauth-password')).toBeHidden();
            await reauthView.getByTestId('reauth-sso').click();

            // The provider asks for the password again (prompt=login). It already knows who
            // is signing in, so its re-authentication screen only has the password field.
            await page.locator('#kc-form-login').waitFor({ timeout: 30_000 });
            await expect(page.getByText('Please re-authenticate to continue')).toBeVisible();
            await page.locator('#password').fill(ssoUserPassword);
            await page.locator('#kc-login').click();
            await page.waitForURL(url => url.origin === WorkerData.urls.dashboard, { timeout: 30_000 });

            // The same session is now freshly authenticated, so the setup goes through.
            expect((await Token.where({ userId: user.id })).some(t => t.isFresh())).toBe(true);

            await openMFASettings(page);
            await page.getByTestId('add-totp').click();
            await expect(page.getByTestId('setup-totp-view')).toBeVisible({ timeout: 20_000 });
            await expect(page.getByTestId('reauthenticate-view')).toBeHidden();
        });
    });
});

async function setPlatformFeatureFlags(featureFlags: string[]) {
    const platform = await Platform.getForEditing();
    platform.config.featureFlags = featureFlags;
    await platform.save();
}

/**
 * Open the two-factor settings of the signed in user from the account settings.
 */
async function openMFASettings(page: Page) {
    await page.goto(WorkerData.urls.dashboard + '/platform');
    await page.locator('.account-switcher').click({ timeout: 20_000 });

    const accountView = page.locator('#account-view');
    await expect(accountView).toBeVisible({ timeout: 20_000 });
    await accountView.getByTestId('open-mfa-settings').click();

    await expect(page.getByTestId('mfa-settings-view')).toBeVisible({ timeout: 20_000 });
}

/**
 * Point the platform at the SSO server of the e2e run. Password login stays enabled, so the login
 * view shows both options instead of redirecting to the SSO server automatically.
 */
async function enableSSOForPlatform() {
    const platform = await Platform.getForEditing();

    platform.config.loginMethods = new Map([
        [LoginMethod.Password, LoginMethodConfig.create({})],
        [LoginMethod.SSO, LoginMethodConfig.create({ loginButtonText: 'Inloggen via SSO' })],
    ]);

    // No redirectUri: the backend defaults to the /openid/callback of its own API domain, which is
    // the URI the realm of this worker allows (see CaddyConfigHelper.getSsoRedirectUris).
    platform.serverConfig.ssoConfiguration = OpenIDClientConfiguration.create({
        issuer: CaddyConfigHelper.getSsoIssuer(),
        clientId: ssoClientId,
        clientSecret: ssoClientSecret,
    });

    await platform.save();
}

/**
 * Start the flow from the Stamhoofd login view and sign in on the Keycloak login page. Keycloak
 * posts the result back to the API (response_mode=form_post), which redirects to the dashboard.
 */
async function signInThroughSSO(page: Page) {
    await page.getByTestId(`login-method-button-${LoginProviderType.SSO}`).click();

    // Keycloak's own login form
    await page.locator('#kc-form-login').waitFor();
    await page.locator('#username').fill(ssoUserEmail);
    await page.locator('#password').fill(ssoUserPassword);
    await page.locator('#kc-login').click();

    // Back on the dashboard with the refresh token the callback added to the redirect.
    await page.waitForURL(url => url.origin === WorkerData.urls.dashboard, { timeout: 30_000 });
}
