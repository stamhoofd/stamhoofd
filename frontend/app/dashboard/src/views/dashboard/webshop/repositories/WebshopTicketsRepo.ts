import { ArrayDecoder, AutoEncoderPatchType, Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { isSimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { EventBus, fetchAll, ObjectFetcher } from '@stamhoofd/components';
import { SessionContext } from '@stamhoofd/networking';
import { CountFilteredRequest, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList, StamhoofdFilter, TicketPrivate, Version } from '@stamhoofd/structures';
import { WebshopDatabase } from './WebshopDatabase';
import { WebshopSettingsStore } from './WebshopSettingsStore';

/**
 * Responsible for webshop ticket operations (including patches).
 */
export class WebshopTicketsRepo {
    readonly eventBus = new EventBus<string, TicketPrivate[]>();
    readonly patchesEventBus = new EventBus<string, AutoEncoderPatchType<TicketPrivate>[]>();

    private readonly store: WebshopTicketsStore;
    private readonly patchesStore: WebshopTicketPatchesStore;
    private readonly apiClient: WebshopTicketsApiClient;

    private isSavingPatches = false;

    get isFetching() {
        return this.apiClient.isFetching;
    }

    get lastUpdated() {
        return this.apiClient.lastUpdated;
    }

    constructor({ database, context, settingsStore, webshopId }: { database: WebshopDatabase; context: SessionContext; settingsStore: WebshopSettingsStore; webshopId: string }) {
        this.apiClient = new WebshopTicketsApiClient({ context, settingsStore, webshopId });
        this.store = new WebshopTicketsStore({ database });
        this.patchesStore = new WebshopTicketPatchesStore({ database });
    }

    reset() {
        this.apiClient.reset();
    }

    /**
     * Fetch all the updated tickets from the server and store them in the offline database.
     * @returns
     */
    async fetchAllUpdated(): Promise<void> {
        const totalTickets: TicketPrivate[] = [];

        const promises: Promise<void>[] = [];

        const onResultsReceived = async (tickets: TicketPrivate[]): Promise<void> => {
            if (tickets.length) {
                totalTickets.push(...tickets);
                promises.push(this.storeAll(tickets));
                promises.push(this.apiClient.setLastFetchedTicket(tickets[tickets.length - 1]));
            }
        };

        await this.apiClient.getAllUpdated({ isFetchAll: false, onResultsReceived });
        await Promise.all(promises);

        if (totalTickets.length > 0) {
            // deleted tickets get handled in listener
            await this.eventBus.sendEvent('fetched', totalTickets);
        }
    }

    /**
     * Get all the tickets for an order (that are stored in the offline database).
     */
    async getForOrder(orderId: string, withPatches = true, openTransaction?: IDBTransaction) {
        const tickets = await this.store.getForOrder(orderId, openTransaction);

        if (!withPatches) {
            return tickets.filter(t => !t.deletedAt);
        }

        const patchedTickets: TicketPrivate[] = [];

        for (const ticket of tickets) {
            const patch = await this.patchesStore.get(ticket.secret, openTransaction);
            if (patch) {
                const patched = ticket.patch(patch);
                patchedTickets.push(patched);
                continue;
            }

            patchedTickets.push(ticket);
        }

        return patchedTickets.filter(t => !t.deletedAt);
    }

    /**
     * Put all the patches in the offline database and try to save them to the server.
     */
    async putPatches(patches: AutoEncoderPatchType<TicketPrivate>[]) {
        if (patches.length === 0) {
            return;
        }

        // First save the patch in the local database
        await this.patchesStore.putAll(patches);
        await this.patchesEventBus.sendEvent('patched', patches);

        // Try to save all remaining patches to the server (once)
        // Don't wait
        this.trySavePatches().catch(console.error);
    }

    /**
     * Put the patch in the offline database and try to save it to the server.
     */
    async putPatch(patch: AutoEncoderPatchType<TicketPrivate>) {
        await this.putPatches([patch]);
    }

    /**
     * Get a ticket from the offline database.
     */
    async get(secret: string, withPatches = true): Promise<TicketPrivate | undefined> {
        const ticket = await this.store.get(secret);
        if (!withPatches || !ticket) {
            return ticket;
        }

        const patch = await this.patchesStore.get(secret);

        if (!patch) {
            return ticket;
        }

        return ticket.patch(patch);
    }

    /**
     * Save the offline patches to the server:
     * - Get all offline patches (from indexed db)
     * - Patch them in the backend
     * - Store the patched tickets
     * - Clear the offline patches
     */
    async trySavePatches(): Promise<void> {
        if (this.isSavingPatches) {
            // Already working on it
            return;
        }
        this.isSavingPatches = true;

        const patches = await this.patchesStore.getAll();

        if (patches.length > 0) {
            try {
                await this.patchAllTickets(patches);
                this.isSavingPatches = false;
                return this.trySavePatches();
            }
            catch (e: any) {
                if (Request.isNetworkError(e as Error)) {
                    // failed.
                }
                else {
                    this.isSavingPatches = false;
                    throw e;
                }
            }
        }
        this.isSavingPatches = false;
    }

    async streamAll(callback: (ticket: TicketPrivate) => void, networkFetch = true): Promise<void> {
        try {
            await this.store.streamAll(callback);
        }
        catch (e) {
            console.error(e);
            if (!networkFetch) {
                throw e;
            }
        }

        if (networkFetch) {
            await this.apiClient.getAllUpdated({ onResultsReceived: (tickets: TicketPrivate[]) => {
                for (const ticket of tickets) {
                    callback(ticket);
                }
            } });
        }
    }

    async streamAllPatches(callback: (ticket: AutoEncoderPatchType<TicketPrivate>) => void): Promise<void> {
        await this.patchesStore.streamAll(callback);
    }

    /**
     * Put all tickets in the offline database store.
     * @param tickets
     * @param clearPatches
     */
    private async storeAll(tickets: TicketPrivate[], clearPatches = true) {
        await this.store.putAll(tickets);
        if (clearPatches) {
            await this.patchesStore.deleteAll(tickets.map(t => t.secret));
        }
    }

    /**
     * Patch all tickets in the backend and store them in the database.
     */
    private async patchAllTickets(patches: AutoEncoderPatchType<TicketPrivate>[]) {
        // Then make one try for a request (might fail if we don't have internet)
        let patched: TicketPrivate[];
        try {
            patched = await this.apiClient.patchAll(patches);
        }
        catch (e) {
            if (isSimpleErrors(e)) {
                for (const error of e.errors) {
                    if (error.hasCode('ticket_not_found')) {
                        const id = error.field;

                        // remove patch for this ticket
                        const patch = patches.find(i => i.id === id);
                        if (patch && patch.secret) {
                            console.info('Deleted invalid patch for deleted ticket ' + patch.secret);
                            try {
                                // todo
                                await this.patchesStore.delete(patch.secret);
                            }
                            catch (q) {
                                console.error(q);
                            }
                        }
                    }
                }
            }
            throw e;
        }

        // Move all data to original order
        try {
            await this.storeAll(patched);
        }
        catch (e) {
            console.error(e);
            // No db support or other error. Should ignore
        }

        this.eventBus.sendEvent('fetched', patched).catch(console.error);
        return patched;
    }
}

/**
 * Responsible for offline storage of webshop tickets.
 */
export class WebshopTicketsStore {
    static readonly storeName = 'tickets';
    private readonly database: WebshopDatabase;

    constructor({ database }: { database: WebshopDatabase }) {
        this.database = database;
    }

    async getForOrder(orderId: string, openTransaction?: IDBTransaction) {
        const db = await this.database.get();

        const tickets: TicketPrivate[] = [];

        await new Promise<void>((resolve, reject) => {
            const transaction = openTransaction ?? db.transaction([WebshopTicketsStore.storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                if (openTransaction && openTransaction.onerror) {
                    openTransaction.onerror(event);
                }

                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(WebshopTicketsStore.storeName);

            const orderIndex = objectStore.index('orderId');

            const range = IDBKeyRange.only(orderId);
            const request = orderIndex.openCursor(range);

            request.onsuccess = (event: any) => {
                const cursor = event.target.result;
                if (cursor) {
                    const rawOrder = cursor.value;
                    const ticket = TicketPrivate.decode(new ObjectData(rawOrder, { version: Version }));

                    tickets.push(ticket);
                    cursor.continue();
                }
                else {
                    // no more results
                    resolve();
                }
            };
        });

        return tickets;
    }

    async get(secret: string): Promise<TicketPrivate | undefined> {
        const rawItem = await this.database.getItemFromStore({ storeName: WebshopTicketsStore.storeName, id: secret });
        if (rawItem) {
            return (TicketPrivate as Decoder<TicketPrivate>).decode(new ObjectData(rawItem, { version: Version }));
        }

        return undefined;
    }

    async streamAll(callback: (ticket: TicketPrivate) => void): Promise<void> {
        const db = await this.database.get();

        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([WebshopTicketsStore.storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(WebshopTicketsStore.storeName);

            const request = objectStore.openCursor();
            request.onsuccess = (event: any) => {
                const cursor = event.target.result;
                if (cursor) {
                    const rawOrder = cursor.value;
                    const ticket = TicketPrivate.decode(new ObjectData(rawOrder, { version: Version }));
                    if (!ticket.deletedAt) {
                        callback(ticket);
                    }
                    cursor.continue();
                }
                else {
                    // no more results
                    resolve();
                }
            };
        });
    }

    async putAll(tickets: TicketPrivate[]) {
        const db = await this.database.get();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([WebshopTicketsStore.storeName], 'readwrite');

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(WebshopTicketsStore.storeName);

            for (const ticket of tickets) {
                if (ticket.deletedAt) {
                    objectStore.delete(ticket.secret);
                }
                else {
                    objectStore.put(ticket.encode({ version: Version }));
                }
            }
        });
    }

    static _init({ oldVersion, database, transaction }: { oldVersion: number; database: IDBDatabase; transaction: IDBTransaction | null }) {
        let storeToBeIndexed: IDBObjectStore | null = null;

        if (oldVersion < 1) {
            storeToBeIndexed = database.createObjectStore(WebshopTicketsStore.storeName, { keyPath: 'secret' });
        }
        else if (transaction) {
            const storeToClear = transaction.objectStore(WebshopTicketsStore.storeName);
            storeToClear.clear();

            if (oldVersion < 114) {
                storeToBeIndexed = storeToClear;
            }
        }

        if (storeToBeIndexed) {
        // create indexes
            storeToBeIndexed.createIndex('orderId', 'orderId', { unique: false });
        }
    }
}

/**
 * Responsible for offline storage of webshop ticket patches.
 */
export class WebshopTicketPatchesStore {
    static readonly storeName = 'ticketPatches';
    private readonly database: WebshopDatabase;

    constructor({ database }: { database: WebshopDatabase }) {
        this.database = database;
    }

    async deleteAll(secrets: string[]) {
        const db = await this.database.get();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([WebshopTicketPatchesStore.storeName], 'readwrite');

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            const objectStore = transaction.objectStore(WebshopTicketPatchesStore.storeName);

            for (const secret of secrets) {
                objectStore.delete(secret);
            }
        });
    }

    async delete(secret: string) {
        const db = await this.database.get();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([WebshopTicketPatchesStore.storeName], 'readwrite');

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const ticketPatches = transaction.objectStore(WebshopTicketPatchesStore.storeName);
            ticketPatches.delete(secret);
        });
    }

    async streamAll(callback: (ticket: AutoEncoderPatchType<TicketPrivate>) => void): Promise<void> {
        const db = await this.database.get();

        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([WebshopTicketPatchesStore.storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(WebshopTicketPatchesStore.storeName);

            const request = objectStore.openCursor();
            request.onsuccess = (event: any) => {
                const cursor = event.target.result;
                if (cursor) {
                    const rawPatch = cursor.value;
                    const patch = (TicketPrivate.patchType() as Decoder<AutoEncoderPatchType<TicketPrivate>>).decode(new ObjectData(rawPatch, { version: Version }));
                    callback(patch);
                    cursor.continue();
                }
                else {
                    // no more results
                    resolve();
                }
            };
        });
    }

    async get(secret: string, openTransaction?: IDBTransaction): Promise<AutoEncoderPatchType<TicketPrivate> | undefined> {
        const rawItem = await this.database.getItemFromStore({ storeName: WebshopTicketPatchesStore.storeName, id: secret, openTransaction });
        if (rawItem) {
            return (TicketPrivate.patchType() as Decoder<AutoEncoderPatchType<TicketPrivate>>).decode(new ObjectData(rawItem, { version: Version }));
        }

        return undefined;
    }

    async getAll(): Promise<AutoEncoderPatchType<TicketPrivate>[]> {
        const db = await this.database.get();

        return new Promise<AutoEncoderPatchType<TicketPrivate>[]>((resolve, reject) => {
            const transaction = db.transaction([WebshopTicketPatchesStore.storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(WebshopTicketPatchesStore.storeName);

            const request = objectStore.getAll();
            request.onsuccess = () => {
                const rawOrders = request.result;

                // TODO: need version fix here
                const patches = new ArrayDecoder(TicketPrivate.patchType() as Decoder<AutoEncoderPatchType<TicketPrivate>>).decode(new ObjectData(rawOrders, { version: Version }));
                resolve(patches);
            };
        });
    }

    async putAll(patches: AutoEncoderPatchType<TicketPrivate>[]) {
        const db = await this.database.get();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([WebshopTicketPatchesStore.storeName], 'readwrite');

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const ticketPatches = transaction.objectStore(WebshopTicketPatchesStore.storeName);

            for (const patch of patches) {
                ticketPatches.put(patch.encode({ version: Version }));
            }
        });
    }

    static _init({ oldVersion, database, transaction }: { oldVersion: number; database: IDBDatabase; transaction: IDBTransaction | null }) {
        if (oldVersion < 1) {
            database.createObjectStore(WebshopTicketPatchesStore.storeName, { keyPath: 'secret' });
        }
        else if (transaction) {
            const storeToClear = transaction.objectStore(WebshopTicketPatchesStore.storeName);
            storeToClear.clear();
        }
    }
}

/**
 * Responsible webshop tickets network operations.
 */
class WebshopTicketsApiClient {
    private _isFetching = false;
    private lastFetchedTicket: { updatedAt: Date; id: string } | null | undefined = undefined;

    private readonly webshopId: string;
    private readonly context: SessionContext;
    private readonly settingsStore: WebshopSettingsStore;

    get isFetching() {
        return this._isFetching;
    }

    get lastUpdated(): Date | null {
        return this.lastFetchedTicket?.updatedAt ?? null;
    }

    constructor({ context, settingsStore, webshopId }: { context: SessionContext; settingsStore: WebshopSettingsStore; webshopId: string }) {
        this.context = context;
        this.settingsStore = settingsStore;
        this.webshopId = webshopId;
    }

    reset() {
        this._isFetching = false;
        this.lastFetchedTicket = undefined;
    }

    async getAllUpdated({ isFetchAll, onResultsReceived }: { isFetchAll?: boolean; onResultsReceived: (results: TicketPrivate[]) => Promise<void> | void }): Promise<void> {
        // TODO: clear local database if resetting
        if (this._isFetching) {
            return;
        }
        this._isFetching = true;

        if (isFetchAll) {
            this.lastFetchedTicket = null;
        }
        else {
            await this.initLastFetchedTicket();
        }

        // create request
        const filter: StamhoofdFilter = {
            webshopId: this.webshopId,
        };

        if (this.lastFetchedTicket) {
            filter['$or'] = [
                {
                    updatedAt: { $gt: this.lastFetchedTicket.updatedAt },
                },
                {
                    $and: [
                        { updatedAt: { $eq: this.lastFetchedTicket.updatedAt } },
                        { id: { $gt: this.lastFetchedTicket.id } },
                    ],
                },
            ];
        }

        const filteredRequest = new LimitedFilteredRequest({
            limit: 100,
            filter,
        });

        // fetch
        const fetcher: ObjectFetcher<TicketPrivate> = {
            extendSort(): SortList {
                // fetchAll does clear list anyway, no need to assert
                return [
                    { key: 'updatedAt', order: SortItemDirection.ASC },
                    { key: 'id', order: SortItemDirection.ASC },
                ];
            },
            fetch: async (data: LimitedFilteredRequest) => {
                const response = await this.context.authenticatedServer.request({
                    method: 'GET',
                    path: `/webshop/tickets/private`,
                    decoder: new PaginatedResponseDecoder(new ArrayDecoder(TicketPrivate as Decoder<TicketPrivate>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                    query: data,
                    shouldRetry: false,
                    owner: this,
                });

                return response.data;
            },
            fetchCount: async (data: CountFilteredRequest): Promise<number> => {
                const response = await this.context.authenticatedServer.request({
                    method: 'GET',
                    path: `/webshop/tickets/private/count`,
                    decoder: CountResponse as Decoder<CountResponse>,
                    query: data,
                    shouldRetry: false,
                    owner: this,
                });
                return response.data.count;
            },
        };

        try {
            await fetchAll(filteredRequest, fetcher, { onResultsReceived });
        }
        finally {
            this._isFetching = false;
        }
    }

    async patchAll(patches: AutoEncoderPatchType<TicketPrivate>[]) {
        const response = await this.context.authenticatedServer.request({
            method: 'PATCH',
            path: '/webshop/' + this.webshopId + '/tickets/private',
            decoder: new ArrayDecoder(TicketPrivate as Decoder<TicketPrivate>),
            body: patches,
            shouldRetry: false,
            owner: this,
        });

        return response.data;
    }

    async setLastFetchedTicket(ticket: TicketPrivate) {
        this.lastFetchedTicket = {
            updatedAt: ticket.updatedAt,
            id: ticket.id!,
        };
        await this.settingsStore.set('lastFetchedTicket', this.lastFetchedTicket);
    }

    private async initLastFetchedTicket() {
        // Only once (if undefined)
        if (this.lastFetchedTicket !== undefined) {
            return;
        }

        try {
            this.lastFetchedTicket = await this.settingsStore.get('lastFetchedTicket') ?? null;
        }
        catch (e) {
            console.error(e);
            // Probably no database support. Ignore it and load everything.
            this.lastFetchedTicket = null;
        }
    }
}
