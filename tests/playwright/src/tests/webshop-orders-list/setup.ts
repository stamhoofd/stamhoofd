import type { Browser, BrowserContext, Page } from '@playwright/test';
import { devices } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { User, Webshop } from '@stamhoofd/models';
import { Organization, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/structures/PermissionLevel.js';
import { Permissions } from '@stamhoofd/structures/Permissions.js';
import { Token as TokenStruct } from '@stamhoofd/structures/Token.js';
import { Version } from '@stamhoofd/structures/Version.js';
import { STPackageBundle } from '@stamhoofd/structures/billing/STPackageBundle.js';
import { OrderStatus } from '@stamhoofd/structures/webshops/Order.js';
import { WebshopTicketType } from '@stamhoofd/structures/webshops/WebshopMetaData.js';
import { BackendOrders, DashboardPage, DashboardTab, WorkerData } from '../../helpers/index.js';
import { TestWebshops } from '../../helpers/test-data/TestWebshops.js';
import { OrdersTable } from '../../helpers/page/webshop/OrdersTable.js';

export const statusNames: Record<OrderStatus, string> = {
    [OrderStatus.Created]: 'Nieuw',
    [OrderStatus.Prepared]: 'Verwerkt',
    [OrderStatus.Collect]: 'Ligt klaar',
    [OrderStatus.Completed]: 'Voltooid',
    [OrderStatus.Canceled]: 'Geannuleerd',
    [OrderStatus.Deleted]: 'Verwijderd',
};

/**
 * The devices the orders list is tested on: the table switches to a different layout and scroll element on small screens.
 */
export const testDevices = {
    desktop: devices['Desktop Chrome'],
    phone: devices['iPhone 13'],
    tablet: devices['iPad Mini'],
};

export type TestDevice = keyof typeof testDevices;

export interface OrdersListWebshop {
    organization: Organization;
    admin: User;
    webshop: Webshop;
}

export async function createOrdersListWebshop(prefix: string, options: { ticketType?: WebshopTicketType } = {}): Promise<OrdersListWebshop> {
    const created = await new OrganizationFactory({
        name: `${prefix}${WorkerData.id}`,
        // A worker can run several tests of a file before its database is reset
        uri: `${prefix.toLowerCase()}-${WorkerData.id}-${crypto.randomUUID()}`,
        packages: [STPackageBundle.Webshops],
    }).create();
    await STPackageService.updateOrganizationPackages(created.id);
    const organization = (await Organization.getByID(created.id))!;

    const { webshop } = await TestWebshops.create({
        organization,
        name: `${prefix} ${WorkerData.id}`,
        ticketType: options.ticketType ?? WebshopTicketType.None,
        productCount: 1,
        cartEnabled: false,
    });

    const admin = await new UserFactory({
        email: `admin-${prefix.toLowerCase()}-${WorkerData.id}-${Date.now()}@test.be`,
        organization,
        permissions: Permissions.create({ level: PermissionLevel.Full }),
    }).create();

    return { organization, admin, webshop };
}

/**
 * Opens the orders table of the webshop in a new browser context (its own local order database).
 */
export async function openOrdersList(browser: Browser, shop: OrdersListWebshop, device: TestDevice = 'desktop', options: { beforeOpen?: (page: Page) => Promise<unknown>; waitForFirstRow?: boolean } = {}): Promise<{ context: BrowserContext; page: Page; table: OrdersTable; backend: BackendOrders }> {
    // The dashboard picks dates in Belgian time, like its users
    const context = await browser.newContext({ ...testDevices[device], timezoneId: 'Europe/Brussels' });
    await login(context, shop);
    const page = await context.newPage();
    await options.beforeOpen?.(page);
    const table = await openOrdersTable(page, shop, options.waitForFirstRow ?? true);
    return { context, page, table, backend: new BackendOrders(page, shop.organization, shop.admin) };
}

/**
 * Opens the orders table in another tab of the same browser context: it shares the local order database.
 */
export async function openOrdersTab(context: BrowserContext, shop: OrdersListWebshop): Promise<{ page: Page; table: OrdersTable }> {
    const page = await context.newPage();
    const table = await openOrdersTable(page, shop);
    return { page, table };
}

async function openOrdersTable(page: Page, shop: OrdersListWebshop, waitForFirstRow = true): Promise<OrdersTable> {
    const dashboard = new DashboardPage(page);
    await dashboard.openOrganizationDashboard({ organizationUri: shop.organization.uri });
    await dashboard.openTab(DashboardTab.Webshops);
    await page.getByTestId('webshop-menu-item').filter({ hasText: shop.webshop.meta.name }).click();
    await page.getByTestId('open-orders-button').click();

    const table = new OrdersTable(page);
    if (waitForFirstRow) {
        await table.waitForFirstRow();
    }
    return table;
}

async function login(context: BrowserContext, shop: OrdersListWebshop) {
    const token = await SessionService.createSession(shop.admin);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    await context.addInitScript(({ key, tokenString }) => {
        if (!window.localStorage.getItem(key)) {
            window.localStorage.setItem(key, tokenString);
        }
    }, { key: 'token-' + shop.organization.id, tokenString });
}
