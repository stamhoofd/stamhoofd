// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { I18n } from '@stamhoofd/backend-i18n';
import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, PasswordToken, User, UserFactory } from '@stamhoofd/models';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { PermissionLevel, Permissions, STPackageBundle } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

/**
 * These tests cover the reset-password (forgot password) flow for every type of user.
 *
 * To keep the test reliable we don't go through the e-mail, but reproduce what the
 * forgot password flow does on the server: a PasswordToken is created, looked up in
 * the database and turned into the recovery url that would normally be e-mailed. We
 * then open that url in the browser and verify that:
 *  - choosing a new password signs the user in
 *  - the password actually changed in the database
 *
 * It is run for three user types (a platform admin, an organization admin and a
 * normal member without permissions) in three environments (organization mode,
 * platform mode and single organization mode).
 *
 * Setup is based on routing.spec.ts and verify-email.spec.ts.
 */

const PASSWORD = 'testAbc123456';
const NEW_PASSWORD = 'resetAbc789012';

// nl-BE, matching the locale used everywhere else in the tests
const i18n = new I18n(I18n.defaultLanguage, I18n.defaultCountry);

type UserType = 'platform' | 'admin' | 'normal';

function randomEmail(prefix: string) {
    return prefix + '-' + Math.floor(Math.random() * 1_000_000_000) + '@example.com';
}

/**
 * Create a verified user with a password for the given type. Admins get a name so the
 * (optional) name fields in the reset view are prefilled with valid values.
 */
async function createUser(type: UserType, organization: Organization) {
    const base = {
        email: randomEmail('reset-' + type),
        password: PASSWORD,
        firstName: 'Test',
        lastName: 'User',
    };

    switch (type) {
        case 'platform':
            // Not scoped to an organization: uses global permissions
            return new UserFactory({
                ...base,
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
        case 'admin':
            return new UserFactory({
                ...base,
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
        case 'normal':
            return new UserFactory({
                ...base,
                organization,
                permissions: null,
            }).create();
    }
}

/**
 * Fill in the reset password view (already visible) and submit.
 */
async function resetPasswordViaUI(page: Page, password: string) {
    const form = page.locator('form.forgot-password-reset-view');
    await expect(form).toBeVisible({ timeout: 10_000 });

    const passwordInputs = form.locator('input[autocomplete="new-password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);

    // Accept all required policy checkboxes (their amount depends on the configuration).
    const policies = form.getByTestId('checkbox');
    const count = await policies.count();
    for (let i = 0; i < count; i++) {
        await policies.nth(i).check();
    }

    await form.locator('#submit').click();
}

/**
 * After a successful reset the view is dismissed and a session token is stored.
 */
async function expectSignedIn(page: Page) {
    await expect(page.locator('form.forgot-password-reset-view')).toBeHidden({ timeout: 20_000 });
    await expect(page.locator('[data-testid="login-view"]')).toBeHidden();

    await expect.poll(
        async () => page.evaluate(() => Object.keys(window.localStorage).some(key => key.startsWith('token-') && !!window.localStorage.getItem(key))),
        { timeout: 20_000 },
    ).toBe(true);
}

/**
 * The shared scenarios that run identically in every environment.
 */
function defineResetScenarios(getOrganization: () => Organization) {
    for (const type of ['platform', 'admin', 'normal'] as const) {
        test('reset password for a ' + type + ' user', async ({ page }) => {
            const organization = getOrganization();
            const user = await createUser(type, organization);

            // Platform users are not scoped to an organization
            const scope = type === 'platform' ? null : organization;

            const oldPassword = (await User.getByID(user.id))?.password;
            expect(oldPassword).toBeTruthy();

            // Use the password forget flow to create a password token
            await PasswordToken.createToken(user);

            // Find the stored PasswordToken in the database
            const passwordToken = await PasswordToken.select().where('userId', user.id).first(true);

            // Navigate to the recovery url (the one that would be e-mailed to the user)
            const url = await passwordToken.getPasswordRecoveryUrl(scope, i18n);

            await test.step('Navigate to ' + url + ' and reset password', async () => {
                await page.goto(url);

                // Choose a new password
                await resetPasswordViaUI(page, NEW_PASSWORD);
            });

            // Check whether the user is now signed in
            await expectSignedIn(page);

            // Check whether the password has changed in the database
            const updatedPassword = (await User.getByID(user.id))?.password;
            expect(updatedPassword).toBeTruthy();
            expect(updatedPassword).not.toBe(oldPassword);
        });
    }
}

test.describe('Reset password @reset-password', () => {
    test.describe('Organization mode', () => {
        let organization: Organization;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'organization');
            TestUtils.setPermanentEnvironment('singleOrganization', undefined);
            organization = await new OrganizationFactory({
                packages: [STPackageBundle.Webshops, STPackageBundle.Members],
            }).create();
            await STPackageService.updateOrganizationPackages(organization.id);
        });

        test.afterAll(async () => {
            await WorkerData.resetDatabase();
        });

        defineResetScenarios(() => organization);
    });

    test.describe('Platform mode', () => {
        let organization: Organization;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
            TestUtils.setPermanentEnvironment('singleOrganization', undefined);
            organization = await new OrganizationFactory({}).create();
        });

        test.afterAll(async () => {
            await WorkerData.resetDatabase();
        });

        defineResetScenarios(() => organization);
    });

    test.describe('Single organization mode', () => {
        let organization: Organization;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
            organization = await new OrganizationFactory({}).create();
            TestUtils.setPermanentEnvironment('singleOrganization', organization.id);
        });

        test.afterAll(async () => {
            await WorkerData.resetDatabase();
        });

        defineResetScenarios(() => organization);
    });
});
