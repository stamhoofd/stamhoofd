// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { Organization as OrganizationModel, OrganizationFactory, Platform, Token, UserFactory } from '@stamhoofd/models';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { appToUri, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

/**
 * Requiring two-factor authentication only applies to new logins, so admins that are already
 * signed in keep their session. These tests cover both ways to end those sessions: the
 * question that is asked right after making it required, and the action in the settings.
 */

const PASSWORD = 'testAbc123456';

function randomEmail(prefix: string) {
    return prefix + '-' + Math.floor(Math.random() * 1_000_000_000) + '@example.com';
}

/**
 * Sign in by putting a token in local storage (same as api-keys.spec.ts).
 */
async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await Token.createToken(user, new Date());
    const tokenString = JSON.stringify(
        new TokenStruct(token).encode({ version: Version }),
    );

    const organizationId = user.organizationId;
    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.removeItem('platform');
        window.localStorage.removeItem('user-platform');

        if (organizationId) {
            window.localStorage.removeItem('user-' + organizationId);
            window.localStorage.setItem('token-' + organizationId, tokenString);
        } else {
            window.localStorage.setItem('token-platform', tokenString);
        }
    }, { organizationId, tokenString });

    return token;
}

async function isSignedOut(token: Token) {
    return !(await Token.getByAccessToken(token.accessToken, true));
}

test.describe('Sign out admins after requiring two-factor authentication @two-factor-sign-out', () => {
    const domain = WorkerData.urls.dashboard;

    test.describe('Organization mode', () => {
        let organization: Organization;
        let admin: User;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'organization');
            TestUtils.setPermanentEnvironment('singleOrganization', undefined);

            organization = await new OrganizationFactory({
                packages: [STPackageBundle.Members],
            }).create();
            await STPackageService.updateOrganizationPackages(organization.id);

            // Only organizations that may use two-factor authentication see the setting
            organization.privateMeta.featureFlags = ['mfa'];
            await organization.save();

            admin = await new UserFactory({
                organization,
                email: randomEmail('sign-out-admins'),
                password: PASSWORD,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
        });

        test.afterAll(async () => {
            await WorkerData.resetDatabase();
        });

        test('making it required offers to sign out the other admins', async ({ page }) => {
            const otherAdmin = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const otherAdminToken = await Token.createToken(otherAdmin, new Date());

            const ownToken = await loginAs({ page, user: admin });
            await page.goto(domain + '/' + appToUri('dashboard') + '/' + organization.uri + '/instellingen/experimenten');

            const requireTwoFactor = page.getByTestId('require-two-factor');
            await expect(requireTwoFactor).toBeVisible({ timeout: 30_000 });
            await requireTwoFactor.click();
            await expect(requireTwoFactor.locator('input')).toBeChecked();

            await page.getByTestId('save-button').first().click();

            // The requirement is saved, and only then are we asked about the other admins
            const message = page.getByTestId('centered-message');
            await expect(message).toBeVisible({ timeout: 20_000 });
            await expect.poll(async () => (await OrganizationModel.getByID(organization.id))?.privateMeta.requireTwoFactor, { timeout: 20_000 }).toBe(true);

            await message.getByRole('button', { name: 'Afmelden', exact: true }).click();

            await expect.poll(async () => await isSignedOut(otherAdminToken), { timeout: 20_000 }).toBe(true);

            // Not the session that made the change
            expect(await isSignedOut(ownToken)).toBe(false);
        });

        test('the other admins can also be signed out later', async ({ page }) => {
            const otherAdmin = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const otherAdminToken = await Token.createToken(otherAdmin, new Date());

            const ownToken = await loginAs({ page, user: admin });
            await page.goto(domain + '/' + appToUri('dashboard') + '/' + organization.uri + '/instellingen/experimenten');

            const signOutAdmins = page.getByTestId('sign-out-admins');
            await expect(signOutAdmins).toBeVisible({ timeout: 30_000 });
            await signOutAdmins.click();

            await page.getByTestId('centered-message').getByRole('button', { name: 'Afmelden', exact: true }).click();

            await expect.poll(async () => await isSignedOut(otherAdminToken), { timeout: 20_000 }).toBe(true);
            expect(await isSignedOut(ownToken)).toBe(false);
        });
    });

    test.describe('Platform mode', () => {
        let platformAdmin: User;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
            TestUtils.setPermanentEnvironment('singleOrganization', undefined);

            // Only a platform that may use two-factor authentication sees the setting
            const platform = await Platform.getForEditing();
            platform.config.featureFlags = ['mfa'];
            await platform.save();

            platformAdmin = await new UserFactory({
                email: randomEmail('sign-out-platform-admins'),
                password: PASSWORD,
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
        });

        test.afterAll(async () => {
            // The platform row survives resetDatabase()
            const platform = await Platform.getForEditing();
            platform.privateConfig.requireTwoFactor = false;
            platform.config.featureFlags = [];
            await platform.save();

            await WorkerData.resetDatabase();
        });

        test('making it required offers to sign out the other platform admins', async ({ page }) => {
            const otherAdmin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const otherAdminToken = await Token.createToken(otherAdmin, new Date());

            const ownToken = await loginAs({ page, user: platformAdmin });
            await page.goto(domain + '/platform/instellingen/experimenten');

            const requireTwoFactor = page.getByTestId('mfa-required');
            await expect(requireTwoFactor).toBeVisible({ timeout: 30_000 });
            await requireTwoFactor.click();

            await page.getByTestId('save-button').first().click();

            const message = page.getByTestId('centered-message');
            await expect(message).toBeVisible({ timeout: 20_000 });
            await expect.poll(async () => (await Platform.getForEditing()).privateConfig.requireTwoFactor, { timeout: 20_000 }).toBe(true);

            await message.getByRole('button', { name: 'Afmelden', exact: true }).click();

            await expect.poll(async () => await isSignedOut(otherAdminToken), { timeout: 20_000 }).toBe(true);
            expect(await isSignedOut(ownToken)).toBe(false);
        });
    });
});
