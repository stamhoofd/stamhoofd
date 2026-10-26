// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { User } from '@stamhoofd/models';
import { Organization, OrganizationFactory, UserFactory, Webshop } from '@stamhoofd/models';
import { Permissions, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { TestUtils } from '@stamhoofd/test-utils';
import { DashboardPage, DashboardTab, WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.setItem('token-' + organizationId, tokenString);
    }, { organizationId: user.organizationId, tokenString });
}

test.describe('Webshop settings @webshop-settings-save', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test('Saving the general settings returns to the webshop overview', async ({ page }) => {
        const created = await new OrganizationFactory({
            name: `SettingsShop${WorkerData.id}-${Date.now()}`,
            packages: [STPackageBundle.Webshops],
        }).create();
        await STPackageService.updateOrganizationPackages(created.id);
        const organization = (await Organization.getByID(created.id))!;

        const { webshop } = await TestWebshops.create({
            organization,
            name: `Settings ${WorkerData.id}`,
            productCount: 1,
        });

        const admin = await new UserFactory({
            email: `admin-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        const dashboard = new DashboardPage(page);
        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
        await page.getByRole('heading', { name: 'Algemeen' }).click();
        await expect(page.getByRole('heading', { name: 'Algemene instellingen', level: 1 }).first()).toBeVisible();

        const newName = `Renamed ${WorkerData.id}`;
        await page.locator('.st-view').last().locator('input[type="text"]').first().fill(newName);
        await page.locator('.st-view').last().getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.meta.name).toBe(newName);
        // Saving closes the settings view (pushed or presented) and keeps the dashboard open
        await expect(page.getByRole('heading', { name: 'Algemene instellingen', level: 1 })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: newName, level: 1 }).first()).toBeVisible();
        await expect(page.getByTestId('webshop-menu-item').filter({ hasText: newName })).toBeVisible();
        await expect(page.getByText('Oeps, er ging iets mis')).toHaveCount(0);
    });
});
