// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Browser, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { I18n } from '@stamhoofd/backend-i18n';
import type { User } from '@stamhoofd/models';
import { MFARecoveryCode, MFATOTP, Organization, OrganizationFactory, PasswordToken, Platform, UserFactory } from '@stamhoofd/models';
import { PasswordForgotService } from '@stamhoofd/backend/services/PasswordForgotService';
import { MFATestHelper } from '@stamhoofd/backend/tests/helpers';
import { appToUri, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { TwoFactorFlow } from '../flows/TwoFactorFlow.js';
import { WorkerData } from '../helpers/index.js';

/**
 * The two-factor flows on a phone-sized screen.
 *
 * The views are pushed onto the login navigation stack rather than presented in a sheet,
 * and a phone renders that stack differently (full screen views, a bottom tab bar). These
 * tests check that the user really ends up inside the app afterwards - not just that the
 * url changed - by looking at the tab bar that only exists once the app itself is showing.
 */

const PASSWORD = 'testAbc123456';
const NEW_PASSWORD = 'mobileAbc789012';

// nl-BE, matching the locale used everywhere else in the tests
const i18n = new I18n(I18n.defaultLanguage, I18n.defaultCountry);

function randomEmail(prefix: string) {
    return prefix + '-' + Math.floor(Math.random() * 1_000_000_000) + '@example.com';
}

/**
 * The app is really showing when its tab bar is there: a tab bar only exists inside the
 * TabBarController that the dashboard root mounts. Also asserts that exactly one tab is
 * marked as selected and that its content rendered, and that no error is on screen.
 */
async function expectSignedInDashboard(page: Page) {
    const tabs = page.getByTestId('tab-button');
    await expect(tabs.first()).toBeVisible({ timeout: 30_000 });

    // One tab is selected, and it is a real tab (not the overflow 'more' group).
    const selectedTabs = page.locator('[data-testid="tab-button"].selected');
    await expect(selectedTabs).toHaveCount(1);
    await expect(selectedTabs.first()).toBeVisible();

    // The selected tab actually rendered its view instead of an empty shell.
    await expect(page.locator('.tab-bar-controller > .main')).toBeVisible();
    await expect(page.locator('.st-view').first()).toBeVisible();

    // Nothing blew up on the way in.
    await expect(page.getByTestId('input-error')).toBeHidden();
    await expect(page.locator('.toast.error')).toBeHidden();

    // And the login stack is gone for good.
    await expect(page.getByTestId('login-view')).toBeHidden();
    await expect(page.getByTestId('choose-mfa-method-view')).toBeHidden();
    await expect(page.getByTestId('setup-mfa-view')).toBeHidden();
}

/**
 * Fill in the dashboard login form. Stops right after submitting, so the caller decides
 * what the second factor step should look like.
 */
async function submitLogin(page: Page, { organization, email, password }: { organization: Organization; email: string; password: string }) {
    await page.goto(WorkerData.urls.dashboard + '/' + appToUri('dashboard') + '/' + organization.uri);

    const emailInput = page.getByTestId('email-input');
    await expect(emailInput).toBeVisible({ timeout: 30_000 });
    await emailInput.click();
    await emailInput.fill(email);
    await expect(emailInput).toHaveValue(email);

    const passwordInput = page.getByTestId('password-input');
    await passwordInput.click();
    await passwordInput.fill(password);
    await expect(passwordInput).toHaveValue(password);

    await page.getByTestId('login-button').click();
}

/**
 * Open the two-factor settings of the signed in user from the account menu.
 */
async function openTwoFactorSettings(page: Page) {
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
    test.describe(`Two-factor authentication on ${viewport.name} @two-factor-${viewport.name}`, () => {
        test.use(viewport.use);

        let organization: Organization;
        let admin: User;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
            TestUtils.setPermanentEnvironment('singleOrganization', undefined);

            // The entry point in the account settings is behind a feature flag. Set before
            // any page loads, so no cached platform can hide it again.
            await setPlatformFeatureFlags(['mfa']);

            organization = await new OrganizationFactory({}).create();
            admin = await new UserFactory({
                organization,
                email: randomEmail('mfa-' + viewport.name + '-admin'),
                password: PASSWORD,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
        });

        test.afterAll(async () => {
            await setPlatformFeatureFlags([]);
            await WorkerData.resetDatabase();
        });

        test('signing in with an authenticator app lands in the app', async ({ page }) => {
            const user = await new UserFactory({
                organization,
                email: randomEmail('mfa-' + viewport.name + '-login'),
                password: PASSWORD,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const { secret } = await MFATestHelper.addConfirmedTOTP(user);

            await submitLogin(page, { organization, email: user.email, password: PASSWORD });

            await new TwoFactorFlow({ page }).passTOTPChallenge(secret);

            await expectSignedInDashboard(page);
        });

        test('enrolling during a forced setup lands in the app', async ({ page }) => {
            await withTwoFactorRequired(organization, async () => {
                const user = await new UserFactory({
                    organization,
                    email: randomEmail('mfa-' + viewport.name + '-setup'),
                    password: PASSWORD,
                    permissions: Permissions.create({ level: PermissionLevel.Full }),
                }).create();

                await submitLogin(page, { organization, email: user.email, password: PASSWORD });

                const { recoveryCodes } = await new TwoFactorFlow({ page }).completeForcedSetup();
                expect(recoveryCodes).toHaveLength(10);

                await expectSignedInDashboard(page);

                expect(await MFATOTP.getConfirmedForUser(user.id)).toHaveLength(1);
                expect(await MFARecoveryCode.getUnusedForUser(user.id)).toHaveLength(10);
            });
        });

        test('an invited admin enrolls after choosing a password', async ({ browser }) => {
            await withTwoFactorRequired(organization, async () => {
                const invited = await new UserFactory({
                    organization,
                    email: randomEmail('mfa-' + viewport.name + '-invite'),
                    password: null,
                    firstName: 'Uitgenodigde',
                    lastName: 'Beheerder',
                    permissions: Permissions.create({ level: PermissionLevel.Full }),
                }).create();

                await openInviteAndEnroll(browser, { user: invited, organization, use: viewport.use });

                expect(await MFATOTP.getConfirmedForUser(invited.id)).toHaveLength(1);
                expect(await MFARecoveryCode.getUnusedForUser(invited.id)).toHaveLength(10);
            });
        });

        test('adding an authenticator app returns to the two-factor settings', async ({ page }) => {
            await submitLogin(page, { organization, email: admin.email, password: PASSWORD });
            await expectSignedInDashboard(page);

            const settingsView = await openTwoFactorSettings(page);
            await expect(settingsView.getByTestId('totp-item')).toHaveCount(0);

            await settingsView.getByTestId('add-totp').click();

            const flow = new TwoFactorFlow({ page });
            const secret = await flow.confirmTOTPSetup();
            await flow.saveRecoveryCodes();

            // The setup sheet closed itself and we are looking at the settings again, with
            // the new authenticator in the list.
            await expect(page.getByTestId('setup-totp-view')).toBeHidden({ timeout: 20_000 });
            await expect(settingsView).toBeVisible();
            await expect(settingsView.getByTestId('totp-item')).toHaveCount(1);
            await expect(page.getByTestId('input-error')).toBeHidden();

            expect(secret).not.toBe('');
            expect(await MFATOTP.getConfirmedForUser(admin.id)).toHaveLength(1);
        });
    });
}

/**
 * Open the invite link of a user in a clean browser session, choose a password and enroll
 * the required second factor.
 */
async function openInviteAndEnroll(browser: Browser, { user, organization, use }: { user: User; organization: Organization; use: Record<string, unknown> }) {
    // The same link an invite email carries.
    const passwordToken = await PasswordToken.createToken(user);
    const url = await PasswordForgotService.getPasswordRecoveryUrlForToken(passwordToken, organization, i18n);

    const context = await browser.newContext(use);
    try {
        const page = await context.newPage();
        await page.goto(url);

        const form = page.locator('form.forgot-password-reset-view');
        await expect(form).toBeVisible({ timeout: 30_000 });

        const passwordInputs = form.locator('input[autocomplete="new-password"]');
        await passwordInputs.nth(0).fill(NEW_PASSWORD);
        await passwordInputs.nth(1).fill(NEW_PASSWORD);

        const policies = form.getByTestId('checkbox');
        const count = await policies.count();
        for (let i = 0; i < count; i++) {
            await policies.nth(i).check();
        }

        await form.locator('#submit').click();

        // Only now, with a password chosen, the second factor is set up.
        await new TwoFactorFlow({ page }).completeForcedSetup();

        // The enrollment sheet closed itself and the app is really showing.
        await expect(form).toBeHidden({ timeout: 20_000 });
        await expect(page.getByTestId('setup-mfa-view')).toBeHidden();
        await expectSignedInDashboard(page);
    } finally {
        await context.close();
    }
}

async function withTwoFactorRequired(organization: Organization, run: () => Promise<void>) {
    const editable = await Organization.getByID(organization.id);
    editable!.privateMeta.requireTwoFactor = true;
    await editable!.save();

    try {
        await run();
    } finally {
        editable!.privateMeta.requireTwoFactor = false;
        await editable!.save();
    }
}

async function setPlatformFeatureFlags(featureFlags: string[]) {
    const platform = await Platform.getForEditing();
    platform.config.featureFlags = featureFlags;
    await platform.save();
}
