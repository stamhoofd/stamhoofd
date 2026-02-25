import { AutoEncoderPatchType, Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { OrganizationManager, SessionContext } from '@stamhoofd/networking';
import { PermissionLevel, PrivateWebshop, Version, WebshopPreview } from '@stamhoofd/structures';
import { WebshopDatabase } from './repositories/WebshopDatabase';
import { WebshopOrdersRepo } from './repositories/WebshopOrdersRepo';
import { WebshopSettingsStore } from './repositories/WebshopSettingsStore';
import { WebshopTicketsRepo } from './repositories/WebshopTicketsRepo';

/**
 * Responsible for managing a single webshop orders and tickets
 * + persistent storage and loading orders from local database instead of the server
 */
export class WebshopManager {
    preview: WebshopPreview;
    webshop: PrivateWebshop | null = null;
    lastFetchedWebshop: Date | null = null;

    private readonly webshopStoreName = 'webshop';

    private webshopPromise: Promise<PrivateWebshop> | null = null;
    private webshopFetchPromise: Promise<PrivateWebshop> | null = null;

    private readonly context: SessionContext;
    private readonly webshopApiClient: WebshopApiClient;
    readonly database: WebshopDatabase;

    // repos
    readonly settings: WebshopSettingsStore;
    readonly tickets: WebshopTicketsRepo;
    readonly orders: WebshopOrdersRepo;

    get hasWrite() {
        return this.context.auth.canAccessWebshop(this.preview, PermissionLevel.Write);
    }

    get hasRead() {
        return this.context.auth.canAccessWebshop(this.preview, PermissionLevel.Read);
    }

    constructor(context: SessionContext, preview: WebshopPreview) {
        this.context = context;
        this.preview = preview;

        const webshopId = preview.id;
        const database = new WebshopDatabase({ webshopId });
        this.database = database;

        const settingsStore = new WebshopSettingsStore(database);
        this.settings = settingsStore;
        this.webshopApiClient = new WebshopApiClient({ context, webshopId });
        this.tickets = new WebshopTicketsRepo({ database, context, settingsStore, webshopId });
        this.orders = new WebshopOrdersRepo({ database, context, settingsStore, webshopId, tickets: this.tickets });
    }

    async reload(): Promise<boolean> {
        this.closeRequests();
        const didDelete = await this.database.delete(true);
        if (didDelete) {
            this.reset();
            await this.loadWebshop();
            return true;
        }

        console.error('Failed to reload WebshopManager');
        return false;
    }

    private reset() {
        this.webshop = null;
        this.lastFetchedWebshop = null;
        this.webshopPromise = null;
        this.webshopFetchPromise = null;
        this.tickets.reset();
        this.orders.reset();
    }

    /**
     * Cancel all pending loading states and retries
     */
    closeRequests() {
        Request.cancelAll(this);
    }

    /**
     * Cancel all pending loading states and retries and close the database
     */
    closeDatabase() {
        this.closeRequests();
        this.database.close();
    }

    async patchWebshop(patch: AutoEncoderPatchType<PrivateWebshop>) {
        const patched = await this.webshopApiClient.patch(patch);
        return this.updateWebshop(patched);
    }

    async updateWebshop(webshop: PrivateWebshop) {
        if (this.webshop) {
            this.webshop.deepSet(webshop);
        }
        else {
            this.webshop = webshop;
        }

        // Clone data and keep references
        this.context.organization!.webshops.find(w => w.id === this.preview.id)?.deepSet(webshop);
        this.preview.deepSet(webshop);
        new OrganizationManager(this.context).save().catch(console.error);

        try {
            await this.saveToDatabase(webshop);
        }
        catch (e) {
            // could fail in some unsupported browsers
            console.error(e);
        }
    }

    async loadWebshopFromDatabase(): Promise<PrivateWebshop | undefined> {
        const webshop = await this.getFromDatabase();

        if (webshop) {
            // Clone data and keep references
            const current = this.context.organization?.webshops.find(w => w.id === this.preview.id);

            if (current) {
                current.set(webshop);
            }

            this.preview.set(webshop);
        }

        return webshop;
    }

    /**
     * Load the webshop without blocking.
     */
    backgroundReloadWebshop() {
        this.loadWebshop(false).catch(console.error);
    }

    async saveToDatabase(webshop: PrivateWebshop) {
        await this.settings.set(this.webshopStoreName, webshop.encode({ version: Version }));
    }

    /**
     * Try to get a webshop as fast as possible and also initiates a background update of the webshop
     * if it is updated too long ago.
     * The goal is to have a working webshop as soon as possible.
     * Set shouldRetry to true if you don't want network errors and want to wait indefinitely for a network connection if we don't have any cached webshops
     */
    async loadWebshopIfNeeded(shouldRetry = true, forceBackground = false): Promise<PrivateWebshop> {
        if (this.webshop) {
            // If too long ago, also initiate a background update

            if (forceBackground || !this.lastFetchedWebshop || this.lastFetchedWebshop < new Date(new Date().getTime() - 1000 * 60 * 15)) {
                // Do a background update if not yet already doing this
                this.backgroundReloadWebshop();
            }

            return this.webshop;
        }

        if (this.webshopPromise) {
            return this.webshopPromise;
        }

        this.webshopPromise = (async () => {
            // Try to get it from the database, also init a background fetch if it is too long ago
            try {
                const webshop = await this.loadWebshopFromDatabase();
                if (webshop) {
                    if (this.webshop) {
                        this.webshop.set(webshop);
                    }
                    else {
                        this.webshop = webshop;
                    }

                    if (forceBackground || !this.lastFetchedWebshop || this.lastFetchedWebshop < new Date(new Date().getTime() - 1000 * 60 * 15)) {
                        // Do a background update if not yet already doing this
                        this.backgroundReloadWebshop();
                    }
                    return webshop;
                }
            }
            catch (e) {
                // Possible no database support
                console.error(e);

                // Do a normal fetch
            }

            return await this.loadWebshop(shouldRetry);
        })();

        return this.webshopPromise.finally(() => {
            this.webshopPromise = null;
        });
    }

    /**
     * Force fetch a new webshop, but prevent fetching multiple times at the same time
     */
    async loadWebshop(shouldRetry = true): Promise<PrivateWebshop> {
        if (this.webshopFetchPromise) {
            return this.webshopFetchPromise;
        }

        this.webshopFetchPromise = (async () => {
            // Try to get it from the database, also init a background fetch if it is too long ago
            const webshop = await this.fetchWebshop(shouldRetry);
            // Clone data and keep references
            this.context.organization!.webshops.find(w => w.id === this.preview.id)?.deepSet(webshop);
            this.preview.deepSet(webshop);

            this.lastFetchedWebshop = new Date();
            return webshop;
        })();

        return this.webshopFetchPromise.then((webshop: PrivateWebshop) => {
            if (this.webshop) {
                this.webshop.set(webshop);
            }
            else {
                this.webshop = webshop;
            }
            return webshop;
        }).finally(() => {
            this.webshopFetchPromise = null;
        });
    }

    private async fetchWebshop(shouldRetry = true) {
        const webshop = await this.webshopApiClient.fetch(shouldRetry);

        // Save async (could fail in some unsupported browsers)
        this.saveToDatabase(webshop).catch(console.error);
        return webshop;
    }

    private async getFromDatabase(): Promise<PrivateWebshop | undefined> {
        const raw = await this.settings.get(this.webshopStoreName);
        if (raw === undefined) {
            return undefined;
        }

        return PrivateWebshop.decode(new ObjectData(raw, { version: Version }));
    }
}

class WebshopApiClient {
    private readonly webshopId: string;
    private readonly context: SessionContext;

    constructor({ context, webshopId }: { context: SessionContext; webshopId: string }) {
        this.context = context;
        this.webshopId = webshopId;
    }

    async fetch(shouldRetry = true): Promise<PrivateWebshop> {
        const response = await this.context.authenticatedServer.request({
            method: 'GET',
            path: '/webshop/' + this.webshopId,
            decoder: PrivateWebshop as Decoder<PrivateWebshop>,
            shouldRetry,
            owner: this,
        });

        return response.data;
    }

    async patch(webshopPatch: AutoEncoderPatchType<PrivateWebshop>) {
        const response = await this.context.authenticatedServer.request({
            method: 'PATCH',
            path: '/webshop/' + this.webshopId,
            body: webshopPatch,
            decoder: PrivateWebshop as Decoder<PrivateWebshop>,
            owner: this,
        });

        return response.data;
    }
}
