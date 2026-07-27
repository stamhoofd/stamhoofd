// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { ssoClientId, ssoClientSecret, ssoUserEmail, ssoUserPassword } from '@stamhoofd/cli';
import { Platform, User, UserFactory } from '@stamhoofd/models';
import { LoginMethod, LoginMethodConfig, LoginProviderType, OpenIDClientConfiguration, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';
import { CaddyConfigHelper } from '../setup/helpers/CaddyConfigHelper.js';

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
});

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
