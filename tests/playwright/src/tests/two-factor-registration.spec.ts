// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { MFARecoveryCode, MFATOTP, Organization, OrganizationFactory, UserFactory, WebauthnCredential } from '@stamhoofd/models';
import { MFATestHelper, STPackageService } from '@stamhoofd/backend/tests/helpers';
import { PermissionLevel, Permissions, STPackageBundle } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { TwoFactorFlow } from '../flows/TwoFactorFlow.js';
import { WorkerData } from '../helpers/index.js';
import { setPlatformRequiresTwoFactor } from '../init/setPlatformRequiresTwoFactor.js';

/**
 * Two-factor authentication in the member portal, which runs on the organization's own
 * registration domain instead of the dashboard domain.
 *
 * That domain matters twice over:
 *  - the login views live in a different app there, so the flow has to be wired up in that
 *    app as well (it was not: the login view simply stayed open).
 *  - passkeys are bound to the dashboard domain, so they cannot be offered here at all.
 */

const PASSWORD = 'testAbc123456';

function randomEmail(prefix: string) {
    return prefix + '-' + Math.floor(Math.random() * 1_000_000_000) + '@example.com';
}

/**
 * Sign in through the member portal login form on the registration domain.
 *
 * In organization mode visitors first land on the members home view, which is where the
 * login form is opened from.
 */
async function submitLogin(page: Page, { url, email }: { url: string; email: string }) {
    await page.goto(url);

    await expect(page.getByTestId('members-home-view')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('open-login-button').click();

    const emailInput = page.getByTestId('email-input');
    await expect(emailInput).toBeVisible({ timeout: 30_000 });
    await emailInput.click();
    await emailInput.fill(email);
    // The password sometimes ends up in the email field, so check before moving on.
    await expect(emailInput).toHaveValue(email);

    const passwordInput = page.getByTestId('password-input');
    await passwordInput.click();
    await passwordInput.fill(PASSWORD);
    await expect(passwordInput).toHaveValue(PASSWORD);

    await page.getByTestId('login-button').click();
}

test.describe('Two-factor authentication on the registration domain @two-factor-registration', () => {
    let organization: Organization;
    let registrationUrl: string;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        TestUtils.setPermanentEnvironment('singleOrganization', undefined);

        organization = await new OrganizationFactory({
            packages: [STPackageBundle.Members],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);
        await organization.refresh();

        registrationUrl = WorkerData.urls.registration(organization.uri) + '/leden';
    });

    test.afterAll(async () => {
        await setPlatformRequiresTwoFactor(false);
        await WorkerData.resetDatabase();
    });

    test('a member with an authenticator app is challenged and signed in', async ({ page }) => {
        const user = await new UserFactory({
            organization,
            email: randomEmail('mfa-registration-member'),
            password: PASSWORD,
        }).create();
        const { secret } = await MFATestHelper.addConfirmedTOTP(user);

        await submitLogin(page, { url: registrationUrl, email: user.email });

        // The password is correct, but the account is protected: the challenge takes over
        // the login view instead of leaving it sitting there.
        await new TwoFactorFlow({ page }).passTOTPChallenge(secret);

        await expect(page.getByTestId('members-start-view')).toBeVisible({ timeout: 30_000 });
    });

    test('an admin without a factor enrolls one before getting in', async ({ page }) => {
        const organizationRequiringTwoFactor = await Organization.getByID(organization.id);
        organizationRequiringTwoFactor!.privateMeta.requireTwoFactor = true;
        await organizationRequiringTwoFactor!.save();

        try {
            const admin = await new UserFactory({
                organization,
                email: randomEmail('mfa-registration-admin'),
                password: PASSWORD,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            await submitLogin(page, { url: registrationUrl, email: admin.email });

            const { recoveryCodes } = await new TwoFactorFlow({ page }).completeForcedSetup();
            expect(recoveryCodes).toHaveLength(10);

            await expect(page.getByTestId('members-start-view')).toBeVisible({ timeout: 30_000 });

            expect(await MFATOTP.getConfirmedForUser(admin.id)).toHaveLength(1);
            expect(await MFARecoveryCode.getUnusedForUser(admin.id)).toHaveLength(10);
        } finally {
            organizationRequiringTwoFactor!.privateMeta.requireTwoFactor = false;
            await organizationRequiringTwoFactor!.save();
        }
    });

    test('passkeys are not offered on this domain', async ({ page }) => {
        const organizationRequiringTwoFactor = await Organization.getByID(organization.id);
        organizationRequiringTwoFactor!.privateMeta.requireTwoFactor = true;
        await organizationRequiringTwoFactor!.save();

        try {
            const admin = await new UserFactory({
                organization,
                email: randomEmail('mfa-registration-passkey'),
                password: PASSWORD,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            await submitLogin(page, { url: registrationUrl, email: admin.email });

            const setupView = page.getByTestId('setup-mfa-view');
            await expect(setupView).toBeVisible({ timeout: 30_000 });

            // A passkey created here would be bound to a domain this account will never use
            // again, and the browser would refuse the relying party id anyway.
            await expect(setupView.getByTestId('mfa-setup-passkey')).toBeHidden();
            await expect(setupView.getByTestId('mfa-setup-totp')).toBeVisible();

            expect(await WebauthnCredential.getForUser(admin.id)).toHaveLength(0);
        } finally {
            organizationRequiringTwoFactor!.privateMeta.requireTwoFactor = false;
            await organizationRequiringTwoFactor!.save();
        }
    });

    test('an enrolled passkey warns instead of failing with a relying party error', async ({ page }) => {
        const user = await new UserFactory({
            organization,
            email: randomEmail('mfa-registration-warn'),
            password: PASSWORD,
        }).create();

        // A passkey that was enrolled on the dashboard domain, plus an authenticator app to
        // fall back on.
        const { secret } = await MFATestHelper.addConfirmedTOTP(user);
        const credential = new WebauthnCredential();
        credential.userId = user.id;
        credential.credentialId = 'cred-registration-' + Math.floor(Math.random() * 1_000_000_000);
        credential.publicKey = 'not-a-real-key';
        credential.name = 'Dashboard passkey';
        await credential.save();

        await submitLogin(page, { url: registrationUrl, email: user.email });

        const chooseView = page.getByTestId('choose-mfa-method-view');
        await expect(chooseView).toBeVisible({ timeout: 30_000 });

        // The passkey is announced as unusable here, and cannot be started.
        await expect(page.getByTestId('passkey-domain-warning')).toBeVisible();
        await expect(chooseView.getByTestId('mfa-choose-passkey')).toBeHidden();

        // The authenticator app still works, so the user is not stuck.
        await new TwoFactorFlow({ page }).passTOTPChallenge(secret);
        await expect(page.getByTestId('members-start-view')).toBeVisible({ timeout: 30_000 });
    });
});
