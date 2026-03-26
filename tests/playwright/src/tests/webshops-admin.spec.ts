// test should always be imported first
import { test } from '../test-fixtures/platform.js';

// other imports
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, WebshopFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, UserPermissions, WebshopMetaData, WebshopStatus } from '@stamhoofd/structures';
import { TableHelper, WorkerData } from '../helpers/index.js';

/**
 * Navigate to a sub-tab that lives inside the 'Meer' tab group.
 * Steps: click 'Meer' → wait for dropdown → click item by name.
 */
async function navigateToMoreSubTab(page: Page, tabName: string) {
    // Click the 'Meer' group button (the one with arrow-down-small icon)
    const meerButton = page.getByTestId('tab-button').filter({ hasText: 'Meer' });
    await meerButton.waitFor({ timeout: 15000 });
    await meerButton.click();

    // The dropdown opens — click the item with the matching name
    const dropdownItem = page.locator('.st-view').last().getByRole('button', { name: tabName });
    await dropdownItem.waitFor({ timeout: 5000 });
    await dropdownItem.click();
}

test.describe('Webshops admin', () => {
    let organization: Organization;
    let webshopName: string;

    test.beforeAll(async () => {
        // Grant the worker user full platform access so the Webshops tab is visible
        const user = WorkerData.user;
        user.permissions = UserPermissions.create({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        });
        await user.save();

        organization = await new OrganizationFactory({
            name: `TestOrg${WorkerData.id}`,
        }).create();

        webshopName = `Testwebshop ${WorkerData.id}`;

        await new WebshopFactory({
            organizationId: organization.id,
            name: webshopName,
        }).create();
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('zoek webshop op naam', async ({ page }) => {
        // Navigate directly to the platform admin panel
        await page.goto(WorkerData.urls.dashboard + '/platform');

        await navigateToMoreSubTab(page, 'Webshops');

        // type in the search box
        const searchInput = page.locator('input[name="search"]');
        await searchInput.waitFor();
        await searchInput.fill(webshopName);

        // the row should appear in the table
        const table = new TableHelper(page);
        await table.getRow(webshopName).waitFor({ timeout: 10000 });
        await expect(table.getRow(webshopName)).toBeVisible();
    });

    test('open webshop detail view', async ({ page }) => {
        // Navigate directly to the platform admin panel
        await page.goto(WorkerData.urls.dashboard + '/platform');

        await navigateToMoreSubTab(page, 'Webshops');

        // search for the webshop
        const searchInput = page.locator('input[name="search"]');
        await searchInput.waitFor();
        await searchInput.fill(webshopName);

        // click the row to open the detail view
        const table = new TableHelper(page);
        await table.getRow(webshopName).waitFor({ timeout: 10000 });
        await table.getRow(webshopName).click();

        // the detail pane should show the webshop name as h1 (style-navigation-title is the class used in the popup)
        await expect(page.locator('h1.style-navigation-title').filter({ hasText: webshopName })).toBeVisible({ timeout: 5000 });
    });

    test('@extra webshop url link heeft https:// protocol', async ({ page }) => {
        await page.goto(WorkerData.urls.dashboard + '/platform');
        await navigateToMoreSubTab(page, 'Webshops');

        const searchInput = page.locator('input[name="search"]');
        await searchInput.waitFor();
        await searchInput.fill(webshopName);

        const table = new TableHelper(page);
        await table.getRow(webshopName).waitFor({ timeout: 10000 });
        await table.getRow(webshopName).click();

        await page.locator('h1.style-navigation-title').filter({ hasText: webshopName }).waitFor({ timeout: 5000 });

        // The 'Webshop openen' link must start with https://
        const webshopLink = page.getByRole('link', { name: 'Webshop openen' });
        await webshopLink.waitFor({ timeout: 5000 });
        const href = await webshopLink.getAttribute('href');
        expect(href).toMatch(/^https:\/\//);
    });

    test('@extra gearchiveerde webshop linkt naar webshops lijst in dashboard', async ({ page }) => {
        // Create an archived webshop
        const archivedWebshopName = `Gearchiveerde webshop ${WorkerData.id}`;
        const archivedWebshop = await new WebshopFactory({
            organizationId: organization.id,
            name: archivedWebshopName,
            meta: WebshopMetaData.patch({ status: WebshopStatus.Archived }),
        }).create();

        // Navigate directly to the archived webshop via URL (deep link).
        // The default filter hides archived webshops from the table, so we
        // use the route system (/{id}) to open it directly.
        await page.goto(WorkerData.urls.dashboard + '/platform/webshops/' + archivedWebshop.id);

        await page.locator('h1.style-navigation-title').filter({ hasText: archivedWebshopName }).waitFor({ timeout: 10000 });

        // For an archived webshop, 'Bestellingen beheren' must point to /verkoop/archief
        // (not to the specific webshop id, which would throw "Webshop not found").
        const ordersLink = page.getByRole('link', { name: 'Bestellingen beheren' });
        await ordersLink.waitFor({ timeout: 5000 });
        const href = await ordersLink.getAttribute('href');
        expect(href).toMatch(/\/verkoop\/archief$/);

        // The 'Webshop openen' link must NOT be present for archived webshops
        await expect(page.getByRole('link', { name: 'Webshop openen' })).toHaveCount(0);
    });

    test('@extra standaard filter toont alleen open webshops', async ({ page }) => {
        // Create a closed and an archived webshop alongside the default open webshop
        const closedName = `Gesloten webshop ${WorkerData.id}`;
        const archivedName = `Gearchiveerd ${WorkerData.id}`;

        await new WebshopFactory({
            organizationId: organization.id,
            name: closedName,
            meta: WebshopMetaData.patch({ status: WebshopStatus.Closed }),
        }).create();
        await new WebshopFactory({
            organizationId: organization.id,
            name: archivedName,
            meta: WebshopMetaData.patch({ status: WebshopStatus.Archived }),
        }).create();

        await page.goto(WorkerData.urls.dashboard + '/platform');
        await navigateToMoreSubTab(page, 'Webshops');

        // Wait for table to load
        const table = new TableHelper(page);
        await table.getRow(webshopName).waitFor({ timeout: 10000 });

        // The open webshop is visible
        await expect(table.getRow(webshopName)).toBeVisible();

        // The closed and archived webshops must NOT appear (default filter = Open only)
        await expect(table.getRow(closedName)).toHaveCount(0);
        await expect(table.getRow(archivedName)).toHaveCount(0);
    });

    test('@extra filter op status toont gesloten webshops', async ({ page }) => {
        const closedName = `Gesloten filter test ${WorkerData.id}`;

        await new WebshopFactory({
            organizationId: organization.id,
            name: closedName,
            meta: WebshopMetaData.patch({ status: WebshopStatus.Closed }),
        }).create();

        await page.goto(WorkerData.urls.dashboard + '/platform');
        await navigateToMoreSubTab(page, 'Webshops');

        // Wait for table to load
        const table = new TableHelper(page);
        await table.getRow(webshopName).waitFor({ timeout: 10000 });

        // Open the filter panel by clicking the 'Filter' button
        await page.locator('button.button.text').filter({ hasText: 'Filter' }).click();

        // Edit the existing 'Status is Open' filter by clicking the row
        await page.locator('.group-ui-filter-row').filter({ hasText: 'Status' }).first().click();

        // The status options appear – deselect 'Open' and select 'Gesloten'
        await page.locator('label').filter({ hasText: /^Open$/ }).click();
        await page.locator('label').filter({ hasText: /^Gesloten$/ }).click();

        // Apply the updated filter
        await page.getByRole('button', { name: 'Toepassen' }).click();

        // Close the filter panel
        await page.keyboard.press('Escape');

        // The closed webshop should appear
        await table.getRow(closedName).waitFor({ timeout: 10000 });
        await expect(table.getRow(closedName)).toBeVisible();

        // The open webshop should NOT appear (it's now filtered to Closed only)
        await expect(table.getRow(webshopName)).toHaveCount(0);
    });
});
