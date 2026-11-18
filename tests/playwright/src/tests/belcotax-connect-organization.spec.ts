// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { belcotaxRepresentatives, ssoUserPassword } from '@stamhoofd/cli';
import type { Organization, User } from '@stamhoofd/models';
import { BelcotaxConnection, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { Address, appToUri, Company, Permissions, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { BelcotaxFeatureFlag } from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import nock from 'nock';
import { WorkerData } from '../helpers/index.js';

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    const organizationId = user.organizationId;
    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.setItem('token-' + organizationId, tokenString);
    }, { organizationId, tokenString });
}

async function selectTab(page: Page, tabId: string) {
    await expect(page.locator('[data-testid="tab-button"]:visible').first()).toBeVisible();
    const directTab = page.locator(`[data-testid="tab-button"][data-tab-id="${tabId}"]:visible`).first();
    if (await directTab.count() > 0) {
        await directTab.click();
        return;
    }
    await page.locator('[data-testid="tab-button"][data-tab-id="more"]:visible').first().click();
    await page.locator(`[data-testid="tab-dropdown-item"][data-tab-id="${tabId}"]:visible`).first().click();
}

function activePopup(page: Page) {
    return page.locator('div.popup.focused').last();
}

/**
 * The login of a legal representative at FOD Financiën, played by the Belcotax realm of the e2e
 * SSO server. Keycloak remembers a consent that was given, so the consent screen is optional.
 */
async function loginAtFod(page: Page, email: string, consent: 'accept' | 'refuse') {
    await page.locator('#username').fill(email);
    await page.locator('#password').fill(ssoUserPassword);
    await page.locator('#kc-login').click();

    const consentScreen = page.getByText('Fiscale fiches indienen bij Belcotax-on-web');
    const settings = page.getByTestId('belcotax-settings-view');
    await expect(consentScreen.or(settings).first()).toBeVisible({ timeout: 15_000 });
    if (await consentScreen.isVisible()) {
        await page.locator(consent === 'accept' ? '#kc-login' : '#kc-cancel').click();
    }
}

const [representative, otherRepresentative, refusingRepresentative] = belcotaxRepresentatives;

/**
 * Connecting a company through the local stand-in for FOD Financiën. "Not a legal representative"
 * can't be produced by Keycloak and is covered by the API tests.
 */
test.describe('Belcotax connection @belcotax-connect', () => {
    let organization: Organization;

    test.beforeAll(() => {
        // The API of this worker calls Keycloak itself (discovery, tokens, keys). nock, loaded by
        // the mockers of the backend helpers, can't pass those requests through.
        nock.restore();
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        TestUtils.setPermanentEnvironment('singleOrganization', undefined);
        TestUtils.setPermanentEnvironment('BELCOTAX_ENVIRONMENT', 'local');
    });

    test.beforeEach(async ({ page }) => {
        const address = Address.create({ street: 'Kerkstraat', number: '1', postalCode: '9000', city: 'Gent', country: Country.Belgium });
        organization = await new OrganizationFactory({}).create();
        organization.meta.companies = [
            Company.create({ name: 'Jeugdhuis De Kelder vzw', companyNumber: '0662.348.959', address }),
            Company.create({ name: 'Chiro Sint-Jan', address }),
        ];
        organization.privateMeta.featureFlags = [BelcotaxFeatureFlag];
        await organization.save();

        const admin = await new UserFactory({
            organization,
            email: `belcotax-${Math.random().toString(36).slice(2)}@example.com`,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        await loginAs({ page, user: admin });
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}`);
        await selectTab(page, 'settings');
        await page.getByTestId('open-belcotax-settings').click();
    });

    test.afterAll(async () => {
        nock.activate();
        TestUtils.setPermanentEnvironment('BELCOTAX_ENVIRONMENT', undefined);
        await WorkerData.resetDatabase();
    });

    function companyRow(page: Page, name: string) {
        return activePopup(page).getByTestId('belcotax-company').filter({ hasText: name });
    }

    async function expectRefusal(page: Page, reason: string) {
        const dialog = page.getByTestId('centered-message').last();
        await expect(dialog).toContainText('Verbinden met Belcotax is niet gelukt', { timeout: 15_000 });
        await expect(dialog).toContainText(reason);
        await dialog.getByRole('button').first().click();

        await expect(companyRow(page, 'Jeugdhuis De Kelder vzw')).toContainText('niet verbonden');
        expect(await BelcotaxConnection.getFor(organization.id, representative.companyNumber)).toBeNull();
    }

    test('a legal representative connects a company', async ({ page }) => {
        await expect(companyRow(page, 'Chiro Sint-Jan')).toContainText('Geen ondernemingsnummer');
        await expect(companyRow(page, 'Chiro Sint-Jan').getByTestId('belcotax-connect')).toHaveCount(0);
        await expect(companyRow(page, 'Jeugdhuis De Kelder vzw')).toContainText('0662.348.959 · niet verbonden');

        await companyRow(page, 'Jeugdhuis De Kelder vzw').getByTestId('belcotax-connect').click();
        await loginAtFod(page, representative.email, 'accept');

        await expect(page.getByText('De verbinding met Belcotax is gelukt')).toBeVisible({ timeout: 15_000 });
        await expect(companyRow(page, 'Jeugdhuis De Kelder vzw')).toContainText('verbonden door An Claes');
        await expect(companyRow(page, 'Jeugdhuis De Kelder vzw')).toContainText('Verbonden');
        expect(new URL(page.url()).searchParams.get('belcotax_result')).toBeNull();

        const connection = await BelcotaxConnection.getFor(organization.id, representative.companyNumber);
        expect(connection?.representativeName).toBe('An Claes');
        expect(connection?.isValid).toBe(true);
    });

    test('a representative who refuses consent changes nothing', async ({ page }) => {
        await companyRow(page, 'Jeugdhuis De Kelder vzw').getByTestId('belcotax-connect').click();
        await loginAtFod(page, refusingRepresentative.email, 'refuse');
        await expectRefusal(page, 'geen toestemming');
    });

    test('a login for another company is refused', async ({ page }) => {
        await companyRow(page, 'Jeugdhuis De Kelder vzw').getByTestId('belcotax-connect').click();
        await loginAtFod(page, otherRepresentative.email, 'accept');
        await expectRefusal(page, '0663.895.516');
    });
});
