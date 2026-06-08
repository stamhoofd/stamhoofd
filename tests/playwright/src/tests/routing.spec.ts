import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/worker/WorkerData.js';
import { test } from '../test-fixtures/base.js';

async function loginAs({ page, user }: { page: Page; user: User }) {
    // create token
    const token = await Token.createToken(user);
    const tokenString = JSON.stringify(
        new TokenStruct(token).encode({ version: Version }),
    );

    // Set local storage data
    if (STAMHOOFD.userMode === 'platform') {
        await page.addInitScript(({ tokenString }) => {
            window.localStorage.removeItem('user-platform');
            window.localStorage.setItem('token-platform', tokenString);
        }, { tokenString });
    } else {
        const organizationId = user.organizationId;
        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.removeItem('user-platform');
            window.localStorage.removeItem('token-platform');
            window.localStorage.removeItem('user-' + organizationId);

            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId, tokenString });
    }
}

async function logout({ page }: { page: Page }) {
    // Set local storage data
    if (STAMHOOFD.userMode === 'platform') {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
    } else {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
    }
}

async function checkScopedTo({ page, organization }: { page: Page; organization: Organization | null }) {
    await expect(page.locator('[data-organization-scope="' + (organization?.id ?? null) + '"]')).toBeVisible();
}

test.describe.fixme('Routing on page load @routing', () => {
    test.describe('Platform mode', () => {
        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
        });

        test.describe('Platform Admin in Platform mode', () => {
            test.beforeEach(async ({ page }) => {
                const user = await new UserFactory({
                    globalPermissions: Permissions.create({
                        level: PermissionLevel.Full,
                    }),
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/platform/instellingen');

                // Settings view should be visible
                await expect(page.locator('#settings-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/platform/instellingen');
            });

            test('/beheerders/<uri>/instellingen', async ({ page }) => {
                const organization = await new OrganizationFactory({
                }).create();

                // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen');

                // Settings view should be visible
                await expect(page.locator('#settings-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/instellingen');
            });

            test('/leden/<uri>', async ({ page }) => {
                const organization = await new OrganizationFactory({
                }).create();

                // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/leden/' + organization.uri);

                // Settings view should be visible
                await expect(page.getByTestId('members-start-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri + '/start');
            });

            test('/leden/start', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/leden/start');

                // Settings view should be visible
                await expect(page.getByTestId('members-start-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/leden/start');
            });

            test('/ should show organization search', async ({ page }) => {
                // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard);

                await expect(page.getByTestId('organization-selection-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE');
            });
        });

        test.describe('Full Organization Admin in Platform mode', () => {
            let organization: Organization;

            test.beforeAll(async () => {
                organization = await new OrganizationFactory({}).create();
            });

            test.beforeEach(async ({ page }) => {
                const user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({
                        level: PermissionLevel.Full,
                    }),
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen should show permissions error page', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/platform/instellingen');

                // Settings view should be visible
                await expect(page.getByTestId('no-permissions-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/platform/geen-toegang');
            });

            test('/beheerders/<uri>/instellingen', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen');

                // Settings view should be visible
                await expect(page.locator('#settings-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/instellingen');
            });

            test('/leden/<uri>', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/leden/' + organization.uri);

                // Settings view should be visible
                await expect(page.getByTestId('members-start-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri + '/start');
            });

            test('/leden/start', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/leden/start');

                // Settings view should be visible
                await expect(page.getByTestId('members-start-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/leden/start');
            });

            test.fixme('/ should redirect to /beheerders/<uri>/start', async ({ page }) => {
                // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard);

                await expect(page.getByTestId('dashboard-start-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/start');
            });
        });

        test.describe('Partially Organization Admin in Platform mode', () => {
            let organization: Organization;

            test.beforeAll(async () => {
                organization = await new OrganizationFactory({}).create();
            });

            test.beforeEach(async ({ page }) => {
                const user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({
                        level: PermissionLevel.Read,
                    }),
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen should show permissions error page', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/platform/instellingen');

                // Settings view should be visible
                await expect(page.getByTestId('no-permissions-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/platform/geen-toegang');
            });

            test('/beheerders/<uri>/instellingen should redirect to start', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen');

                // Settings view should be visible
                await expect(page.getByTestId('dashboard-start-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/start');
            });

            test('/leden/<uri>', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/leden/' + organization.uri);

                // Settings view should be visible
                await expect(page.getByTestId('members-start-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri + '/start');
            });

            test('/leden/start', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/leden/start');

                // Settings view should be visible
                await expect(page.getByTestId('members-start-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/leden/start');
            });

            test.fixme('/ should redirect to /beheerders/<uri>/start', async ({ page }) => {
                // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard);

                await expect(page.getByTestId('dashboard-start-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/start');
            });
        });

        test.describe('Normal user in Platform mode', () => {
            let organization: Organization;

            test.beforeAll(async () => {
                organization = await new OrganizationFactory({}).create();
            });

            test.beforeEach(async ({ page }) => {
                const user = await new UserFactory({
                    organization,
                    permissions: null,
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen should show permissions error page', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/platform/instellingen');

                // Settings view should be visible
                await expect(page.getByTestId('no-permissions-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/platform/geen-toegang');
            });

            test('/beheerders/<uri>/instellingen should show permissions error page', async ({ page }) => {
                // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen');

                // Settings view should be visible
                await expect(page.getByTestId('no-permissions-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/geen-toegang');
            });

            test('/leden/<uri>', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/leden/' + organization.uri);

                // Settings view should be visible
                await expect(page.getByTestId('members-start-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri + '/start');
            });

            test('/leden/start', async ({ page }) => {
            // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/leden/start');

                await expect(page.getByTestId('members-start-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/leden/start');
            });

            test.fixme('/ should redirect to /leden/start (unscoped)', async ({ page }) => {
                // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard);

                await expect(page.getByTestId('members-start-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/leden/start');
            });
        });

        test.describe('Unauthenticated user in Platform mode', () => {
            let organization: Organization;

            test.beforeAll(async () => {
                organization = await new OrganizationFactory({}).create();
            });

            test.beforeEach(async ({ page }) => {
                await logout({ page });
            });

            test('/platform/instellingen should show login view (unscoped)', async ({ page }) => {
                await page.goto(WorkerData.urls.dashboard + '/platform/instellingen');

                await expect(page.getByTestId('login-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/platform');
            });

            test('/beheerders/<uri>/instellingen should show login view (scoped)', async ({ page }) => {
                // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen');

                await expect(page.getByTestId('login-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri);
            });

            test('/leden/<uri> should show login view (scoped)', async ({ page }) => {
                // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/leden/' + organization.uri);

                await expect(page.getByTestId('login-view')).toBeVisible();
                await checkScopedTo({ page, organization });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri);
            });

            test('/leden/start should show login view (unscoped)', async ({ page }) => {
                // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard + '/leden/start');

                await expect(page.getByTestId('login-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE/leden');
            });

            test('/ should show login view (unscoped)', async ({ page }) => {
                // Navigate directly to the platform admin panel
                await page.goto(WorkerData.urls.dashboard);

                await expect(page.getByTestId('login-view')).toBeVisible();
                await checkScopedTo({ page, organization: null });

                // Url will only get updated after a certain timeout
                await page.waitForTimeout(5_000);

                // Url should be the same
                await expect(page).toHaveURL(WorkerData.urls.dashboard + '/nl-BE');
            });
        });
    });
});
