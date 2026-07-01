// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { OrganizationFactory, Token, User as UserModel, UserFactory } from '@stamhoofd/models';
import { appToUri, PermissionLevel, Permissions, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

const PASSWORD = 'testAbc123456';

function randomEmail(prefix: string) {
    return prefix + '-' + Math.floor(Math.random() * 1_000_000_000) + '@example.com';
}

/**
 * Sign in by putting a token in local storage (same as two-factor-settings.spec.ts).
 *
 * `authenticatedAt` decides whether the session counts as freshly authenticated. Leaving
 * it null is what a refresh_token rotation produces, which is the state a browser that has
 * been open for a while is in.
 */
async function loginAs({ page, user, authenticatedAt = null }: { page: Page; user: User; authenticatedAt?: Date | null }) {
    const token = await Token.createToken(user, authenticatedAt);
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
 * Open the API keys list, which lives behind the experiments page of the settings.
 */
async function openApiKeys(page: Page, organization: Organization) {
    await page.goto(WorkerData.urls.dashboard + '/' + appToUri('dashboard') + '/' + organization.uri + '/instellingen/experimenten');

    await page.getByTestId('open-api-users').click({ timeout: 30_000 });
    await expect(page.getByTestId('api-users-view')).toBeVisible({ timeout: 20_000 });
}

/**
 * Fill in the new API key form and submit it.
 */
async function fillInNewApiKey(page: Page, name: string) {
    await page.getByTestId('create-api-user').click();

    const form = page.getByTestId('save-view').filter({ has: page.getByTestId('api-user-name') });
    await expect(form).toBeVisible({ timeout: 20_000 });
    await form.getByTestId('api-user-name').fill(name);
    await form.getByTestId('save-button').click();
}

test.describe('API keys @api-keys', () => {
    let organization: Organization;
    let admin: User;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
        TestUtils.setPermanentEnvironment('singleOrganization', undefined);

        organization = await new OrganizationFactory({}).create();
        admin = await new UserFactory({
            organization,
            email: randomEmail('api-keys-admin'),
            password: PASSWORD,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('a session that did not recently authenticate has to confirm the password first', async ({ page }) => {
        await loginAs({ page, user: admin });
        await openApiKeys(page, organization);

        await fillInNewApiKey(page, 'Stale session key');

        // The backend refuses this session, and the app asks the user to prove who they are.
        const reauthView = page.getByTestId('reauthenticate-view');
        await expect(reauthView).toBeVisible({ timeout: 20_000 });

        await reauthView.getByTestId('reauth-password').fill(PASSWORD);
        await reauthView.getByTestId('reauth-submit').click();

        // Once the session is fresh again the create is retried on its own, and the token
        // of the new key is shown.
        await expect(page.getByTestId('copy-api-token-view')).toBeVisible({ timeout: 30_000 });

        const [apiUser] = await UserModel.where({ organizationId: organization.id, firstName: 'Stale session key' }, { limit: 1 });
        expect(apiUser).toBeDefined();
        expect(apiUser.isApiUser).toBe(true);
    });

    test('a freshly authenticated session creates the key right away', async ({ page }) => {
        await loginAs({ page, user: admin, authenticatedAt: new Date() });
        await openApiKeys(page, organization);

        await fillInNewApiKey(page, 'Fresh session key');

        // No re-authentication: the session already proved who the user is.
        await expect(page.getByTestId('copy-api-token-view')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId('reauthenticate-view')).toBeHidden();
    });
});
