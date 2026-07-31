// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { MFATestHelper } from '@stamhoofd/backend/tests/helpers';
import type { User } from '@stamhoofd/models';
import { MFATOTP, Platform, Token, UserFactory, WebauthnCredential } from '@stamhoofd/models';
import { PermissionLevel, Permissions, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { TwoFactorFlow } from '../flows/TwoFactorFlow.js';
import { installVirtualAuthenticator } from '../helpers/installVirtualAuthenticator.js';
import { WorkerData } from '../helpers/index.js';

/**
 * Managing two-factor authentication is a sensitive action: a session that has been open for
 * a while has to confirm the identity again first, and that confirmation asks for the second
 * factor the account already has.
 *
 * The confirmation is presented in a sheet, which is a popup on a wide screen but a pushed
 * view on a phone-sized screen, and the second factor puts more views on top of it. Both
 * have to end with the whole confirmation closed and the interrupted action retried, so
 * these tests run on both screen sizes.
 *
 * Only platform accounts may use passkeys (see User.canUsePasskeys), so these users have no
 * organization of their own.
 */

const PASSWORD = 'testAbc123456';

function randomEmail(prefix: string) {
    return prefix + '-' + Math.floor(Math.random() * 1_000_000_000) + '@example.com';
}

async function setPlatformFeatureFlags(featureFlags: string[]) {
    const platform = await Platform.getForEditing();
    platform.config.featureFlags = featureFlags;
    await platform.save();
}

/**
 * Sign in by putting a token in local storage (same as api-keys.spec.ts). Leaving
 * `authenticatedAt` null is what a refresh_token rotation produces: a session that is signed
 * in, but did not recently prove who the user is.
 */
async function loginAs({ page, user, authenticatedAt = null }: { page: Page; user: User; authenticatedAt?: Date | null }) {
    const tokenString = await createTokenString(user, authenticatedAt);

    await page.addInitScript(({ tokenString }) => {
        window.localStorage.removeItem('platform');
        window.localStorage.removeItem('user-platform');
        window.localStorage.setItem('token-platform', tokenString);
    }, { tokenString });
}

/**
 * Continue as the same user, but with a session that has to confirm the identity again. Takes
 * effect on the next page load. Registered as an init script of its own, so it also wins over
 * the token that loginAs keeps setting on every load.
 */
async function continueWithStaleSession({ page, user }: { page: Page; user: User }) {
    const tokenString = await createTokenString(user, null);

    await page.addInitScript(({ tokenString }) => {
        window.localStorage.setItem('token-platform', tokenString);
    }, { tokenString });
}

async function createTokenString(user: User, authenticatedAt: Date | null) {
    const token = await Token.createToken(user, authenticatedAt);
    return JSON.stringify(new TokenStruct(token).encode({ version: Version }));
}

/**
 * Open the two-factor settings of the signed in user from the account menu.
 */
async function openTwoFactorSettings(page: Page) {
    await page.goto(WorkerData.urls.dashboard + '/platform');
    await page.locator('.account-switcher').click({ timeout: 30_000 });

    const accountView = page.locator('#account-view');
    await expect(accountView).toBeVisible({ timeout: 20_000 });
    await accountView.getByTestId('open-mfa-settings').click();

    const settingsView = page.getByTestId('mfa-settings-view');
    await expect(settingsView).toBeVisible({ timeout: 20_000 });
    return settingsView;
}

const viewports = [
    { name: 'desktop', use: {} },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];

for (const viewport of viewports) {
    test.describe(`Confirming the identity in the two-factor settings on ${viewport.name} @two-factor-reauth-${viewport.name}`, () => {
        test.use(viewport.use);

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
            TestUtils.setPermanentEnvironment('singleOrganization', undefined);

            // The two-factor settings are behind a feature flag. Set before any page loads,
            // so no cached platform can hide the entry point again.
            await setPlatformFeatureFlags(['mfa']);
        });

        test.afterAll(async () => {
            await setPlatformFeatureFlags([]);
            await WorkerData.resetDatabase();
        });

        test('a passkey confirms the identity and the interrupted action is retried', async ({ page }) => {
            await installVirtualAuthenticator(page);

            const user = await new UserFactory({
                email: randomEmail('mfa-reauth-passkey-' + viewport.name),
                password: PASSWORD,
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            // A freshly authenticated session enrolls the first passkey without confirming
            // anything, which is what the account confirms with further down.
            await loginAs({ page, user, authenticatedAt: new Date() });
            const freshSettingsView = await openTwoFactorSettings(page);
            await freshSettingsView.getByTestId('add-passkey').click();
            await new TwoFactorFlow({ page }).saveRecoveryCodes();
            await expect(freshSettingsView.getByTestId('passkey-item')).toHaveCount(1);

            // The interrupted action is an authenticator app: the passkey that confirms the
            // identity is excluded from a second enrollment, so a new passkey could never be
            // created on the same authenticator anyway.
            await continueWithStaleSession({ page, user });
            const settingsView = await openTwoFactorSettings(page);
            await settingsView.getByTestId('add-totp').click();

            const reauthView = page.getByTestId('reauthenticate-view');
            await expect(reauthView).toBeVisible({ timeout: 20_000 });
            await reauthView.getByTestId('reauth-password').fill(PASSWORD);
            await reauthView.getByTestId('reauth-submit').click();

            const chooseView = page.getByTestId('choose-mfa-method-view');
            await expect(chooseView).toBeVisible({ timeout: 20_000 });
            await chooseView.getByTestId('mfa-choose-passkey').click();

            // The whole confirmation closed itself, instead of leaving the password screen
            // behind the retried action.
            await expect(reauthView).toBeHidden({ timeout: 20_000 });
            await expect(chooseView).toBeHidden();

            // ... and the action that was interrupted ran on its own.
            await new TwoFactorFlow({ page }).confirmTOTPSetup();
            await expect(settingsView.getByTestId('totp-item')).toHaveCount(1, { timeout: 20_000 });
            await expect(page.getByTestId('input-error')).toBeHidden();

            expect(await MFATOTP.getConfirmedForUser(user.id)).toHaveLength(1);
            expect(await WebauthnCredential.getForUser(user.id)).toHaveLength(1);
        });

        test('an authenticator app confirms the identity before a passkey is added', async ({ page }) => {
            await installVirtualAuthenticator(page);

            const user = await new UserFactory({
                email: randomEmail('mfa-reauth-totp-' + viewport.name),
                password: PASSWORD,
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const { secret } = await MFATestHelper.addConfirmedTOTP(user);

            await loginAs({ page, user });
            const settingsView = await openTwoFactorSettings(page);
            await settingsView.getByTestId('add-passkey').click();

            const reauthView = page.getByTestId('reauthenticate-view');
            await expect(reauthView).toBeVisible({ timeout: 20_000 });
            await reauthView.getByTestId('reauth-password').fill(PASSWORD);
            await reauthView.getByTestId('reauth-submit').click();

            await new TwoFactorFlow({ page }).passTOTPChallenge(secret);

            // The confirmation closed itself, and the passkey the confirmation interrupted
            // ended up in the list. No recovery codes: the account already had a factor.
            await expect(reauthView).toBeHidden({ timeout: 20_000 });
            await expect(settingsView.getByTestId('passkey-item')).toHaveCount(1, { timeout: 20_000 });
            await expect(page.getByTestId('input-error')).toBeHidden();

            expect(await WebauthnCredential.getForUser(user.id)).toHaveLength(1);
        });
    });
}
