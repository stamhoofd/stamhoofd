// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { Organization, OrganizationFactory } from '@stamhoofd/models';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { DarkMode, STPackageBundle } from '@stamhoofd/structures';
import { WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

test.describe('Webshop dark mode setting', () => {
    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function createWebshopOrganization(): Promise<Organization> {
        const organization = await new OrganizationFactory({
            name: `DarkMode${WorkerData.id}`,
            packages: [STPackageBundle.Webshops],
        }).create();

        // Recalculate meta.packages so the public webshop is not rendered as "closed"
        await STPackageService.updateOrganizationPackages(organization.id);

        const refreshed = await Organization.getByID(organization.id);
        if (!refreshed) {
            throw new Error('Organization not found after creation');
        }
        return refreshed;
    }

    async function openWebshopWithDarkPreference(page: Page, darkMode: DarkMode) {
        const organization = await createWebshopOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Dark mode ${darkMode} ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            darkMode,
        });

        await page.emulateMedia({ colorScheme: 'dark' });
        await page.goto(WorkerData.urls.webshopUri(webshop.uri));
        await expect(page.getByTestId('product-box').first()).toBeVisible({ timeout: 15000 });
    }

    function readDarkModeState(page: Page) {
        return page.evaluate(() => {
            const svg = document.createElement('img');
            svg.src = '/test.svg';
            document.body.appendChild(svg);
            const state = {
                root: getComputedStyle(document.documentElement).getPropertyValue('--is-dark-mode').trim(),
                body: getComputedStyle(document.body).getPropertyValue('--is-dark-mode').trim(),
                svgFilter: getComputedStyle(svg).filter,
            };
            svg.remove();
            return state;
        });
    }

    test('stays light when dark mode is off and the device prefers dark', async ({ page }) => {
        await openWebshopWithDarkPreference(page, DarkMode.Off);
        await expect(page.locator('body')).toHaveClass(/\blight\b/);
        expect(await readDarkModeState(page)).toEqual({ root: '0', body: '0', svgFilter: 'none' });
    });

    test('follows the device when dark mode is auto', async ({ page }) => {
        await openWebshopWithDarkPreference(page, DarkMode.Auto);
        expect(await readDarkModeState(page)).toEqual({ root: '1', body: '1', svgFilter: 'contrast(0.7)' });
    });
});
