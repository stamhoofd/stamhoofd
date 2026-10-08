// test should always be imported first
import { test, setup } from '../test-fixtures/platform.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { devices, expect } from '@playwright/test';
import type {
    Organization,
    RegistrationPeriod,
    User,
    Webshop,
} from '@stamhoofd/models';
import {
    OrderFactory,
    OrganizationFactory,
    RegistrationPeriodFactory,
    Ticket,
    TicketFactory,
} from '@stamhoofd/models';
import { PaymentMethod, PermissionLevel, Permissions, PropertyFilter, UserPermissions, WebshopTicketType } from '@stamhoofd/structures';
import {
    DashboardPage,
    DashboardTab,
    TableHelper,
    WorkerData,
} from '../helpers/index.js';
import { installFakeCamera, showQRCodeToCamera } from '../helpers/fakeCamera.js';
import { clickEvenIfCoveredByToast, hasCompletedTicketSync, readOfflineDatabase } from '../helpers/page/webshop/TicketScannerDevice.js';
import { WebshopOrdersView } from '../helpers/page/webshop/WebshopOrdersView.js';
import { simulateNetworkOffline } from '../helpers/simulateNetworkOffline.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

test.describe('Webshops offline', () => {
    let organization: Organization;
    let period: RegistrationPeriod;
    let user: User;
    let webshop: Webshop;

    test.beforeAll(async () => {
        user = WorkerData.user;
        user.permissions = UserPermissions.create({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        });
        await user.save();

        organization = await new OrganizationFactory({
            name: `Vereniging${WorkerData.id}`,
        }).create();

        organization.meta.recordsConfiguration.financialSupport = true;
        organization.meta.recordsConfiguration.uitpasNumber
                = new PropertyFilter(null, null);
        await organization.save();

        period = await new RegistrationPeriodFactory({
            startDate: new Date('2000-01-01'),
            endDate: new Date('2001-01-01'),
            organization,
        }).create();

        organization.periodId = period.id;
        await organization.save();

        // webshop
        webshop = (await TestWebshops.webshopWithTicketsAndSeatingPlan({ organization, seatCount: 35 })).webshop;
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    /**
     * Tests that depend on the number of orders and tickets use their own webshop, because tests in the same worker share the database.
     */
    async function createTicketWebshop(name: string) {
        const { webshop } = await TestWebshops.create({
            organization,
            ticketType: WebshopTicketType.SingleTicket,
            name: `${name} ${WorkerData.id}`,
        });
        return webshop;
    }

    test('Should be able to manually scan order if no internet', async ({ browser, storageState }) => {
        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        test.setTimeout(120_000);

        const page = await context.newPage();
        const dashboard = new DashboardPage(page);

        await test.step('place orders while online', async () => {
            // await dashboard.goto();
            await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
            await dashboard.openTab(DashboardTab.Webshops);

            // open webshop overview
            await page.getByTestId(`webshop-menu-item`)
                .filter({ hasText: webshop.meta.name })
                .click();

            // open orders
            await page.getByTestId('open-orders-button').click();

            // add order
            const ordersView = new WebshopOrdersView(page);
            await ordersView.waitForFirstRow();

            // place some orders
            const ordersCount = 1;

            for (let i = 0; i < ordersCount; i++) {
                await ordersView.addOrder({
                    firstName: 'John',
                    lastName: 'Doe-' + i,
                    email: `john.doe-${i}@test.be`,
                    product: webshop.products[0],
                    // point of sale to make sure tickets are added immediately
                    paymentMethod: PaymentMethod.PointOfSale,
                });
            }
        });

        // go to start
        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });

        // mock offline behaviour
        await simulateNetworkOffline(page);

        await test.step('open webshop orders', async () => {
            await dashboard.openTab(DashboardTab.Webshops);

            await page.getByTestId(`webshop-menu-item`)
                .filter({ hasText: webshop.meta.name })
                .click();

            // open orders
            await page.getByTestId('open-orders-button').click();
        });

        const table = new TableHelper(page);

        await test.step('open order detail', async () => {
            // make sure the webshop is offline
            await expect(table.getOfflineIcon()).toBeVisible();

            const row = table.getRow('John Doe-0');
            await row.click();

            const orderView = page.getByTestId('order-view');

            // should be able to see correct details, such as the email
            await expect(orderView).toContainText('john.doe-0@test.be');
        });

        await test.step('open ticket', async () => {
            const ticketsButton = page.getByTestId('tickets-button');
            await ticketsButton.click();

            const ticketRow = page.getByTestId('ticket-row');
            await ticketRow.click();

            const validTicketView = page.getByTestId('valid-ticket-view');
            await expect(validTicketView).toContainText($t('%WA'));
        });

        await test.step('scan ticket manually', async () => {
            const scanButton = page.getByTestId('scan-button');
            await scanButton.click();

            // click ticket again
            const ticketRow = page.getByTestId('ticket-row');
            await ticketRow.click();

            const ticketAlreadyScannedView = page.getByTestId('ticket-already-scanned-view');
            await expect(ticketAlreadyScannedView).toBeVisible();
        });

        await test.step('go back to webshop overview', async () => {
            // close already scanned view
            await page.getByTestId('close-button').first().click();

            await page.getByTestId('order-tickets-view').waitFor();
            // close order tickets view
            await page.getByTestId('close-button').first().click();

            await page.getByTestId('order-view').waitFor();
            // close order view
            await page.getByTestId('close-button').first().click();

            await page.getByTestId('table').waitFor();
            // close webshop orders view
            await page.locator('.button.navigation').first().click();
        });

        await test.step('open ticket scanner', async () => {
            const scanTicketsButton = page.getByTestId('scan-tickets-button');
            await scanTicketsButton.click();

            const startScanTicketsButton = page.getByTestId('start-scan-tickets-button');
            await clickEvenIfCoveredByToast(page, startScanTicketsButton);

            // should show message if offline
            await expect(page.getByTestId('ticket-scanner-view')).toContainText($t('%Vq'));
        });
    });

    test('Should not show download progress for a small first download', async ({ browser, storageState }) => {
        const testWebshop = await createTicketWebshop('Kleine download');
        const order = await new OrderFactory({ webshop: testWebshop }).create();
        await new TicketFactory({ order }).create();

        // A new context has an empty IndexedDB, so nothing was synced on this device yet
        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        const page = await context.newPage();
        const dashboard = new DashboardPage(page);

        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await page.evaluate(() => {
            (window as any).hasShownProgress = false;
            new MutationObserver(() => {
                if (document.querySelector('[data-testid="ticket-scanner-setup-catching-up"], [data-testid="ticket-scanner-catching-up"]')) {
                    (window as any).hasShownProgress = true;
                }
            }).observe(document.body, { subtree: true, childList: true });
        });

        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item')
            .filter({ hasText: testWebshop.meta.name })
            .click();
        await page.getByTestId('scan-tickets-button').click();
        await clickEvenIfCoveredByToast(page, page.getByTestId('start-scan-tickets-button'));
        await expect(page.getByTestId('ticket-scanner-view')).toContainText($t('%Vt'));

        expect(await page.evaluate(() => (window as any).hasShownProgress as boolean)).toBe(false);
    });

    test('Should warn that tickets are not downloaded if the first sync fails', async ({ browser, storageState }) => {
        // A new context has an empty IndexedDB, so nothing was synced on this device yet
        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        const page = await context.newPage();
        const dashboard = new DashboardPage(page);

        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await simulateNetworkOffline(page);

        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item')
            .filter({ hasText: webshop.meta.name })
            .click();

        await page.getByTestId('scan-tickets-button').click();
        await clickEvenIfCoveredByToast(page, page.getByTestId('start-scan-tickets-button'));

        await expect(page.getByTestId('ticket-scanner-view')).toContainText($t('%Ztp'));
    });

    test('Should show download progress when catching up on many new tickets', async ({ browser, storageState }) => {
        const testWebshop = await createTicketWebshop('Inhalen');
        test.setTimeout(120_000);

        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        const page = await context.newPage();
        const dashboard = new DashboardPage(page);
        const scannerView = page.getByTestId('ticket-scanner-view');

        async function openTicketScannerSetup() {
            await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
            await dashboard.openTab(DashboardTab.Webshops);
            await page.getByTestId('webshop-menu-item')
                .filter({ hasText: testWebshop.meta.name })
                .click();
            await page.getByTestId('scan-tickets-button').click();
        }

        await test.step('download the existing tickets', async () => {
            const order = await new OrderFactory({ webshop: testWebshop }).create();
            await new TicketFactory({ order }).create();

            await openTicketScannerSetup();
            await clickEvenIfCoveredByToast(page, page.getByTestId('start-scan-tickets-button'));
            await expect(scannerView).toContainText($t('%Vt'));
        });

        // More than one page of new tickets
        const order = await new OrderFactory({ webshop: testWebshop }).create();
        const updatedAt = new Date();
        for (let i = 0; i < 150; i++) {
            await new TicketFactory({ order, index: i + 1, total: 150, updatedAt }).create();
        }

        let releaseNextPages!: () => void;
        const nextPagesReleased = new Promise<void>((resolve) => {
            releaseNextPages = resolve;
        });
        await page.route(url => url.pathname.endsWith('/webshop/tickets/private') && url.searchParams.has('pageFilter'), async (route) => {
            await nextPagesReleased;
            await route.continue();
        });

        await test.step('show progress while catching up', async () => {
            await openTicketScannerSetup();
            await expect(page.getByTestId('ticket-scanner-setup-catching-up').getByRole('progressbar')).toHaveAttribute('aria-valuenow', /\d+/);

            await clickEvenIfCoveredByToast(page, page.getByTestId('start-scan-tickets-button'));
            await expect(page.getByTestId('ticket-scanner-catching-up').getByRole('progressbar')).toHaveAttribute('aria-valuenow', /\d+/);
        });

        await test.step('hide progress once caught up', async () => {
            releaseNextPages();
            await expect(scannerView).toContainText($t('%Vt'));
            await expect(page.getByTestId('ticket-scanner-catching-up')).toHaveCount(0);
        });
    });

    test('Should not show download progress when only re-fetching recently downloaded tickets', async ({ browser, storageState }) => {
        const testWebshop = await createTicketWebshop('Opnieuw ophalen');
        test.setTimeout(120_000);

        // More than one page of tickets updated in the same second, which every sync within the
        // watermark safety margin fetches again
        const order = await new OrderFactory({ webshop: testWebshop }).create();
        const updatedAt = new Date();
        for (let i = 0; i < 150; i++) {
            await new TicketFactory({ order, index: i + 1, total: 150, updatedAt }).create();
        }

        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        const page = await context.newPage();
        const dashboard = new DashboardPage(page);

        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item')
            .filter({ hasText: testWebshop.meta.name })
            .click();
        await page.getByTestId('scan-tickets-button').click();

        await test.step('download all tickets on the setup page', async () => {
            await expect.poll(async () => hasCompletedTicketSync(page, testWebshop.id)).toBe(true);
        });

        let releaseNextPages!: () => void;
        const nextPagesReleased = new Promise<void>((resolve) => {
            releaseNextPages = resolve;
        });
        await page.route(url => url.pathname.endsWith('/webshop/tickets/private') && url.searchParams.has('pageFilter'), async (route) => {
            await nextPagesReleased;
            await route.continue();
        });

        await test.step('open the scanner while the re-fetch is running', async () => {
            const nextPageRequested = page.waitForRequest(request => new URL(request.url()).searchParams.has('pageFilter'));
            await clickEvenIfCoveredByToast(page, page.getByTestId('start-scan-tickets-button'));
            await nextPageRequested;

            // Let Vue render the progress state, if any
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
            await expect(page.getByTestId('ticket-scanner-view')).toContainText($t('%Vp'));
            await expect(page.getByTestId('ticket-scanner-catching-up')).toHaveCount(0);
        });

        releaseNextPages();
    });

    test('Should show one increasing download progress for orders and tickets', async ({ browser, storageState }) => {
        const testWebshop = await createTicketWebshop('Stijgende voortgang');
        test.setTimeout(120_000);

        const ticketOrder = await new OrderFactory({ webshop: testWebshop }).create();
        const updatedAt = new Date();
        for (let i = 0; i < 150; i++) {
            await new TicketFactory({ order: ticketOrder, index: i + 1, total: 150, updatedAt }).create();
        }
        for (let i = 0; i < 150; i++) {
            await new OrderFactory({ webshop: testWebshop }).create();
        }

        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        const page = await context.newPage();
        const dashboard = new DashboardPage(page);

        // Let the tickets finish before the orders report any progress
        let releaseOrders!: () => void;
        const ordersReleased = new Promise<void>((resolve) => {
            releaseOrders = resolve;
        });
        await page.route(url => url.pathname.endsWith('/webshop/orders') && !url.searchParams.has('pageFilter'), async (route) => {
            await ordersReleased;
            await route.continue();
        });

        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await page.evaluate(() => {
            const percentages: number[] = [];
            (window as any).shownPercentages = percentages;
            new MutationObserver(() => {
                const value = document.querySelector('[data-testid="ticket-scanner-setup-catching-up"] [role="progressbar"]')?.getAttribute('aria-valuenow');
                if (value && Number(value) !== percentages[percentages.length - 1]) {
                    percentages.push(Number(value));
                }
            }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-valuenow'] });
        });

        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item')
            .filter({ hasText: testWebshop.meta.name })
            .click();

        const ticketsDownloaded = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/webshop/tickets/private') && new URL(response.url()).searchParams.has('pageFilter'));
        await page.getByTestId('scan-tickets-button').click();
        await ticketsDownloaded;

        const ordersDownloaded = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/webshop/orders') && new URL(response.url()).searchParams.has('pageFilter'));
        releaseOrders();
        await ordersDownloaded;

        await expect(page.getByTestId('ticket-scanner-setup-catching-up')).toHaveCount(0);

        const shownPercentages = await page.evaluate(() => (window as any).shownPercentages as number[]);
        expect(shownPercentages.length).toBeGreaterThan(0);
        expect(shownPercentages).toEqual([...shownPercentages].sort((a, b) => a - b));
    });

    test('Should show the progress of a download that started outside the ticket scanner', async ({ browser, storageState }) => {
        const testWebshop = await createTicketWebshop('Gedeelde download');
        const order = await new OrderFactory({ webshop: testWebshop }).create();
        const updatedAt = new Date();
        for (let i = 0; i < 150; i++) {
            await new TicketFactory({ order, index: i + 1, total: 150, updatedAt }).create();
        }

        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        const page = await context.newPage();
        const dashboard = new DashboardPage(page);

        let releaseNextPages!: () => void;
        const nextPagesReleased = new Promise<void>((resolve) => {
            releaseNextPages = resolve;
        });
        await page.route(url => url.pathname.endsWith('/webshop/tickets/private') && url.searchParams.has('pageFilter'), async (route) => {
            await nextPagesReleased;
            await route.continue();
        });

        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item')
            .filter({ hasText: testWebshop.meta.name })
            .click();

        await test.step('start the download from the orders list', async () => {
            const nextPageRequested = page.waitForRequest(request => new URL(request.url()).pathname.endsWith('/webshop/tickets/private') && new URL(request.url()).searchParams.has('pageFilter'));
            await page.getByTestId('open-orders-button').click();
            await nextPageRequested;
            await page.locator('.button.navigation').first().click();
        });

        await test.step('show its progress on the ticket scanner setup page', async () => {
            await page.getByTestId('scan-tickets-button').click();
            await expect(page.getByTestId('ticket-scanner-setup-catching-up').getByRole('progressbar')).toHaveAttribute('aria-valuenow', /\d+/);

            releaseNextPages();
            await expect(page.getByTestId('ticket-scanner-setup-catching-up')).toHaveCount(0);
        });
    });

    test('Should treat a downloaded webshop without tickets as downloaded', async ({ browser, storageState }) => {
        const testWebshop = await createTicketWebshop('Zonder tickets');

        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        const page = await context.newPage();
        const dashboard = new DashboardPage(page);
        const scannerView = page.getByTestId('ticket-scanner-view');

        async function openTicketScanner() {
            await dashboard.openTab(DashboardTab.Webshops);
            await page.getByTestId('webshop-menu-item')
                .filter({ hasText: testWebshop.meta.name })
                .click();
            await page.getByTestId('scan-tickets-button').click();
            await clickEvenIfCoveredByToast(page, page.getByTestId('start-scan-tickets-button'));
        }

        await test.step('download while online', async () => {
            await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
            await openTicketScanner();
            await expect(scannerView).toContainText($t('%Vt'));
        });

        await test.step('show the regular offline message', async () => {
            await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
            await simulateNetworkOffline(page);
            await openTicketScanner();
            await expect(scannerView).toContainText($t('%Vq'));
        });
    });

    test('Should resume an interrupted download after a reload', async ({ browser, storageState }) => {
        test.setTimeout(120_000);

        const testWebshop = await createTicketWebshop('Hervatten');
        const order = await new OrderFactory({ webshop: testWebshop }).create();
        // Different seconds, so resuming does not start with the tickets of the first page again
        const firstUpdatedAt = Date.now() - 24 * 60 * 60 * 1000;
        for (let i = 0; i < 250; i++) {
            await new TicketFactory({ order, index: i + 1, total: 250, updatedAt: new Date(firstUpdatedAt + i * 1000) }).create();
        }

        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        const page = await context.newPage();
        const dashboard = new DashboardPage(page);

        async function openTicketScannerSetup() {
            await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
            await dashboard.openTab(DashboardTab.Webshops);
            await page.getByTestId('webshop-menu-item')
                .filter({ hasText: testWebshop.meta.name })
                .click();
            await page.getByTestId('scan-tickets-button').click();
        }

        function isTicketsRequest(url: URL, { nextPage }: { nextPage: boolean }) {
            return url.pathname.endsWith('/webshop/tickets/private') && url.searchParams.has('pageFilter') === nextPage;
        }

        await test.step('interrupt the download after the first page', async () => {
            // Never answered, so the download stops after the first page
            await page.route(url => isTicketsRequest(url, { nextPage: true }), () => {});
            await openTicketScannerSetup();
            await expect.poll(async () => readOfflineDatabase(page, testWebshop.id, 'tickets')).toBe(100);
            await expect.poll(async () => readOfflineDatabase(page, testWebshop.id, 'settings', 'lastFetchedTicket')).toBeTruthy();
            expect(await hasCompletedTicketSync(page, testWebshop.id)).toBe(false);
            await page.unrouteAll({ behavior: 'ignoreErrors' });
        });

        await test.step('resume after the stored tickets when reloading', async () => {
            const firstRequest = page.waitForRequest(request => isTicketsRequest(new URL(request.url()), { nextPage: false }));
            await openTicketScannerSetup();

            const filter = JSON.parse(new URL((await firstRequest).url()).searchParams.get('filter')!) as { updatedAt?: unknown };
            expect(filter.updatedAt).toBeDefined();

            await expect.poll(async () => hasCompletedTicketSync(page, testWebshop.id)).toBe(true);
            expect(await readOfflineDatabase(page, testWebshop.id, 'tickets')).toBe(250);
        });
    });

    test('Should scan a ticket that is not downloaded yet and save the scan once back online', async ({ browser, storageState }) => {
        test.setTimeout(120_000);

        const testWebshop = await createTicketWebshop('Los ticket');
        const order = await new OrderFactory({ webshop: testWebshop }).create();
        const firstPageUpdatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
        for (let i = 0; i < 100; i++) {
            await new TicketFactory({ order, index: i + 1, total: 101, updatedAt: firstPageUpdatedAt }).create();
        }
        // Updated last, so the download only reaches it on the second page
        const ticket = await new TicketFactory({ order, index: 101, total: 101, updatedAt: new Date(Date.now() - 60 * 60 * 1000) }).create();

        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        const page = await context.newPage();
        await installFakeCamera(page);
        const dashboard = new DashboardPage(page);

        let releaseNextPages!: () => void;
        const nextPagesReleased = new Promise<void>((resolve) => {
            releaseNextPages = resolve;
        });
        await page.route(url => url.pathname.endsWith('/webshop/tickets/private') && url.searchParams.has('pageFilter'), async (route) => {
            await nextPagesReleased;
            await route.continue();
        });

        await test.step('scan the ticket while it is not downloaded yet', async () => {
            await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
            await dashboard.openTab(DashboardTab.Webshops);
            await page.getByTestId('webshop-menu-item')
                .filter({ hasText: testWebshop.meta.name })
                .click();
            await page.getByTestId('scan-tickets-button').click();
            await clickEvenIfCoveredByToast(page, page.getByTestId('start-scan-tickets-button'));
            await expect(page.getByTestId('ticket-scanner-catching-up')).toBeVisible();

            await showQRCodeToCamera(page, `https://example.com/tickets/${ticket.secret}`);
            await expect(page.getByTestId('valid-ticket-view')).toBeVisible();
            await showQRCodeToCamera(page, null);
        });

        await test.step('mark it as scanned without internet', async () => {
            await simulateNetworkOffline(page);
            await page.getByTestId('scan-button').click();
            await expect.poll(async () => readOfflineDatabase(page, testWebshop.id, 'ticketPatches')).toBe(1);
        });

        await test.step('keep the scan when the download reaches the ticket', async () => {
            releaseNextPages();
            await expect.poll(async () => hasCompletedTicketSync(page, testWebshop.id)).toBe(true);
            expect(await readOfflineDatabase(page, testWebshop.id, 'tickets')).toBe(101);
            expect(await readOfflineDatabase(page, testWebshop.id, 'ticketPatches')).toBe(1);
        });

        await test.step('save the scan once back online', async () => {
            await page.unrouteAll({ behavior: 'ignoreErrors' });
            // The scanner retries saving scans every 30 seconds
            await expect.poll(async () => (await Ticket.getByID(ticket.id))?.scannedAt ?? null, { timeout: 45_000 }).not.toBeNull();
            await expect.poll(async () => readOfflineDatabase(page, testWebshop.id, 'ticketPatches')).toBe(0);
        });
    });

    test('Should scan a ticket that was sold after the download', async ({ browser, storageState }) => {
        const testWebshop = await createTicketWebshop('Later verkocht');
        await new TicketFactory({ order: await new OrderFactory({ webshop: testWebshop }).create() }).create();

        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        const page = await context.newPage();
        await installFakeCamera(page);
        const dashboard = new DashboardPage(page);

        await test.step('download all tickets', async () => {
            await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
            await dashboard.openTab(DashboardTab.Webshops);
            await page.getByTestId('webshop-menu-item')
                .filter({ hasText: testWebshop.meta.name })
                .click();
            await page.getByTestId('scan-tickets-button').click();
            await clickEvenIfCoveredByToast(page, page.getByTestId('start-scan-tickets-button'));
            await expect(page.getByTestId('ticket-scanner-view')).toContainText($t('%Vt'));
        });

        await test.step('reject an unknown ticket', async () => {
            await showQRCodeToCamera(page, 'https://example.com/tickets/unknown-secret');
            await expect(page.locator('.toast-view')).toContainText($t('Ongeldig ticket'));
            await showQRCodeToCamera(page, null);
        });

        await test.step('recognize a ticket sold after the download', async () => {
            const ticket = await new TicketFactory({ order: await new OrderFactory({ webshop: testWebshop }).create() }).create();
            await showQRCodeToCamera(page, `https://example.com/tickets/${ticket.secret}`);
            await expect(page.getByTestId('valid-ticket-view')).toBeVisible();
        });
    });

    test('Should keep a download of an older version', async ({ browser, storageState }) => {
        const testWebshop = await createTicketWebshop('Oudere versie');
        const order = await new OrderFactory({ webshop: testWebshop }).create();
        await new TicketFactory({ order }).create();

        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        const page = await context.newPage();
        const dashboard = new DashboardPage(page);
        const scannerView = page.getByTestId('ticket-scanner-view');

        async function openTicketScanner() {
            await dashboard.openTab(DashboardTab.Webshops);
            await page.getByTestId('webshop-menu-item')
                .filter({ hasText: testWebshop.meta.name })
                .click();
            await page.getByTestId('scan-tickets-button').click();
            await clickEvenIfCoveredByToast(page, page.getByTestId('start-scan-tickets-button'));
        }

        await test.step('download with an older version', async () => {
            await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
            await openTicketScanner();
            await expect.poll(async () => readOfflineDatabase(page, testWebshop.id, 'settings', 'ticketsLastSyncedAt')).toBeTruthy();
            await expect.poll(async () => readOfflineDatabase(page, testWebshop.id, 'settings', 'ordersLastSyncedAt')).toBeTruthy();
            await storeSyncStateOfOlderVersion(page, testWebshop.id);
        });

        await test.step('treat it as downloaded when offline', async () => {
            await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
            await simulateNetworkOffline(page);
            await openTicketScanner();
            await expect(scannerView).toContainText($t('%Vq'));
            await expect(scannerView).not.toContainText('nooit');
            await page.unrouteAll({ behavior: 'ignoreErrors' });
        });

        await test.step('only fetch updated tickets when online', async () => {
            const firstRequest = page.waitForRequest(request => new URL(request.url()).pathname.endsWith('/webshop/tickets/private'));
            await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
            await openTicketScanner();

            const filter = JSON.parse(new URL((await firstRequest).url()).searchParams.get('filter')!) as { updatedAt?: unknown };
            expect(filter.updatedAt).toBeDefined();
            await expect(scannerView).toContainText($t('%Vt'));
        });
    });
});

/**
 * Rewrites the stored sync state to what versions without sync completed flags stored after a completed sync.
 */
async function storeSyncStateOfOlderVersion(page: Page, webshopId: string) {
    await page.evaluate(async id => new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('webshop-' + id);
        open.onerror = () => reject(new Error('Could not open the offline database'));
        open.onsuccess = () => {
            const database = open.result;
            const transaction = database.transaction('settings', 'readwrite');
            const settings = transaction.objectStore('settings');
            for (const key of ['ordersSyncCompleted', 'ticketsSyncCompleted', 'ordersLastSyncedAt', 'ticketsLastSyncedAt']) {
                settings.delete(key);
            }
            for (const key of ['lastFetchedOrder', 'lastFetchedTicket']) {
                const request = settings.get(key);
                request.onsuccess = () => {
                    const cursor = request.result as { updatedAt: Date; itemUpdatedAt?: Date } | null | undefined;
                    if (cursor) {
                        settings.put({ updatedAt: cursor.updatedAt, id: 'older-version' }, key);
                    }
                };
            }
            transaction.oncomplete = () => {
                database.close();
                resolve();
            };
            transaction.onerror = () => reject(new Error('Could not store the sync state'));
        };
    }), webshopId);
}
