// test should always be imported first
import { test } from '../test-fixtures/base.js';

// other imports
import { expect } from '@playwright/test';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

/**
 * Route resolution tests for the unified web-app.
 *
 * The web-app serves all apps from a single entry point (RouterAppView).
 * These tests verify that navigating to a URL loads the correct sub-app and
 * that the URL structure matches what RouterAppView defines.
 *
 * URL structure (on the dashboard domain, platform userMode):
 *   /                        → auto (org selector / unscoped login)
 *   /platform                → admin app
 *   /beheerders/{orgUri}     → dashboard for organization
 *   /leden                   → unscoped registration (platform mode)
 *   /leden/{orgUri}          → registration for organization
 *   /verify-email            → verify-email (unscoped, platform mode)
 *   /verify-email/{orgUri}   → verify-email for organization (non-platform)
 *
 * URL structure (on an org registration domain, e.g. playwright-registration-X.stamhoofd):
 *   /                        → auto (org-scoped, domain resolves org)
 *   /beheerders              → dashboard for the org resolved from domain
 *   /leden                   → registration for the org resolved from domain
 */

test.describe('Routing', () => {
    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    /**
     * Platform-mode routing: all sub-apps reachable from the dashboard domain.
     */
    test.describe('Platform mode - dashboard domain', () => {
        test.beforeAll(() => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
        });

        /**
         * TODO: verify root URL loads the auto/org-selector view.
         * Expect: organization search input or login prompt is visible.
         */
        test.skip('/ → auto view (org selector)', async ({ page }) => {
            await page.goto(WorkerData.urls.dashboard);
            // await expect(page.getByTestId('organization-search-input')).toBeVisible();
        });

        /**
         * TODO: verify /platform loads the admin app.
         * Expect: platform admin UI is visible (e.g. a platform-level heading or nav).
         */
        test.skip('/platform → admin app', async ({ page }) => {
            await page.goto(WorkerData.urls.dashboard + '/platform');
            // await expect(page.getByTestId('...')).toBeVisible();
        });

        /**
         * TODO: verify /beheerders/{orgUri} loads the dashboard for that org.
         * Setup: create org + user with full permissions.
         * Expect: org dashboard UI is visible (account-switcher, app-name with org name).
         */
        test.skip('/beheerders/{orgUri} → org dashboard', async ({ page }) => {
            // const organization = await new OrganizationFactory({ name: 'RoutingOrg' }).create();
            // ... login, navigate, assert
        });

        /**
         * TODO: verify /leden loads the unscoped platform registration view.
         * Expect: registration UI is visible without an org in scope.
         */
        test.skip('/leden → unscoped registration', async ({ page }) => {
            await page.goto(WorkerData.urls.dashboard + '/leden');
            // await expect(page.getByTestId('...')).toBeVisible();
        });

        /**
         * TODO: verify /leden/{orgUri} loads registration scoped to that org.
         * Expect: registration UI shows the specific org's groups.
         */
        test.skip('/leden/{orgUri} → org-scoped registration', async ({ page }) => {
            // const organization = await new OrganizationFactory({ name: 'RoutingOrg' }).create();
            // await page.goto(WorkerData.urls.dashboard + '/leden/' + organization.uri);
            // await expect(page.getByTestId('...')).toBeVisible();
        });

        /**
         * TODO: verify /verify-email loads the verify-email view (platform).
         */
        test.skip('/verify-email → verify-email view', async ({ page }) => {
            await page.goto(WorkerData.urls.dashboard + '/verify-email');
            // await expect(page.getByTestId('...')).toBeVisible();
        });

        /**
         * TODO: verify an unknown route falls back to the auto/default view.
         */
        test.skip('unknown route → default fallback', async ({ page }) => {
            await page.goto(WorkerData.urls.dashboard + '/this-route-does-not-exist');
            // should not 404 — should show default view
            // await expect(page.getByTestId('...')).toBeVisible();
        });
    });

    /**
     * Registration domain routing: org resolved from domain (orgInDomain mode).
     */
    test.describe('Registration domain - org resolved from domain', () => {
        test.beforeAll(() => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
        });

        /**
         * TODO: verify that navigating to the root of the registration domain
         * triggers org-from-domain resolution and shows the auto view for that org.
         *
         * Note: the registration domain (playwright-registration-X.stamhoofd) is not mapped
         * to a real org in the test caddy setup, so this test needs an org whose URI or id
         * matches the domain, or the test needs to configure the backend domain mapping.
         */
        test.skip('registration domain / → org-scoped auto view', async ({ page }) => {
            await page.goto(WorkerData.urls.registration);
            // await expect(page.getByTestId('...')).toBeVisible();
        });
    });
});
