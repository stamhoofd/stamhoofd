// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { Organization, User } from '@stamhoofd/models';
import { OrganizationFactory, Platform, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

/**
 * The two-factor authentication setup flow is hidden behind platform feature flags:
 *  - 'mfa' makes it available to everyone
 *  - 'mfa-admins' (only relevant when 'mfa' is off) makes it available to users with
 *    platform permissions, so it can be rolled out to the platform's own admins first
 *
 * These tests check the entry point in the account settings, which is where a user starts
 * the setup flow themselves. A *forced* enrollment is not gated by these flags: it is
 * driven by the backend and covered by login-platform.spec.ts and invite-admin.spec.ts.
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
 * Sign in by setting the token in local storage (same as routing.spec.ts). The cached
 * platform is dropped as well, so the feature flags of this test are always the ones that
 * get used.
 */
async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
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
}

/**
 * Open the account settings of the signed in user.
 */
async function openAccountSettings(page: Page, url: string) {
    await page.goto(url);
    await page.locator('.account-switcher').click({ timeout: 20_000 });

    const accountView = page.locator('#account-view');
    await expect(accountView).toBeVisible({ timeout: 20_000 });
    return accountView;
}

test.describe('Two-factor authentication settings @two-factor-settings', () => {
    const domain = WorkerData.urls.dashboard;

    let organization: Organization;
    let member: User;
    let platformAdmin: User;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
        TestUtils.setPermanentEnvironment('singleOrganization', undefined);

        organization = await new OrganizationFactory({}).create();

        member = await new UserFactory({
            organization,
            email: randomEmail('mfa-member'),
            password: PASSWORD,
        }).create();

        platformAdmin = await new UserFactory({
            email: randomEmail('mfa-platform-admin'),
            password: PASSWORD,
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    });

    test.afterEach(async () => {
        await setPlatformFeatureFlags([]);
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('without a feature flag nobody can set up two-factor authentication', async ({ page }) => {
        await loginAs({ page, user: member });
        const accountView = await openAccountSettings(page, domain + '/leden/' + organization.uri);
        await expect(accountView.getByTestId('open-mfa-settings')).toBeHidden();
    });

    test("the 'mfa-admins' flag only enables it for platform admins", async ({ page, browser }) => {
        await setPlatformFeatureFlags(['mfa-admins']);

        await loginAs({ page, user: member });
        const memberAccountView = await openAccountSettings(page, domain + '/leden/' + organization.uri);
        await expect(memberAccountView.getByTestId('open-mfa-settings')).toBeHidden();

        // A clean browser session for the platform admin
        const context = await browser.newContext();
        try {
            const adminPage = await context.newPage();
            await loginAs({ page: adminPage, user: platformAdmin });
            const adminAccountView = await openAccountSettings(adminPage, domain + '/platform');
            await expect(adminAccountView.getByTestId('open-mfa-settings')).toBeVisible();
        } finally {
            await context.close();
        }
    });

    test("the 'mfa' flag enables it for everyone", async ({ page }) => {
        await setPlatformFeatureFlags(['mfa']);

        await loginAs({ page, user: member });
        const accountView = await openAccountSettings(page, domain + '/leden/' + organization.uri);

        // The happy path: the settings view opens and shows what can be added
        await accountView.getByTestId('open-mfa-settings').click();

        const settingsView = page.getByTestId('mfa-settings-view');
        await expect(settingsView).toBeVisible({ timeout: 20_000 });
        await expect(settingsView.getByTestId('add-totp')).toBeVisible();
        await expect(settingsView.getByTestId('add-passkey')).toBeVisible();
    });
});
