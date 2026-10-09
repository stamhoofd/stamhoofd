// test should always be imported first
import { setup, test } from '../test-fixtures/platform.js';
setup();

// other imports
import { expect } from '@playwright/test';
import type { Organization, User, Webshop } from '@stamhoofd/models';
import { Order, OrderFactory, OrganizationFactory, RegistrationPeriodFactory, Ticket, TicketFactory, UserFactory } from '@stamhoofd/models';
import { AccessRight, Cart, CartItem, Customer, OrderData, OrderStatus, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, UserPermissions, WebshopTicketType } from '@stamhoofd/structures';
import { WorkerData } from '../helpers/index.js';
import { getTicketUrl, isTicketLookup, TicketScannerDevice, toOfflineTickets } from '../helpers/page/webshop/TicketScannerDevice.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

// Tagged @extra so it is excluded from the default (CI) run. Run it with: pnpm stam test e2e --extra --grep @ticket-scanner
test.describe('Ticket scanner @ticket-scanner @extra', () => {
    let organization: Organization;
    let user: User;

    test.beforeAll(async () => {
        user = WorkerData.user;
        user.permissions = UserPermissions.create({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        });
        await user.save();

        organization = await new OrganizationFactory({
            name: `Vereniging${WorkerData.id}`,
        }).create();

        const period = await new RegistrationPeriodFactory({
            startDate: new Date('2000-01-01'),
            endDate: new Date('2001-01-01'),
            organization,
        }).create();

        organization.periodId = period.id;
        await organization.save();
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    /**
     * Each test uses its own webshop, because tests in the same worker share the database.
     */
    async function createTicketWebshop(name: string) {
        const { webshop } = await TestWebshops.create({
            organization,
            ticketType: WebshopTicketType.SingleTicket,
            name: `${name} ${WorkerData.id}`,
        });
        return webshop;
    }

    async function createTicket(webshop: Webshop, options: { updatedAt?: Date } = {}) {
        const order = await new OrderFactory({ webshop }).create();
        return await new TicketFactory({ order, ...options }).create();
    }

    /**
     * Creates tickets that need more than one page to download
     */
    async function createManyTickets(webshop: Webshop, count: number) {
        const order = await new OrderFactory({ webshop }).create();
        const updatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const tickets: Ticket[] = [];
        for (let i = 0; i < count; i++) {
            // Different seconds, so the pages do not overlap
            tickets.push(await new TicketFactory({ order, index: i + 1, total: count, updatedAt: new Date(updatedAt.getTime() + i * 1000) }).create());
        }
        return tickets;
    }

    async function getServerTickets(webshop: Webshop) {
        return await Ticket.select().where('webshopId', webshop.id).fetch();
    }

    /**
     * Same changes as when an order is canceled in the dashboard
     */
    async function cancelOrder(order: Order) {
        order.status = OrderStatus.Canceled;
        await order.save();
        for (const ticket of await Ticket.select().where('orderId', order.id).fetch()) {
            await ticket.softDelete();
        }
    }

    /**
     * A scan saved by a device that is not part of the test
     */
    async function scanOnServer(ticket: Ticket, scannedBy: string) {
        ticket.scannedAt = new Date();
        ticket.scannedBy = scannedBy;
        await ticket.save();
    }

    async function expectScannedOnServer(ticket: Ticket, isScanned: boolean) {
        await expect.poll(async () => (await Ticket.getByID(ticket.id))!.scannedAt !== null, { timeout: 30_000 }).toBe(isScanned);
    }

    /**
     * Holds the downloads of the next pages of tickets until released
     */
    async function holdNextTicketPages(device: TicketScannerDevice) {
        let release!: () => void;
        const released = new Promise<void>((resolve) => {
            release = resolve;
        });
        await device.page.route(url => url.pathname.endsWith('/webshop/tickets/private') && url.searchParams.has('pageFilter'), async (route) => {
            await released;
            await route.continue();
        });
        return release;
    }

    test.describe('Scanning', () => {
        test('Should accept a valid ticket once and warn when it is scanned again', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Geldig');
            const ticket = await createTicket(webshop);
            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });

            await device.openScanner();
            await device.waitUntilReady();

            await device.scan(ticket);
            await device.expectAlreadyScanned(ticket, { scannedBy: user.firstName! });

            await expectScannedOnServer(ticket, true);
            expect((await Ticket.getByID(ticket.id))!.scannedBy).toBe(user.firstName);
            await expect.poll(async () => device.countOffline('ticketPatches')).toBe(0);
        });

        test('Should reject codes that are not valid tickets of this webshop', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Ongeldig');
            const deletedTicket = await createTicket(webshop);
            await deletedTicket.softDelete();
            const otherWebshopTicket = await createTicket(await createTicketWebshop('Andere webshop'));

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();

            await device.expectRejected('Dit is geen ticket', $t('Ongeldig ticket'));
            await device.expectRejected('https://example.com/zonder-ticket', $t('Ongeldig ticket'));
            await device.expectRejected('https://example.com/tickets/onbekend', $t('Ongeldig ticket'));
            await device.expectRejected(getTicketUrl(otherWebshopTicket), $t('Ongeldig ticket'));
            await device.expectRejected(getTicketUrl(deletedTicket), $t('Ongeldig ticket'));
        });

        test('Should reject tickets that were canceled after the download', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Geannuleerd');
            const deletedTicket = await createTicket(webshop);
            const canceledOrderTicket = await createTicket(webshop);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();

            await cancelOrder((await Order.getByID(deletedTicket.orderId))!);

            // Only the order is canceled, the ticket itself is not deleted
            const canceledOrder = (await Order.getByID(canceledOrderTicket.orderId))!;
            canceledOrder.status = OrderStatus.Canceled;
            await canceledOrder.save();

            await device.reopenScanner();
            await device.waitUntilReady();

            await device.expectRejected(getTicketUrl(deletedTicket), $t('Ongeldig ticket'));
            await device.expectRejected(getTicketUrl(canceledOrderTicket), 'geannuleerd');
        });

        test('Should show who scanned a ticket that was scanned before the download', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Eerder gescand');
            const ticket = await createTicket(webshop);
            await scanOnServer(ticket, 'Kassa 2');

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();

            await device.expectAlreadyScanned(ticket, { scannedBy: 'Kassa 2' });
        });

        test('Should undo a scan', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Ongedaan');
            const ticket = await createTicket(webshop);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();

            await device.scan(ticket);
            await expectScannedOnServer(ticket, true);

            await device.expectAlreadyScanned(ticket);
            await device.page.getByTestId('ticket-already-scanned-view').getByRole('button', { name: $t('%Vy') }).click();
            await device.page.getByTestId('valid-ticket-view').getByTestId('cancel-scan-button').click();
            await expect(device.page.getByTestId('valid-ticket-view')).toBeHidden();
            await device.dismissToasts();

            await expectScannedOnServer(ticket, false);
            await device.expectValid(ticket);
        });

        test('Should warn when scanning a ticket of a product that is not selected', async ({ browser, storageState }) => {
            const { webshop } = await TestWebshops.create({
                organization,
                ticketType: WebshopTicketType.Tickets,
                productCount: 2,
                name: `Producten ${WorkerData.id}`,
            });
            const [selectedProduct, otherProduct] = webshop.products;

            const createProductTicket = async (product: typeof selectedProduct) => {
                const item = CartItem.create({ product, productPrice: product.prices[0], amount: 1 });
                const order = await new OrderFactory({
                    webshop,
                    data: OrderData.create({
                        customer: Customer.create({ firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' }),
                        cart: Cart.create({ items: [item] }),
                    }),
                }).create();
                const ticket = await new TicketFactory({ order }).create();
                ticket.itemId = item.id;
                await ticket.save();
                return ticket;
            };
            const selectedTicket = await createProductTicket(selectedProduct);
            const otherTicket = await createProductTicket(otherProduct);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScannerSetup();
            await device.page.locator('label').filter({ hasText: otherProduct.name }).click();
            await device.startScanner();
            await device.waitUntilReady();

            await device.expectRejected(getTicketUrl(otherTicket), otherProduct.name);
            await device.expectValid(selectedTicket);
        });

        test('Should not lose a scan that is undone while the scan is being saved', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Snel ongedaan');
            const ticket = await createTicket(webshop);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();

            let releaseSave!: () => void;
            const saveReleased = new Promise<void>((resolve) => {
                releaseSave = resolve;
            });
            const saveRequested = device.page.waitForRequest(request => request.method() === 'PATCH' && request.url().includes('/tickets/private'));
            await device.page.route(url => url.pathname.endsWith('/tickets/private'), async (route) => {
                if (route.request().method() === 'PATCH') {
                    await saveReleased;
                }
                await route.fallback();
            });

            await device.scan(ticket);
            await saveRequested;

            // Undo the scan while it is still being saved
            await device.expectAlreadyScanned(ticket);
            await device.page.getByTestId('ticket-already-scanned-view').getByRole('button', { name: $t('%Vy') }).click();
            await device.page.getByTestId('valid-ticket-view').getByTestId('cancel-scan-button').click();
            await expect(device.page.getByTestId('valid-ticket-view')).toBeHidden();

            releaseSave();
            await device.reopenScanner();
            await device.waitUntilReady();

            await expectScannedOnServer(ticket, false);
            await device.expectValid(ticket);
        });
    });

    test.describe('Offline', () => {
        test('Should recognize downloaded tickets without internet and reject tickets that are not downloaded', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Zonder internet');
            const downloaded = await createTicket(webshop);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();

            const soldAfterDownload = await createTicket(webshop);
            await device.goOffline();
            await device.reportNoConnection();

            await device.scan(downloaded);
            await device.expectRejected(getTicketUrl(soldAfterDownload), $t('Ongeldig ticket'));
        });

        test('Should tell that a ticket could not be checked when looking it up takes too long', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Te traag');
            await createTicket(webshop);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();

            const soldAfterDownload = await createTicket(webshop);
            // Never answered
            await device.page.route(url => isTicketLookup(url), () => {});

            await device.showToCamera(getTicketUrl(soldAfterDownload));
            await expect(device.scannerView.getByTestId('ticket-scanner-checking-ticket')).toBeVisible();
            // Otherwise the scanner looks it up again after its cooldown
            await device.showToCamera(null);
            await expect(device.page.locator('.toast-view').filter({ hasText: $t('Dit ticket staat nog niet op dit toestel en kon niet online gecontroleerd worden door een trage internetverbinding. Probeer opnieuw.') }))
                .toBeVisible({ timeout: 8_000 });
            await expect(device.scannerView.getByTestId('ticket-scanner-checking-ticket')).toBeHidden();
            await expect(device.page.getByTestId('valid-ticket-view')).toHaveCount(0);
        });

        test('Should warn that a ticket might not be downloaded yet when the first download did not finish', async ({ browser, storageState }) => {
            test.setTimeout(120_000);

            const webshop = await createTicketWebshop('Onvolledige download');
            const tickets = await createManyTickets(webshop, 150);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            // The connection drops after the first page. Every later download (also a resumed one) fails.
            let isFirstPage = true;
            await device.page.route(url => url.pathname.endsWith('/webshop/tickets/private') && !isTicketLookup(url), async (route) => {
                if (isFirstPage) {
                    isFirstPage = false;
                    await route.continue();
                    return;
                }
                await route.abort('internetdisconnected');
            });
            await device.openScanner();
            await expect(device.scannerView).toContainText($t('%Ztp'), { timeout: 30_000 });
            await device.goOffline();

            await device.scan(tickets[0]);
            await device.expectRejected(getTicketUrl(tickets[149]), $t('%Zth'));
        });

        test('Should show that there is no internet until it is back, and save the scans made in the meantime', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Internet terug');
            const ticket = await createTicket(webshop);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            // The scanner checks the connection every 30 seconds
            await device.page.clock.install();
            await device.page.clock.resume();
            await device.openScanner();
            await device.waitUntilReady();

            await device.goOffline();
            await device.page.clock.fastForward(30_000);
            await device.page.clock.resume();
            await expect(device.scannerView).toContainText($t('%Vq'));

            await device.scan(ticket);
            await expect(device.scannerView).toContainText($t('%Vq'));
            expect(await device.countOffline('ticketPatches')).toBe(1);

            await device.goOnline();
            await device.page.clock.fastForward(30_000);
            await device.page.clock.resume();
            await expect(device.scannerView).not.toContainText($t('%Vq'));
            await device.waitUntilReady();

            await expectScannedOnServer(ticket, true);
            await expect.poll(async () => device.countOffline('ticketPatches')).toBe(0);
        });

        test('Should save a scan that was undone without internet', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Offline ongedaan');
            const ticket = await createTicket(webshop);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();
            await device.scan(ticket);
            await expectScannedOnServer(ticket, true);

            await device.goOffline();
            await device.expectAlreadyScanned(ticket);
            await device.page.getByTestId('ticket-already-scanned-view').getByRole('button', { name: $t('%Vy') }).click();
            await device.page.getByTestId('valid-ticket-view').getByTestId('cancel-scan-button').click();
            await expect(device.page.getByTestId('valid-ticket-view')).toBeHidden();
            await device.dismissToasts();
            expect(await device.countOffline('ticketPatches')).toBe(1);

            await device.goOnline();
            await device.reopenScanner();
            await expectScannedOnServer(ticket, false);
            await expect.poll(async () => device.countOffline('ticketPatches')).toBe(0);
            await device.expectValid(ticket);
        });

        test('Should not look up a ticket on the server when the device has no connection', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Geen verbinding');
            await createTicket(webshop);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();

            const soldAfterDownload = await createTicket(webshop);
            const lookups = device.trackTicketLookups();
            await device.reportNoConnection();

            await device.expectRejected(getTicketUrl(soldAfterDownload), $t('Ongeldig ticket'));
            expect(lookups).toEqual([]);
        });

        test('Should show that a ticket is being checked while it is looked up on a slow connection', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Trage verbinding');
            await createTicket(webshop);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();

            const soldAfterDownload = await createTicket(webshop);
            let release!: () => void;
            const released = new Promise<void>((resolve) => {
                release = resolve;
            });
            await device.page.route(url => isTicketLookup(url), async (route) => {
                await released;
                await route.continue();
            });

            await device.showToCamera(getTicketUrl(soldAfterDownload));
            const checking = device.scannerView.getByTestId('ticket-scanner-checking-ticket');
            await expect(checking).toBeVisible();

            release();
            await expect(device.page.getByTestId('valid-ticket-view')).toBeVisible();
            await expect(checking).toBeHidden();
        });

        test('Should save scans made offline once the app is opened again with internet', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Offline gescand');
            const tickets = [await createTicket(webshop), await createTicket(webshop)];

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();

            await device.goOffline();
            for (const ticket of tickets) {
                await device.scan(ticket);
            }
            await device.expectAlreadyScanned(tickets[0]);
            expect(await device.countOffline('ticketPatches')).toBe(2);

            // Close the app before it had internet again
            const reopened = await device.openTab();
            await device.page.close();

            await reopened.openScanner();
            await reopened.waitUntilReady();

            for (const ticket of tickets) {
                await expectScannedOnServer(ticket, true);
            }
            await expect.poll(async () => reopened.countOffline('ticketPatches')).toBe(0);
            await reopened.expectAlreadyScanned(tickets[1], { scannedBy: user.firstName! });
        });
    });

    test.describe('Downloading', () => {
        test('Should store the latest version of tickets that change during the download', async ({ browser, storageState }) => {
            test.setTimeout(120_000);

            const webshop = await createTicketWebshop('Wijzigingen tijdens download');
            const tickets = await createManyTickets(webshop, 150);

            const device = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            const releaseNextPages = await holdNextTicketPages(device);
            await device.openScannerSetup();
            await expect(device.page.getByTestId('ticket-scanner-setup-catching-up')).toBeVisible();

            // Changes to tickets of the first and the second page, and a new ticket, while the first page is stored
            await scanOnServer(tickets[10], 'Kassa 2');
            await scanOnServer(tickets[120], 'Kassa 3');
            await tickets[130].softDelete();
            const newTicket = await createTicket(webshop);

            releaseNextPages();
            await device.startScanner();
            await device.waitUntilReady();

            await expect.poll(async () => device.readOfflineTickets()).toEqual(toOfflineTickets(await getServerTickets(webshop)));
            await device.expectAlreadyScanned(tickets[10], { scannedBy: 'Kassa 2' });
            await device.closeAlreadyScanned();
            await device.expectValid(newTicket);
        });
    });

    test.describe('Several devices', () => {
        test('Should show a ticket scanned on one device as already scanned on the other devices', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Twee toestellen');
            const ticket = await createTicket(webshop);

            const deviceA = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            const deviceB = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            for (const device of [deviceA, deviceB]) {
                await device.openScanner();
                await device.waitUntilReady();
            }

            await deviceA.scan(ticket);
            await expectScannedOnServer(ticket, true);

            await deviceB.reopenScanner();
            await deviceB.waitUntilReady();
            await deviceB.expectAlreadyScanned(ticket, { scannedBy: user.firstName! });
        });

        test('Should save the scans of all devices that scanned the same ticket offline', async ({ browser, storageState }) => {
            const webshop = await createTicketWebshop('Samen offline');
            const ticket = await createTicket(webshop);

            const devices = [
                await TicketScannerDevice.create({ browser, storageState, organization, webshop }),
                await TicketScannerDevice.create({ browser, storageState, organization, webshop }),
            ];
            for (const device of devices) {
                await device.openScanner();
                await device.waitUntilReady();
                await device.goOffline();
            }

            // Without internet, every device accepts the ticket once
            for (const device of devices) {
                await device.scan(ticket);
            }

            for (const device of devices) {
                await device.goOnline();
                await device.reopenScanner();
                await device.waitUntilReady();
            }

            await expectScannedOnServer(ticket, true);
            for (const device of devices) {
                await expect.poll(async () => device.countOffline('ticketPatches')).toBe(0);
                await device.expectAlreadyScanned(ticket);
            }
        });

        test('Should download the same tickets on several devices while tickets are being scanned', async ({ browser, storageState }) => {
            test.setTimeout(180_000);

            const webshop = await createTicketWebshop('Gelijktijdig downloaden');
            const tickets = await createManyTickets(webshop, 250);

            const devices = await Promise.all([1, 2, 3].map(async () => TicketScannerDevice.create({ browser, storageState, organization, webshop })));

            // Scans on other devices keep changing tickets while the downloads run
            let isDownloading = true;
            const scanning = (async () => {
                for (let i = 0; isDownloading && i < tickets.length; i += 7) {
                    await scanOnServer(tickets[i], `Kassa ${i}`);
                }
            })();

            await Promise.all(devices.map(async (device) => {
                await device.openScanner();
                await device.waitUntilReady();
            }));
            isDownloading = false;
            await scanning;

            const serverTickets = toOfflineTickets(await getServerTickets(webshop));
            for (const device of devices) {
                // Scans after the first download are downloaded by the next one
                await device.reopenScanner();
                await device.waitUntilReady();
                await expect.poll(async () => device.readOfflineTickets()).toEqual(serverTickets);
            }
        });

        test('Should share the downloaded tickets and scans between two tabs on the same device', async ({ browser, storageState }) => {
            test.setTimeout(120_000);

            const webshop = await createTicketWebshop('Twee tabbladen');
            const tickets = await createManyTickets(webshop, 150);

            const firstTab = await TicketScannerDevice.create({ browser, storageState, organization, webshop });
            const secondTab = await firstTab.openTab();

            // Both tabs download into the same offline database at the same time
            await Promise.all([firstTab, secondTab].map(async (tab) => {
                await tab.openScanner();
                await tab.waitUntilReady();
            }));
            await expect.poll(async () => firstTab.readOfflineTickets()).toEqual(toOfflineTickets(await getServerTickets(webshop)));

            await firstTab.goOffline();
            await secondTab.goOffline();
            await firstTab.scan(tickets[0]);
            await secondTab.expectAlreadyScanned(tickets[0]);
            await secondTab.closeAlreadyScanned();

            await secondTab.goOnline();
            await secondTab.reopenScanner();
            await expectScannedOnServer(tickets[0], true);
            await expect.poll(async () => secondTab.countOffline('ticketPatches')).toBe(0);
        });
    });

    test.describe('Permissions', () => {
        test('A volunteer who can only scan tickets can download and scan them', async ({ browser }) => {
            const webshop = await createTicketWebshop('Vrijwilliger');
            const ticket = await createTicket(webshop);

            const volunteer = await new UserFactory({
                organization,
                firstName: 'Vrijwilliger',
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([
                        [PermissionsResourceType.Webshops, new Map([[webshop.id, ResourcePermissions.create({
                            resourceName: webshop.meta.name,
                            level: PermissionLevel.None,
                            accessRights: [AccessRight.WebshopScanTickets],
                        })]])],
                    ]),
                }),
            }).create();

            const device = await TicketScannerDevice.createForUser({ browser, user: volunteer, organization, webshop });
            await device.openScanner();
            await device.waitUntilReady();

            await device.scan(ticket);
            await expectScannedOnServer(ticket, true);
            expect((await Ticket.getByID(ticket.id))!.scannedBy).toBe('Vrijwilliger');
        });
    });
});
