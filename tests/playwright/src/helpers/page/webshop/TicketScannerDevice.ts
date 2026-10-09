import type { Browser, BrowserContext, BrowserContextOptions, Locator, Page, Route } from '@playwright/test';
import { devices, expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { Organization, Ticket, User, Webshop } from '@stamhoofd/models';
import { Token as TokenStruct, Version } from '@stamhoofd/structures';
import { CaddyConfigHelper } from '../../../setup/helpers/CaddyConfigHelper.js';
import { installFakeCamera, showQRCodeToCamera } from '../../fakeCamera.js';
import { WorkerData } from '../../worker/WorkerData.js';
import { DashboardPage, DashboardTab } from '../DashboardPage.js';

export type OfflineStoreName = 'settings' | 'tickets' | 'ticketPatches' | 'orders';

/**
 * The scan state of a ticket in the offline database of a device, without the scans it did not save yet.
 */
export type OfflineTicket = { secret: string; isScanned: boolean; scannedBy: string | null };

/**
 * A phone running the ticket scanner of one webshop.
 * Tabs of the same device share their offline database.
 */
export class TicketScannerDevice {
    private offlineRoute: ((route: Route) => Promise<void>) | null = null;

    private constructor(
        readonly page: Page,
        private readonly organization: Organization,
        private readonly webshop: Webshop,
    ) {}

    static async create({ browser, storageState, organization, webshop }: { browser: Browser; storageState: BrowserContextOptions['storageState']; organization: Organization; webshop: Webshop }) {
        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });
        return this.openPage(context, organization, webshop);
    }

    /**
     * A device signed in as this user of the organization
     */
    static async createForUser({ browser, user, organization, webshop }: { browser: Browser; user: User; organization: Organization; webshop: Webshop }) {
        const token = await SessionService.createSession(user);
        const context = await browser.newContext({
            // Otherwise the context signs in with the storage state of the test
            storageState: { cookies: [], origins: [] },
            ...devices['iPhone 13'],
            userAgent: undefined,
        });
        await context.addInitScript(({ organizationId, tokenString }) => {
            // Platforms store the token of every user under 'platform'
            for (const suffix of [organizationId, 'platform']) {
                window.localStorage.setItem('token-' + suffix, tokenString);
            }
        }, { organizationId: organization.id, tokenString: JSON.stringify(new TokenStruct(token).encode({ version: Version })) });
        return this.openPage(context, organization, webshop);
    }

    private static async openPage(context: BrowserContext, organization: Organization, webshop: Webshop) {
        const page = await context.newPage();
        await installFakeCamera(page);
        return new TicketScannerDevice(page, organization, webshop);
    }

    /**
     * Another tab on this device, like reopening the app after it was closed.
     */
    async openTab() {
        return TicketScannerDevice.openPage(this.page.context(), this.organization, this.webshop);
    }

    get scannerView() {
        return this.page.getByTestId('ticket-scanner-view');
    }

    async openScannerSetup() {
        const dashboard = new DashboardPage(this.page);
        // Not openOrganizationDashboard: it waits for tabs that users with less permissions don't have
        await this.page.goto(dashboard.getOrganizationDashboardUrl(this.organization.uri));
        await dashboard.openTab(DashboardTab.Webshops);
        await this.page.getByTestId('webshop-menu-item')
            .filter({ hasText: this.webshop.meta.name })
            .click();
        await this.page.getByTestId('scan-tickets-button').click();
    }

    async openScanner() {
        await this.openScannerSetup();
        await this.startScanner();
    }

    async startScanner() {
        await clickEvenIfCoveredByToast(this.page, this.page.getByTestId('start-scan-tickets-button'));
        await expect(this.scannerView).toBeVisible();
    }

    /**
     * Opening the scanner downloads the updated tickets and saves the scans that were not saved yet.
     */
    async reopenScanner() {
        await this.scannerView.getByTestId('close-button').click();
        await expect(this.scannerView).toBeHidden();
        await this.startScanner();
    }

    async waitUntilReady() {
        await expect(this.scannerView).toContainText($t('%Vt'), { timeout: 30_000 });
    }

    async showToCamera(value: string | null) {
        await showQRCodeToCamera(this.page, value);
    }

    /**
     * Scans the ticket and expects it to be valid, without marking it as scanned yet
     */
    async expectValid(ticket: Ticket) {
        await this.showToCamera(getTicketUrl(ticket));
        await expect(this.page.getByTestId('valid-ticket-view')).toBeVisible();
        await this.showToCamera(null);
    }

    async markScanned() {
        await this.page.getByTestId('valid-ticket-view').getByTestId('scan-button').click();
        await expect(this.page.getByTestId('valid-ticket-view')).toBeHidden();
    }

    async scan(ticket: Ticket) {
        await this.expectValid(ticket);
        await this.markScanned();
    }

    async expectAlreadyScanned(ticket: Ticket, { scannedBy }: { scannedBy?: string } = {}) {
        await this.showToCamera(getTicketUrl(ticket));
        const view = this.page.getByTestId('ticket-already-scanned-view');
        await expect(view).toBeVisible();
        await this.showToCamera(null);
        if (scannedBy) {
            await expect(view).toContainText(scannedBy);
        }
    }

    async closeAlreadyScanned() {
        const view = this.page.getByTestId('ticket-already-scanned-view');
        await view.getByRole('button', { name: $t('%Vz') }).click();
        await expect(view).toBeHidden();
    }

    /**
     * Shows the value to the camera and expects a toast with the message
     */
    async expectRejected(value: string, message: string) {
        await this.dismissToasts();
        await this.showToCamera(value);
        await expect(this.page.locator('.toast-view').filter({ hasText: message }).first()).toBeVisible();
        await this.showToCamera(null);
        await expect(this.page.getByTestId('valid-ticket-view')).toHaveCount(0);
        await expect(this.page.getByTestId('ticket-already-scanned-view')).toHaveCount(0);
    }

    async dismissToasts() {
        await dismissToasts(this.page);
    }

    /**
     * Makes the browser report that it has no connection (navigator.onLine), while the API stays reachable
     */
    async reportNoConnection() {
        await this.page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
    }

    /**
     * Collects the URLs of the requests that look up a single scanned ticket on the server
     */
    trackTicketLookups() {
        const urls: string[] = [];
        this.page.on('request', (request) => {
            if (isTicketLookup(new URL(request.url()))) {
                urls.push(request.url());
            }
        });
        return urls;
    }

    /**
     * Only the API stops responding, the app itself stays loaded
     */
    async goOffline() {
        if (this.offlineRoute) {
            return;
        }
        this.offlineRoute = async route => route.abort('internetdisconnected');
        await this.page.route(apiUrlPattern(), this.offlineRoute);
    }

    async goOnline() {
        if (!this.offlineRoute) {
            return;
        }
        await this.page.unroute(apiUrlPattern(), this.offlineRoute);
        this.offlineRoute = null;
    }

    async countOffline(storeName: OfflineStoreName) {
        return await readOfflineDatabase(this.page, this.webshop.id, storeName) as number;
    }

    async hasCompletedTicketSync() {
        return hasCompletedTicketSync(this.page, this.webshop.id);
    }

    async readOfflineTickets(): Promise<OfflineTicket[]> {
        const raw = await this.page.evaluate(async id => new Promise<{ secret: string; scannedAt: unknown; scannedBy: string | null }[]>((resolve, reject) => {
            const open = indexedDB.open('webshop-' + id);
            open.onerror = () => reject(new Error('Could not open the offline database'));
            open.onsuccess = () => {
                const database = open.result;
                const request = database.transaction('tickets').objectStore('tickets').getAll();
                request.onsuccess = () => {
                    database.close();
                    resolve(request.result as { secret: string; scannedAt: unknown; scannedBy: string | null }[]);
                };
                request.onerror = () => reject(new Error('Could not read the tickets'));
            };
        }), this.webshop.id);

        return raw
            .map(ticket => ({ secret: ticket.secret, isScanned: ticket.scannedAt !== null && ticket.scannedAt !== undefined, scannedBy: ticket.scannedBy ?? null }))
            .sort((a, b) => a.secret.localeCompare(b.secret));
    }

    async close() {
        await this.page.context().close();
    }
}

/**
 * A request for one scanned ticket that is not in the offline database, instead of a download of all tickets
 */
export function isTicketLookup(url: URL) {
    return url.pathname.endsWith('/webshop/tickets/private') && (url.searchParams.get('filter') ?? '').includes('"secret"');
}

export function getTicketUrl(ticket: Ticket) {
    return `https://example.com/tickets/${ticket.secret}`;
}

/**
 * The tickets as a device should have them stored after a complete download
 */
export function toOfflineTickets(tickets: Ticket[]): OfflineTicket[] {
    return tickets
        .filter(ticket => !ticket.deletedAt)
        .map(ticket => ({ secret: ticket.secret, isScanned: ticket.scannedAt !== null, scannedBy: ticket.scannedBy }))
        .sort((a, b) => a.secret.localeCompare(b.secret));
}

function apiUrlPattern() {
    return `**${CaddyConfigHelper.getDomain('api', WorkerData.id ?? '')}**`;
}

/**
 * Reads from the offline database of a webshop on this device: the number of items in a store, or the value of a key.
 */
export async function readOfflineDatabase(page: Page, webshopId: string, storeName: OfflineStoreName, key?: string): Promise<unknown> {
    return page.evaluate(async ({ id, storeName, key }) => new Promise<unknown>((resolve) => {
        const open = indexedDB.open('webshop-' + id);
        open.onerror = () => resolve(undefined);
        open.onsuccess = () => {
            const database = open.result;
            if (!database.objectStoreNames.contains(storeName)) {
                database.close();
                resolve(undefined);
                return;
            }
            const objectStore = database.transaction(storeName).objectStore(storeName);
            const request = key === undefined ? objectStore.count() : objectStore.get(key);
            request.onerror = () => {
                database.close();
                resolve(undefined);
            };
            request.onsuccess = () => {
                database.close();
                resolve(request.result);
            };
        };
    }), { id: webshopId, storeName, key });
}

export async function hasCompletedTicketSync(page: Page, webshopId: string): Promise<boolean> {
    return await readOfflineDatabase(page, webshopId, 'settings', 'ticketsSyncCompleted') === true;
}

async function dismissToasts(page: Page) {
    const items = page.locator('.toast-view');
    const count = await items.count();
    for (let i = 0; i < count; i++) {
        await items.nth(i).click().catch(() => {
            // Already gone
        });
    }
}

export async function clickEvenIfCoveredByToast(page: Page, element: Locator) {
    await expect(element).toBeAttached();
    try {
        await element.click({ timeout: 3_000 });
    } catch (e) {
        await dismissToasts(page);
        await element.click();
    }
}
