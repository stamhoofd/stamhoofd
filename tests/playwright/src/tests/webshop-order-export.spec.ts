// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Download, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { User } from '@stamhoofd/models';
import { Organization, OrganizationFactory, Ticket, Token, UserFactory } from '@stamhoofd/models';
import {
    PaymentMethod,
    PermissionLevel,
    Permissions,
    STPackageBundle,
    Token as TokenStruct,
    Version,
    WebshopTicketType,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { readFile } from 'node:fs/promises';
import XLSX from 'xlsx';
import { WebshopOrderFlow } from '../flows/WebshopOrderFlow.js';
import { DashboardPage, DashboardTab, TableHelper, WorkerData } from '../helpers/index.js';
import { WebshopOrdersView } from '../helpers/page/webshop/WebshopOrdersView.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

async function createWebshopOrganization(prefix: string): Promise<Organization> {
    const organization = await new OrganizationFactory({
        name: `${prefix}${WorkerData.id}`,
        packages: [STPackageBundle.Webshops],
    }).create();

    await STPackageService.updateOrganizationPackages(organization.id);

    const refreshed = await Organization.getByID(organization.id);
    if (!refreshed) {
        throw new Error('Organization not found after creation');
    }
    return refreshed;
}

/** Enable the feature flag that shows the sheet and column selection UI for the orders Excel export. */
async function enableExcelExportUi(organization: Organization) {
    organization.privateMeta.featureFlags = [...organization.privateMeta.featureFlags, 'webshop-orders-excel-export-ui'];
    await organization.save();
}

async function createAdmin(organization: Organization): Promise<User> {
    const email = `admin-${WorkerData.id}-${Date.now()}@test.be`;
    const fullPermissions = Permissions.create({ level: PermissionLevel.Full });

    if (STAMHOOFD.userMode === 'platform') {
        return await new UserFactory({ email, globalPermissions: fullPermissions }).create();
    }
    return await new UserFactory({ email, organization, permissions: fullPermissions }).create();
}

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await Token.createToken(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));

    if (STAMHOOFD.userMode === 'platform') {
        await page.addInitScript(({ tokenString }) => {
            window.localStorage.setItem('token-platform', tokenString);
        }, { tokenString });
    } else {
        const organizationId = user.organizationId;
        await page.addInitScript(({ organizationId, tokenString }) => {
            if (organizationId) {
                window.localStorage.setItem('token-' + organizationId, tokenString);
            } else {
                window.localStorage.setItem('token-platform', tokenString);
            }
        }, { organizationId, tokenString });
    }
}

/** Navigate the admin dashboard to a webshop's orders table (works even when there are no orders yet). */
async function openWebshopOrders(adminPage: Page, organization: Organization, webshopName: string) {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
    await dashboard.openTab(DashboardTab.Webshops);
    await adminPage.getByTestId('webshop-menu-item').filter({ hasText: webshopName }).click();
    await adminPage.getByTestId('open-orders-button').click();
    await adminPage.getByTestId('table').waitFor();
}

/** Read a Playwright download into a SheetJS workbook. */
async function readWorkbook(download: Download, saveAsPath: string): Promise<XLSX.WorkBook> {
    expect(await download.failure()).toBeNull();
    await download.saveAs(saveAsPath);

    // The ESM build of SheetJS has no filesystem access by default: read the file manually
    const buffer = await readFile(saveAsPath);
    return XLSX.read(buffer, { cellDates: true });
}

type Row = (string | number | Date | undefined)[];

function getSheetRows(workbook: XLSX.WorkBook, sheetName: string): Row[] {
    const sheet = workbook.Sheets[sheetName];
    expect(sheet, `Expected sheet ${sheetName} to exist`).toBeDefined();
    return XLSX.utils.sheet_to_json<Row>(sheet, { header: 1 });
}

/**
 * A sheet starts with a category row above the header row, unless the category row is turned off
 * (which is the case for the export without the settings UI).
 */
function getSheet(workbook: XLSX.WorkBook, sheetName: string, options?: { withCategoryRow?: boolean }): { categories: Row; headers: Row; data: Row[] } {
    const rows = getSheetRows(workbook, sheetName);
    const withCategoryRow = options?.withCategoryRow ?? true;

    return {
        categories: withCategoryRow ? rows[0] : [],
        headers: rows[withCategoryRow ? 1 : 0],
        data: rows.slice(withCategoryRow ? 2 : 1),
    };
}

function getCell(headers: Row, row: Row, header: string): string | number | Date | undefined {
    const index = headers.indexOf(header);
    expect(index, `Expected column ${header} to exist`).toBeGreaterThanOrEqual(0);
    return row[index];
}

/** The columns are grouped per category, so every category has its own 'select all' checkbox. */
async function deselectAllColumns(exportView: Locator) {
    for (const selectAll of await exportView.locator('label.st-list-item').filter({ hasText: 'Alles selecteren' }).all()) {
        await selectAll.getByTestId('checkbox').click();
    }
}

async function selectTab(page: Page, tabId: string) {
    const directTab = page.locator(`[data-testid="tab-button"][data-tab-id="${tabId}"]:visible`).first();
    if (await directTab.count() > 0) {
        await directTab.click();
        return;
    }

    const moreTab = page.locator('[data-testid="tab-button"][data-tab-id="more"]:visible').first();
    await moreTab.click();
    await page.locator(`[data-testid="tab-dropdown-item"][data-tab-id="${tabId}"]:visible`).first().click();
}

test.describe('Webshop order Excel export @webshop-order-export', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test('exports the selected orders with the selected sheets and columns', async ({ browser }) => {
        const organization = await createWebshopOrganization('ExcelExport');
        await enableExcelExportUi(organization);
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Excel export ${WorkerData.id}`,
            productCount: 2,
            paymentMethods: [PaymentMethod.PointOfSale],
        });
        const admin = await createAdmin(organization);

        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginAs({ page: adminPage, user: admin });
        await openWebshopOrders(adminPage, organization, webshop.meta.name);

        // Create two orders via the dashboard
        const ordersView = new WebshopOrdersView(adminPage);
        await ordersView.addOrder({
            firstName: 'Jane',
            lastName: 'Janssens',
            email: 'jane@test.be',
            product: webshop.products[0],
            amount: 2,
            paymentMethod: PaymentMethod.PointOfSale,
        });
        await ordersView.addOrder({
            firstName: 'Bob',
            lastName: 'Peeters',
            email: 'bob@test.be',
            product: webshop.products[1],
            amount: 1,
            paymentMethod: PaymentMethod.PointOfSale,
        });

        const table = new TableHelper(adminPage);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();
        await table.clickAction('Exporteer naar Excel');

        // The export settings view is shown, with a tab per sheet
        const exportView = adminPage.getByTestId('save-view');
        await expect(exportView.getByRole('heading', { name: 'Exporteren naar Excel' })).toBeVisible();
        await expect(exportView.getByRole('button', { name: 'Artikel per lijn' })).toBeVisible();
        await expect(exportView.getByRole('button', { name: 'Bestelling per lijn' })).toBeVisible();
        await expect(exportView.getByRole('button', { name: 'Totalen' })).toBeVisible();

        // The columns are grouped per category (a heading per category), and explained with a description where needed
        await expect(exportView.getByRole('heading', { name: 'Klant', exact: true, level: 2 })).toBeVisible();
        await expect(exportView.getByRole('heading', { name: 'Artikel', exact: true, level: 2 })).toBeVisible();
        await expect(exportView.getByText('De prijs voor één stuk, inclusief de gekozen opties, maar zonder kortingen.')).toBeVisible();

        // Export with the default settings
        let downloadPromise = adminPage.waitForEvent('download');
        await exportView.getByTestId('save-button').click();
        let download = await downloadPromise;
        expect(download.suggestedFilename()).toBe(Formatter.fileSlug(webshop.meta.name) + '.xlsx');

        let workbook = await readWorkbook(download, test.info().outputPath('export-default.xlsx'));

        // The sheet with totals per product combination is not included: there are no combinations
        expect(workbook.SheetNames).toEqual(['Artikel per lijn', 'Bestelling per lijn', 'Totalen']);

        // Sheet with one row per ordered article
        const orderLines = getSheet(workbook, 'Artikel per lijn');
        expect(orderLines.headers).toEqual(expect.arrayContaining(['Bestelnummer', 'Besteldatum', 'Voornaam', 'Achternaam', 'E-mail', 'Aantal', 'Stukprijs', 'Artikel', 'Betaalmethode', 'Betaald', 'Status']));
        expect(orderLines.data).toHaveLength(2); // 2 order lines

        // The category row is written above the headers, and only above the first column of each category
        expect(orderLines.categories[orderLines.headers.indexOf('Bestelnummer')]).toBe('Bestelling');
        expect(orderLines.categories[orderLines.headers.indexOf('Voornaam')]).toBe('Klant');
        expect(orderLines.categories[orderLines.headers.indexOf('Achternaam')]).toBeUndefined();
        expect(orderLines.categories[orderLines.headers.indexOf('Artikel')]).toBe('Artikel');
        expect(orderLines.categories[orderLines.headers.indexOf('Betaalmethode')]).toBe('Betaling en status');

        // The empty columns of the customer (phone, birth day, ...) are removed, and the category is
        // merged over the columns that are left
        expect(orderLines.headers).not.toContain('GSM-nummer');
        const customerMerge = (workbook.Sheets['Artikel per lijn']['!merges'] ?? []).find(merge => merge.s.r === 0 && merge.s.c === orderLines.headers.indexOf('Voornaam'));
        expect(customerMerge, 'Expected the customer category to be merged').toBeDefined();
        expect(customerMerge!.e.c).toBe(orderLines.headers.indexOf('E-mail'));

        const janeLine = orderLines.data.find(row => row.includes('Jane'))!;
        expect(janeLine).toBeDefined();
        expect(getCell(orderLines.headers, janeLine, 'Artikel')).toBe('Product 1');
        expect(getCell(orderLines.headers, janeLine, 'Aantal')).toBe(2);
        expect(getCell(orderLines.headers, janeLine, 'Stukprijs')).toBe(15);
        expect(getCell(orderLines.headers, janeLine, 'E-mail')).toBe('jane@test.be');

        // Sheet with one row per order, with an amount column per product combination
        const orders = getSheet(workbook, 'Bestelling per lijn');
        expect(orders.headers).toEqual(expect.arrayContaining(['Bestelnummer', 'Voornaam', 'Achternaam', 'E-mail', 'Totaal', 'Betaalmethode', 'Betaald', 'Status', 'Product 1', 'Product 2']));
        expect(orders.data).toHaveLength(2); // 2 orders

        // The amount per product combination is grouped in its own category
        expect(orders.categories[orders.headers.indexOf('Product 1')]).toBe('Bestelde artikels');

        // Columns without any data are not included in the file
        expect(orders.headers).not.toContain('GSM-nummer');
        expect(orders.headers).not.toContain('Notities');
        expect(orders.headers).not.toContain('Kortingscode');

        const janeOrder = orders.data.find(row => row.includes('Jane'))!;
        expect(janeOrder).toBeDefined();
        expect(getCell(orders.headers, janeOrder, 'Totaal')).toBe(30);
        expect(getCell(orders.headers, janeOrder, 'Product 1')).toBe(2);
        const bobOrder = orders.data.find(row => row.includes('Bob'))!;
        expect(bobOrder).toBeDefined();
        expect(getCell(orders.headers, bobOrder, 'Product 2')).toBe(1);

        // Sheet with the totals per product
        const totals = getSheet(workbook, 'Totalen');
        expect(totals.headers).toEqual(expect.arrayContaining(['Artikel', 'Totaal']));
        const productOneTotal = totals.data.find(row => row.includes('Product 1'))!;
        expect(productOneTotal).toBeDefined();
        expect(getCell(totals.headers, productOneTotal, 'Totaal')).toBe(2);

        // Export again, but exclude the 'Artikel per lijn' sheet and the last name column
        await table.toggleSelectAllRows();
        await table.clickAction('Exporteer naar Excel');
        await expect(exportView.getByRole('heading', { name: 'Exporteren naar Excel' })).toBeVisible();

        // Deselect all columns of the first sheet ('Artikel per lijn' is selected by default)
        await deselectAllColumns(exportView);

        // Deselect the last name column on the orders sheet, and turn off the category row
        await exportView.getByRole('button', { name: 'Bestelling per lijn' }).click();
        await exportView.locator('label.st-list-item').filter({ hasText: 'Achternaam' }).getByTestId('checkbox').click();
        await exportView.locator('label.st-list-item').filter({ hasText: 'Rij toevoegen met categorienaam' }).getByTestId('checkbox').click();

        downloadPromise = adminPage.waitForEvent('download');
        await exportView.getByTestId('save-button').click();
        download = await downloadPromise;
        workbook = await readWorkbook(download, test.info().outputPath('export-filtered.xlsx'));

        expect(workbook.SheetNames).toEqual(['Bestelling per lijn', 'Totalen']);

        // Without the category row, the headers are on the first row
        const filtered = getSheet(workbook, 'Bestelling per lijn', { withCategoryRow: false });
        expect(filtered.headers).toContain('Voornaam');
        expect(filtered.headers).not.toContain('Achternaam');
        expect(filtered.headers).not.toContain('Klant');

        await adminContext.close();
    });

    test('exports a tickets sheet with the ticket secrets for ticket webshops', async ({ page, browser }) => {
        const organization = await createWebshopOrganization('TicketExport');
        await enableExcelExportUi(organization);
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Ticket export ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        // A customer orders two tickets via the webshop, which generates the tickets
        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1', { count: 2 });
        await flow.goToCheckout();
        await flow.fillCustomer({ firstName: 'Ann', lastName: 'Ticketholder', email: 'ann@test.be' });
        await flow.selectPaymentMethod('plaatse');
        await flow.confirmPayment();
        await flow.expectTicketsDownloadable();

        const tickets = await Ticket.select().where('webshopId', webshop.id).fetch();
        expect(tickets).toHaveLength(2);

        // The admin exports the orders
        const admin = await createAdmin(organization);
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginAs({ page: adminPage, user: admin });
        await openWebshopOrders(adminPage, organization, webshop.meta.name);

        const table = new TableHelper(adminPage);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();
        await table.clickAction('Exporteer naar Excel');

        const exportView = adminPage.getByTestId('save-view');
        await expect(exportView.getByRole('button', { name: 'Tickets' })).toBeVisible();

        const downloadPromise = adminPage.waitForEvent('download');
        await exportView.getByTestId('save-button').click();
        const download = await downloadPromise;
        const workbook = await readWorkbook(download, test.info().outputPath('export-tickets.xlsx'));

        expect(workbook.SheetNames).toContain('Tickets');
        const ticketSheet = getSheet(workbook, 'Tickets');
        expect(ticketSheet.headers).toEqual(expect.arrayContaining(['Bestelnummer', 'Artikel', 'Voornaam', 'Achternaam', 'E-mail', 'Nummer', 'Prijs', 'Geheime code', 'Link']));
        expect(ticketSheet.data).toHaveLength(2); // 2 tickets

        // The secret and the link are grouped in a QR-code category
        expect(ticketSheet.categories[ticketSheet.headers.indexOf('Geheime code')]).toBe('QR-code');
        expect(ticketSheet.categories[ticketSheet.headers.indexOf('Artikel')]).toBe('Ticket');

        for (const ticket of tickets) {
            const row = ticketSheet.data.find(r => r.includes(ticket.secret))!;
            expect(row, `Expected a row for ticket ${ticket.secret}`).toBeDefined();
            expect(getCell(ticketSheet.headers, row, 'Artikel')).toBe('Product 1');
            expect(getCell(ticketSheet.headers, row, 'Voornaam')).toBe('Ann');
            expect(getCell(ticketSheet.headers, row, 'Achternaam')).toBe('Ticketholder');
            expect(getCell(ticketSheet.headers, row, 'E-mail')).toBe('ann@test.be');
            expect(getCell(ticketSheet.headers, row, 'Prijs')).toBe(15);
            expect(getCell(ticketSheet.headers, row, 'Link')).toContain('/tickets/' + ticket.secret);
        }

        await adminContext.close();
    });

    test('exports immediately without settings UI and without tickets sheet when the feature flag is off', async ({ page, browser }) => {
        const organization = await createWebshopOrganization('LegacyExport');
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Legacy export ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        // A customer orders a ticket via the webshop, so the webshop has tickets
        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');
        await flow.goToCheckout();
        await flow.fillCustomer({ firstName: 'Ann', lastName: 'Ticketholder', email: 'ann@test.be' });
        await flow.selectPaymentMethod('plaatse');
        await flow.confirmPayment();
        await flow.expectTicketsDownloadable();

        const admin = await createAdmin(organization);
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginAs({ page: adminPage, user: admin });
        await openWebshopOrders(adminPage, organization, webshop.meta.name);

        const table = new TableHelper(adminPage);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();

        // The download starts immediately after clicking the action: no settings view is shown
        const downloadPromise = adminPage.waitForEvent('download');
        await table.clickAction('Exporteer naar Excel');
        const download = await downloadPromise;
        await expect(adminPage.getByTestId('save-view')).toHaveCount(0);

        const workbook = await readWorkbook(download, test.info().outputPath('export-legacy.xlsx'));

        // All sheets are included, except the tickets sheet
        expect(workbook.SheetNames).toEqual(['Artikel per lijn', 'Bestelling per lijn', 'Totalen']);

        // All columns are included, without a category row: the headers are on the first row
        const legacyOrders = getSheet(workbook, 'Bestelling per lijn', { withCategoryRow: false });
        expect(legacyOrders.headers).toEqual(expect.arrayContaining(['Bestelnummer', 'Voornaam', 'Achternaam', 'E-mail', 'Totaal', 'Betaalmethode', 'Betaald', 'Status', 'Product 1']));
        expect(legacyOrders.headers).not.toContain('Klant');
        expect(legacyOrders.data).toHaveLength(1); // 1 order

        const annOrder = legacyOrders.data.find(row => row.includes('Ann'))!;
        expect(annOrder).toBeDefined();
        expect(getCell(legacyOrders.headers, annOrder, 'Totaal')).toBe(15);

        // The organization enables the feature flag via the checkbox in the Labs settings
        await selectTab(adminPage, 'settings');
        await adminPage.getByText('Experimenten', { exact: true }).first().click();

        const labsView = adminPage.locator('div.popup.focused').last().getByTestId('save-view');
        await labsView.getByTestId('webshop-orders-excel-export-ui-checkbox').getByTestId('checkbox').click();
        await labsView.getByTestId('save-button').click();
        await expect(adminPage.getByTestId('save-view')).toHaveCount(0);

        // The export now shows the settings UI, with the tickets sheet
        await openWebshopOrders(adminPage, organization, webshop.meta.name);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();
        await table.clickAction('Exporteer naar Excel');

        const exportView = adminPage.getByTestId('save-view');
        await expect(exportView.getByRole('heading', { name: 'Exporteren naar Excel' })).toBeVisible();
        await expect(exportView.getByRole('button', { name: 'Tickets' })).toBeVisible();

        await adminContext.close();
    });
});
