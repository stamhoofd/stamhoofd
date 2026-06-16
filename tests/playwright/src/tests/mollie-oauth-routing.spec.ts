// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/worker/WorkerData.js';

/**
 * Mollie does not let us customize the OAuth redirect URL per organization,
 * therefor we have store the org-url in local storage and redirect to it.
 */

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await Token.createToken(user);
    const tokenString = JSON.stringify(
        new TokenStruct(token).encode({ version: Version }),
    );

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

            if (organizationId) {
                window.localStorage.removeItem('user-' + organizationId);
                window.localStorage.setItem('token-' + organizationId, tokenString);
            } else {
                window.localStorage.setItem('token-platform', tokenString);
            }
        }, { organizationId, tokenString });
    }
}

async function setSavedMollieRedirectUrl({ page, path }: { page: Page; path: string | null }) {
    await page.addInitScript((path) => {
        if (path === null) {
            window.localStorage.removeItem('mollie-saved-redirect-url');
        } else {
            window.localStorage.setItem('mollie-saved-redirect-url', path);
        }
    }, path);
}

test.describe('Mollie OAuth redirect routing @routing', () => {
    const domain = WorkerData.urls.dashboard;

    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
    });

    let user: User;
    let organization: Organization;

    test.beforeEach(async ({ page }) => {
        organization = await new OrganizationFactory({}).create();
        user = await new UserFactory({
            globalPermissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        await loginAs({ user, page });
    });

    test('rewrites /oauth/mollie to the saved organization url', async ({ page }) => {
        const savedPath = '/nl-BE/beheerders/' + organization.uri + '/instellingen';
        await setSavedMollieRedirectUrl({ page, path: savedPath });

        await page.goto(domain + '/oauth/mollie');

        // are we being redirected to the saved path?
        await expect(page.locator('#settings-view')).toBeVisible();
        await expect(page).toHaveURL(domain + savedPath);
    });

    test('preserves the mollie oauth query params (code/state) while redirecting', async ({ page }) => {
        const savedPath = '/nl-BE/beheerders/' + organization.uri + '/instellingen';
        await setSavedMollieRedirectUrl({ page, path: savedPath });

        // The query params set by Mollie (?code=...&state=...) must be preserved on path rewrite
        await page.goto(domain + '/oauth/mollie?code=testcode&state=teststate');

        await expect(page.locator('#settings-view')).toBeVisible();
        await expect(page).toHaveURL(/code=testcode/);
        await expect(page).toHaveURL(/state=teststate/);
    });

    test('falls back to normal routing when no saved url is present', async ({ page }) => {
        await setSavedMollieRedirectUrl({ page, path: null });

        await page.goto(domain + '/oauth/mollie');

        // Without a saved redirect url the rewrite is skipped; and the user is asked to select an org
        await expect(page.locator('[data-testid="organization-selection-view"]')).toBeVisible();
    });
});
