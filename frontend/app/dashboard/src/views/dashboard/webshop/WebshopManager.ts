import { ArrayDecoder, AutoEncoderPatchType, Decoder, ObjectData, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Request, RequestResult } from '@simonbackx/simple-networking';
import { EventBus, fetchAll, ObjectFetcher, Toast } from '@stamhoofd/components';
import { OrganizationManager, SessionContext } from '@stamhoofd/networking';
import { compileToInMemoryFilter, CountFilteredRequest, CountResponse, InMemoryFilterRunner, LimitedFilteredRequest, OrderStatus, PaginatedResponseDecoder, PermissionLevel, PrivateOrder, privateOrderFilterCompilers, PrivateWebshop, SortItem, SortItemDirection, SortList, StamhoofdFilter, TicketPrivate, Version, WebshopPreview } from '@stamhoofd/structures';
import { toRaw } from 'vue';
import { IndexBoxDecoder } from './IndexBox';
import { createPrivateOrderIndexBox, OrderIndexedDBIndex } from './ordersIndexedDBSorters';

class CallbackError extends Error {}
class CompilerFilterError extends Error {}

/**
 * Responsible for managing a single webshop orders and tickets
 * + persistent storage and loading orders from local database instead of the server
 */
export class WebshopManager {
    preview: WebshopPreview;
    webshop: PrivateWebshop | null = null;
    lastFetchedWebshop: Date | null = null;

    private webshopPromise: Promise<PrivateWebshop> | null = null;
    private webshopFetchPromise: Promise<PrivateWebshop> | null = null;

    database: IDBDatabase | null = null;
    private databasePromise: Promise<IDBDatabase> | null = null;

    lastFetchedOrder: { updatedAt: Date; number: number } | null | undefined = undefined;
    lastFetchedTicket: { updatedAt: Date; id: string } | null | undefined = undefined;
    isLoadingOrders = false;
    isLoadingTickets = false;
    savingTicketPatches = false;

    lastUpdatedOrders: Date | null = null;
    lastUpdatedTickets: Date | null = null;

    /**
     * Listen for new orders that are being fetched or loaded
     */
    ordersEventBus = new EventBus<string, PrivateOrder[]>();
    ticketsEventBus = new EventBus<string, TicketPrivate[]>();
    ticketPatchesEventBus = new EventBus<string, AutoEncoderPatchType<TicketPrivate>[]>();

    context: SessionContext;

    constructor(context: SessionContext, preview: WebshopPreview) {
        this.context = context;
        this.preview = preview;
    }

    get hasWrite() {
        return this.context.auth.canAccessWebshop(this.preview, PermissionLevel.Write);
    }

    get hasRead() {
        return this.context.auth.canAccessWebshop(this.preview, PermissionLevel.Read);
    }

    /**
     * Cancel all pending loading states and retries
     */
    close() {
        Request.cancelAll(this);
    }

    /**
     * Fetch a webshop every time
     */
    private async fetchWebshop(shouldRetry = true) {
        const response = await this.context.authenticatedServer.request({
            method: 'GET',
            path: '/webshop/' + this.preview.id,
            decoder: PrivateWebshop as Decoder<PrivateWebshop>,
            shouldRetry,
            owner: this,
        });

        // Clone data and keep references
        this.context.organization!.webshops.find(w => w.id == this.preview.id)?.deepSet(response.data);
        this.preview.deepSet(response.data);

        // Save async (could fail in some unsupported browsers)
        this.storeWebshop(response.data).catch(console.error);

        return response.data;
    }

    async patchWebshop(webshopPatch: AutoEncoderPatchType<PrivateWebshop>) {
        const response = await this.context.authenticatedServer.request({
            method: 'PATCH',
            path: '/webshop/' + this.preview.id,
            body: webshopPatch,
            decoder: PrivateWebshop as Decoder<PrivateWebshop>,
            owner: this,
        });

        this.updateWebshop(response.data);
    }

    updateWebshop(webshop: PrivateWebshop) {
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

        // Save async (could fail in some unsupported browsers)
        this.storeWebshop(webshop).catch(console.error);
    }

    async loadWebshopFromDatabase(): Promise<PrivateWebshop | undefined> {
        const raw = await this.readSettingKey('webshop');
        if (raw === undefined) {
            return undefined;
        }
        const webshop = PrivateWebshop.decode(new ObjectData(raw, { version: Version }));

        // Clone data and keep references
        this.context.organization!.webshops.find(w => w.id == this.preview.id)?.set(webshop);
        this.preview.set(webshop);

        return webshop;
    }

    async storeWebshop(webshop: PrivateWebshop) {
        await this.storeSettingKey('webshop', webshop.encode({ version: Version }));
    }

    backgroundReloadWebshop() {
        this.loadWebshop(false).catch(console.error);
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

    deleteDatabase() {
        window.indexedDB.deleteDatabase('webshop-' + this.preview.id);
    }

    async getDatabase(): Promise<IDBDatabase> {
        if (this.database) {
            return this.database;
        }

        if (this.databasePromise) {
            return this.databasePromise;
        }

        // Open a connection with our database
        this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
            const version = Version;
            let resolved = false;

            const DBOpenRequest = window.indexedDB.open('webshop-' + this.preview.id, version);
            DBOpenRequest.onsuccess = () => {
                this.database = DBOpenRequest.result;

                if (resolved) {
                    return;
                }
                resolved = true;
                resolve(DBOpenRequest.result);
            };

            DBOpenRequest.onblocked = function (e) {
                console.log('DB open blocked', e);
                new Toast($t(`0b6274d7-7a42-4ab3-bc65-5a76c23d07ff`), 'error red').setHide(15 * 1000).show();
            };

            DBOpenRequest.onerror = (event) => {
                console.error(event);

                if (resolved) {
                    return;
                }

                // Try to delete this database if something goes wrong
                // if (STAMHOOFD.environment == "development") {
                this.deleteDatabase();
                // }

                resolved = true;
                reject(new SimpleError({
                    code: 'not_supported',
                    message: $t('5f963722-4ad9-4d5e-91cc-75eac8218349'),
                }));
            };

            DBOpenRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = DBOpenRequest.result;

                console.info('Database upgrade', event.oldVersion, event.newVersion);

                function addTicketStoreIndexes(ticketStore: IDBObjectStore) {
                    // Search tickets by order id
                    ticketStore.createIndex('orderId', 'orderId', { unique: false });
                }

                function addOrderIndexedDBIndexes(orderStore: IDBObjectStore) {
                    // typescript will show an error if an index is missing
                    const indexes: Record<OrderIndexedDBIndex, IDBIndexParameters & { keyPath: string | Iterable<string> }>
                        // auto generate indexes for generated indexes
                        = Object.fromEntries(Object.values(OrderIndexedDBIndex).map((index) => {
                            return [index, { unique: false, keyPath: `indexes.${index}` }];
                        })) as Record<OrderIndexedDBIndex, IDBIndexParameters & { keyPath: string | Iterable<string> }>
                    ;

                    Object.entries(indexes).forEach(([index, options]) => {
                        orderStore.createIndex(index, options.keyPath ?? index, options);
                    });
                }

                if (event.oldVersion < 1) {
                    // Version 1 is the first version of the database.
                    const orderStore = db.createObjectStore('orders', { keyPath: 'value.id' });
                    const ticketStore = db.createObjectStore('tickets', { keyPath: 'secret' });
                    db.createObjectStore('ticketPatches', { keyPath: 'secret' });
                    db.createObjectStore('settings', {});

                    addOrderIndexedDBIndexes(orderStore);
                    addTicketStoreIndexes(ticketStore);
                }
                else {
                    // For now: we clear all stores if we have a version update
                    DBOpenRequest.transaction!.objectStore('orders').clear();
                    DBOpenRequest.transaction!.objectStore('tickets').clear();
                    DBOpenRequest.transaction!.objectStore('ticketPatches').clear();
                    DBOpenRequest.transaction!.objectStore('settings').clear();

                    if (event.oldVersion < 114) {
                        const ticketStore = DBOpenRequest.transaction!.objectStore('tickets');
                        addTicketStoreIndexes(ticketStore);
                    }

                    if (event.oldVersion < 341) {
                        const orderStore = DBOpenRequest.transaction!.objectStore('orders');
                        addOrderIndexedDBIndexes(orderStore);
                    }
                }
            };

            // Timeout
            // Sometimes a browser hangs when trying to open a database. We cannot wait forever...
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    // Abort
                    reject(new SimpleError({
                        code: 'not_supported',
                        message: $t('4f7e64c6-4607-446d-9a84-8ebcb7206241'),
                    }));
                }
            }, 2000);
        });

        return this.databasePromise.then((database) => {
            this.databasePromise = null;
            return database;
        });
    }

    async readSettingKey<T = any>(key: IDBValidKey): Promise<T | undefined> {
        const db = await this.getDatabase();

        return new Promise<T | undefined>((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore('settings');
            const request = objectStore.get(key);

            request.onsuccess = () => {
                resolve(request.result as T | undefined);
            };
        });
    }

    async storeSettingKey(key: IDBValidKey, value: any) {
        const db = await this.getDatabase();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readwrite');

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore('settings');

            // Unref potential proxies here
            objectStore.put(toRaw(value), key);
        });
    }

    async storeOrders(orders: PrivateOrder[]) {
        const db = await this.getDatabase();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['orders'], 'readwrite');

            // Do the actual saving
            const objectStore = transaction.objectStore('orders');

            for (const order of orders) {
                if (order.status === OrderStatus.Deleted) {
                    objectStore.delete(order.id);
                }
                else {
                    const indexBox = createPrivateOrderIndexBox(order);
                    objectStore.put(indexBox.encode({ version: Version }));
                }
            }

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                this.deleteDatabase();
                reject(event);
            };
        });
    }

    async getTicketsForOrder(orderId: string, withPatches = true): Promise<TicketPrivate[]> {
        const db = await this.getDatabase();

        const tickets: TicketPrivate[] = [];

        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['tickets', 'ticketPatches'], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore('tickets');
            const ticketPatches = transaction.objectStore('ticketPatches');

            const orderIndex = objectStore.index('orderId');

            const range = IDBKeyRange.only(orderId);
            const request = orderIndex.openCursor(range);
            request.onsuccess = (event: any) => {
                const cursor = event.target.result;
                if (cursor) {
                    const rawOrder = cursor.value;
                    const ticket = TicketPrivate.decode(new ObjectData(rawOrder, { version: Version }));

                    if (withPatches) {
                        const request2 = ticketPatches.get(ticket.secret);
                        request2.onsuccess = () => {
                            const rawPatch = request2.result;

                            if (rawPatch === undefined) {
                                // no patch found
                                tickets.push(ticket);
                                cursor.continue();
                                return;
                            }

                            const patch = (TicketPrivate.patchType() as Decoder<AutoEncoderPatchType<TicketPrivate>>).decode(new ObjectData(rawPatch, { version: Version }));
                            const patched = ticket.patch(patch);
                            tickets.push(patched);
                            cursor.continue();
                        };
                    }
                    else {
                        tickets.push(ticket);
                        cursor.continue();
                    }
                }
                else {
                    // no more results
                    resolve();
                }
            };
        });

        return tickets.filter(t => !t.deletedAt);
    }

    async streamTickets(callback: (ticket: TicketPrivate) => void, networkFetch = true): Promise<void> {
        try {
            const db = await this.getDatabase();

            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction(['tickets'], 'readonly');

                transaction.onerror = (event) => {
                    // Don't forget to handle errors!
                    reject(event);
                };

                // Do the actual saving
                const objectStore = transaction.objectStore('tickets');

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
        catch (e) {
            console.error(e);
            if (!networkFetch) {
                throw e;
            }
        }

        if (networkFetch) {
            await this.fetchTickets({ callback: (tickets: TicketPrivate[]) => {
                for (const ticket of tickets) {
                    callback(ticket);
                }
            } });
        }
    }

    async streamTicketPatches(callback: (ticket: AutoEncoderPatchType<TicketPrivate>) => void): Promise<void> {
        const db = await this.getDatabase();

        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['ticketPatches'], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore('ticketPatches');

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

    async streamOrders(
        { callback, filter, limit, sortItem, networkFetch }: {
            callback: (data: PrivateOrder) => void;
            filter?: StamhoofdFilter;
            limit?: number;
            sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
            networkFetch?: boolean;
        },
    ): Promise<void> {
        const db = await this.getDatabase();

        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['orders'], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                try {
                    this.deleteDatabase();
                }
                catch (e) {
                    console.error(e);
                }
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore('orders');

            let request: IDBRequest<IDBCursorWithValue | null>;

            // use an index if a SortItem is defined
            try {
                if (sortItem) {
                    let direction: IDBCursorDirection = 'next';

                    if (sortItem.order === SortItemDirection.DESC) {
                        direction = 'prev';
                    }

                    request = (sortItem.key === 'id' ? objectStore : objectStore.index(sortItem.key))
                        .openCursor(null, direction);
                }
                else {
                    request = objectStore.openCursor();
                }
            }
            catch (e) {
                reject(e);
                return;
            }

            let matchedItemsCount = 0;

            let compiledFilter: InMemoryFilterRunner | undefined;

            if (filter) {
                try {
                    compiledFilter = compileToInMemoryFilter(filter, privateOrderFilterCompilers);
                }
                catch (e: any) {
                    console.error('Compile filter failed', e);
                    reject(new CompilerFilterError((e.message as string | undefined) ?? 'Compile filter failed'));
                    return;
                }
            }

            const decoder = new IndexBoxDecoder(PrivateOrder as Decoder<PrivateOrder>);

            request.onsuccess = (event: any) => {
                if (limit && matchedItemsCount >= limit) {
                    // limit reached
                    resolve();
                    return;
                }

                const cursor: IDBCursor & { value: any } | undefined = event.target.result;
                if (cursor) {
                    const rawOrder = cursor.value;

                    let decodedResult: PrivateOrder;

                    try {
                        decodedResult = decoder.decode(new ObjectData(rawOrder, { version: Version }));
                    }
                    catch (e) {
                        // Decoding error: ignore
                        // force fetch all again
                        this.clearLastFetchedOrder().catch(console.error);

                        // Stop reading without throwing an error
                        return;
                    }

                    if (compiledFilter && !compiledFilter(decodedResult)) {
                        cursor.continue();
                        return;
                    }

                    try {
                        callback(decodedResult);
                    }
                    catch (e: any) {
                        console.error('callback failed', e);
                        // Propagate error
                        reject(new CallbackError((e.message as string | undefined) ?? 'Callback failed'));
                        return;
                    }

                    cursor.continue();
                    matchedItemsCount += 1;
                }
                else {
                    // no more results
                    resolve();
                }
            };
        }).catch((e) => {
            if (e instanceof CallbackError || e instanceof CompilerFilterError) {
                throw e;
            }
            throw new SimpleError({
                code: 'loading_failed',
                message: $t('b17b2abe-34a5-4231-a170-5a9b849ecd3c'),
            });
        });

        if (networkFetch) {
            const owner = {};
            this.ordersEventBus.addListener(owner, 'fetched', (orders: PrivateOrder[]) => {
                for (const order of orders) {
                    callback(order);
                }
                return Promise.resolve();
            });

            try {
                await this.fetchOrders();
            }

            finally {
                this.ordersEventBus.removeListener(owner);
            }
        }
    }

    async clearOrdersFromDatabase(): Promise<void> {
        const db = await this.getDatabase();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['orders'], 'readwrite');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore('orders');

            const request = objectStore.clear();
            request.onsuccess = () => {
                resolve();
            };
        });
    }

    async getTicketPatchesFromDatabase(): Promise<AutoEncoderPatchType<TicketPrivate>[]> {
        const db = await this.getDatabase();

        return new Promise<AutoEncoderPatchType<TicketPrivate>[]>((resolve, reject) => {
            const transaction = db.transaction(['ticketPatches'], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore('ticketPatches');

            const request = objectStore.getAll();
            request.onsuccess = () => {
                const rawOrders = request.result;

                // TODO: need version fix here
                const patches = new ArrayDecoder(TicketPrivate.patchType() as Decoder<AutoEncoderPatchType<TicketPrivate>>).decode(new ObjectData(rawOrders, { version: Version }));
                resolve(patches);
            };
        });
    }

    async patchOrders(patches: PatchableArrayAutoEncoder<PrivateOrder>) {
        const response = await this.context.authenticatedServer.request({
            method: 'PATCH',
            path: '/webshop/' + this.preview.id + '/orders',
            decoder: new ArrayDecoder(PrivateOrder as Decoder<PrivateOrder>),
            body: patches,
            shouldRetry: false,
            owner: this,
        });

        // Move all data to original order
        try {
            await this.storeOrders(response.data);
        }
        catch (e) {
            console.error(e);
            // No db support or other error. Should ignore
        }

        // Patching orders can result in changed tickets. We'll need to pull those in.
        try {
            await this.fetchTickets();
        }
        catch (e) {
            console.error(e);
        }

        await this.ordersEventBus.sendEvent('fetched', response.data);
        return response.data;
    }

    async setlastFetchedOrder(order: PrivateOrder) {
        if (order.number === null) {
            console.error('Order has no number');
            return;
        }

        // important: this only works if the orders are sorted by updatedAt asc and then by number asc
        if (this.lastFetchedOrder
            && (this.lastFetchedOrder.updatedAt > order.updatedAt
                || (this.lastFetchedOrder.updatedAt === order.updatedAt && this.lastFetchedOrder.number > order.number)
            )) {
            return;
        }

        this.lastFetchedOrder = {
            updatedAt: order.updatedAt,
            number: order.number!,
        };
        await this.storeSettingKey('lastFetchedOrder', this.lastFetchedOrder);
    }

    async clearLastFetchedOrder() {
        this.lastFetchedOrder = null;
        await this.storeSettingKey('lastFetchedOrder', null);
    }

    async addTicketPatches(patches: AutoEncoderPatchType<TicketPrivate>[]) {
        if (patches.length === 0) {
            return;
        }

        // First save the patch in the local database
        await this.storeTicketPatches(patches);
        await this.ticketPatchesEventBus.sendEvent('patched', patches);

        // Try to save all remaining patches to the server (once)
        // Don't wait
        this.trySavePatches().catch(console.error);
    }

    async addTicketPatch(patch: AutoEncoderPatchType<TicketPrivate>) {
        await this.addTicketPatches([patch]);
    }

    async trySavePatches(): Promise<void> {
        if (this.savingTicketPatches) {
            // Already working on it
            return;
        }
        this.savingTicketPatches = true;

        const patches = await this.getTicketPatchesFromDatabase();
        if (patches.length > 0) {
            try {
                await this.patchTickets(patches);
                this.savingTicketPatches = false;
                return this.trySavePatches();
            }
            catch (e: any) {
                if (Request.isNetworkError(e as Error)) {
                    // failed.
                }
                else {
                    this.savingTicketPatches = false;
                    throw e;
                }
            }
        }
        this.savingTicketPatches = false;
    }

    async patchTickets(patches: AutoEncoderPatchType<TicketPrivate>[]) {
        // Then make one try for a request (might fail if we don't have internet)
        let response: RequestResult<TicketPrivate[]>;
        try {
            response = await this.context.authenticatedServer.request({
                method: 'PATCH',
                path: '/webshop/' + this.preview.id + '/tickets/private',
                decoder: new ArrayDecoder(TicketPrivate as Decoder<TicketPrivate>),
                body: patches,
                shouldRetry: false,
                owner: this,
            });
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
                                await this.removeTicketPatch(patch.secret);
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
            await this.storeTickets(response.data);
        }
        catch (e) {
            console.error(e);
            // No db support or other error. Should ignore
        }
        this.ticketsEventBus.sendEvent('fetched', response.data).catch(console.error);

        return response.data;
    }

    private createBackendOrdersObjectFetcher(): ObjectFetcher<PrivateOrder> {
        return {
            fetch: async (data: LimitedFilteredRequest) => {
                const response = await this.context.authenticatedServer.request({
                    method: 'GET',
                    path: `/webshop/orders`,
                    decoder: new PaginatedResponseDecoder(new ArrayDecoder(PrivateOrder as Decoder<PrivateOrder>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                    query: data,
                    shouldRetry: false,
                    owner: this,
                });

                return response.data;
            },
            fetchCount: async (data: CountFilteredRequest): Promise<number> => {
                const response = await this.context.authenticatedServer.request({
                    method: 'GET',
                    path: `/webshop/orders/count`,
                    decoder: CountResponse as Decoder<CountResponse>,
                    query: data,
                    shouldRetry: false,
                    owner: this,
                });
                return response.data.count;
            },
        };
    }

    private async initLastFetchedOrder() {
        if (this.lastFetchedOrder === undefined) {
            // Only once (if undefined)
            try {
                this.lastFetchedOrder = await this.readSettingKey('lastFetchedOrder') ?? null;
                if (this.lastFetchedOrder?.updatedAt && !this.lastUpdatedOrders) {
                    // Set initial timestamp in case of network error later on
                    this.lastUpdatedOrders = this.lastFetchedOrder.updatedAt;
                }
            }
            catch (e) {
                console.error(e);
                // Probably no database support. Ignore it and load everything.
                this.lastFetchedOrder = null;
            }
        }
    }

    // todo: rename

    /**
     * Get the orders from the backend and store them in  the indexed db
     * @param isFetchAll true if all orders should be fetched (and not only the updated orders)
     * @returns true if the backend returned updated orders
     */
    async fetchOrders({ isFetchAll }: { isFetchAll?: boolean } = {}): Promise<boolean> {
        if (this.isLoadingOrders) {
            return false;
        }

        this.isLoadingOrders = true;

        if (isFetchAll) {
            this.lastFetchedOrder = null;
        }
        else {
            await this.initLastFetchedOrder();
        }

        const fetcher = this.createBackendOrdersObjectFetcher();

        // #region create LimitedFilteredRequest
        const sort: SortList = [
            { key: 'updatedAt', order: SortItemDirection.ASC },
            { key: 'number', order: SortItemDirection.ASC },
        ];

        const filter: StamhoofdFilter = {
            webshopId: this.preview.id,
        };

        if (this.lastFetchedOrder) {
            filter['$or'] = [
                {
                    updatedAt: { $gt: this.lastFetchedOrder.updatedAt },
                },
                {
                    $and: [
                        { updatedAt: { $eq: this.lastFetchedOrder.updatedAt } },
                        { number: { $gt: this.lastFetchedOrder.number } },
                    ],
                },
            ];
        }

        const filteredRequest = new LimitedFilteredRequest({
            limit: 100,
            filter,
            sort,
        });
        // #endregion

        let hadSuccessfulFetch = false;
        const storeOrdersPromises: Promise<void>[] = [];
        let hasUpdatedOrders = false;

        const onResultsReceived = async (orders: PrivateOrder[]): Promise<void> => {
            if (isFetchAll && !hadSuccessfulFetch) {
                hadSuccessfulFetch = true;
                await this.clearOrdersFromDatabase();
                await this.clearLastFetchedOrder();
            }

            if (orders.length > 0) {
                if (!hasUpdatedOrders) {
                    hasUpdatedOrders = true;
                }
                const deletedOrders: PrivateOrder[] = [];
                const nonDeletedOrders: PrivateOrder[] = [];

                for (const order of orders) {
                    if (order.status === OrderStatus.Deleted) {
                        deletedOrders.push(order);
                        continue;
                    }

                    nonDeletedOrders.push(order);
                }

                const storeOrdersPromise = this.storeOrders(orders);
                storeOrdersPromises.push(storeOrdersPromise);

                const promises: Promise<unknown>[] = [
                    storeOrdersPromise,
                    // todo: this should be run sync?
                ];

                if (nonDeletedOrders.length > 0) {
                    // todo: is this necessary and should this always be broadcasted (thus without if statement)?
                    promises.push(this.ordersEventBus.sendEvent('fetched', nonDeletedOrders));
                }

                if (deletedOrders.length > 0) {
                    // todo: is this necessary
                    promises.push(this.ordersEventBus.sendEvent('deleted', deletedOrders));
                }

                await Promise.all(promises.map(promise => promise.catch(console.error)));

                // Only set the last fetched order if everything is stored correctly
                await this.setlastFetchedOrder(orders[orders.length - 1]);
            }
        };

        try {
            await fetchAll(filteredRequest, fetcher, { onResultsReceived });
        }
        finally {
            this.isLoadingOrders = false;
        }

        // wait for all orders to be stored
        await Promise.all(storeOrdersPromises);
        this.lastUpdatedOrders = new Date();
        return hasUpdatedOrders;
    }

    /// TICKETS
    async removeTicketPatch(secret: string) {
        const db = await this.getDatabase();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['ticketPatches'], 'readwrite');

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const ticketPatches = transaction.objectStore('ticketPatches');
            ticketPatches.delete(secret);
        });
    }

    /// TICKETS
    async storeTickets(tickets: TicketPrivate[], clearPatches = true) {
        const db = await this.getDatabase();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['tickets', 'ticketPatches'], 'readwrite');

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore('tickets');
            const ticketPatches = transaction.objectStore('ticketPatches');

            for (const ticket of tickets) {
                if (ticket.deletedAt) {
                    objectStore.delete(ticket.secret);
                }
                else {
                    objectStore.put(ticket.encode({ version: Version }));
                }

                // Remove any patches we might have saved
                if (clearPatches) {
                    ticketPatches.delete(ticket.secret);
                }
            }
        });
    }

    async storeTicketPatches(patches: AutoEncoderPatchType<TicketPrivate>[]) {
        const db = await this.getDatabase();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['ticketPatches'], 'readwrite');

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const ticketPatches = transaction.objectStore('ticketPatches');

            for (const patch of patches) {
                ticketPatches.put(patch.encode({ version: Version }));
            }
        });
    }

    async getTicketFromDatabase(secret: string, withPatches = true): Promise<TicketPrivate | undefined> {
        const db = await this.getDatabase();

        return new Promise<TicketPrivate | undefined>((resolve, reject) => {
            const transaction = db.transaction(['tickets', 'ticketPatches'], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore('tickets');
            const ticketPatches = transaction.objectStore('ticketPatches');

            const request = objectStore.get(secret);

            request.onsuccess = () => {
                const rawTicket = request.result;

                if (rawTicket === undefined) {
                    resolve(undefined);
                    return;
                }

                const ticket = (TicketPrivate as Decoder<TicketPrivate>).decode(new ObjectData(rawTicket, { version: Version }));

                if (withPatches) {
                    const request2 = ticketPatches.get(secret);
                    request2.onsuccess = () => {
                        const rawPatch = request2.result;

                        if (rawPatch === undefined) {
                            // no patch found
                            resolve(ticket);
                            return;
                        }

                        const patch = (TicketPrivate.patchType() as Decoder<AutoEncoderPatchType<TicketPrivate>>).decode(new ObjectData(rawPatch, { version: Version }));
                        resolve(ticket.patch(patch));
                    };
                }
                else {
                    resolve(ticket);
                }
            };
        });
    }

    async deleteOrderFromDatabase(id: string): Promise<void> {
        const db = await this.getDatabase();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['orders'], 'readwrite');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore('orders');
            const request = objectStore.delete(id);
            request.onsuccess = () => {
                resolve();
            };
        });
    }

    async getOrderFromDatabase(id: string): Promise<PrivateOrder | undefined> {
        const db = await this.getDatabase();

        return new Promise<PrivateOrder | undefined>((resolve, reject) => {
            const transaction = db.transaction(['orders'], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore('orders');

            const request = objectStore.get(id);

            const decoder = new IndexBoxDecoder(PrivateOrder as Decoder<PrivateOrder>); ;

            request.onsuccess = () => {
                const rawOrder = request.result;

                if (rawOrder === undefined) {
                    resolve(undefined);
                    return;
                }

                const order = decoder.decode(new ObjectData(rawOrder, { version: Version }));
                resolve(order);
            };
        });
    }

    private async setLastFetchedTicket(ticket: TicketPrivate) {
        this.lastFetchedTicket = {
            updatedAt: ticket.updatedAt,
            id: ticket.id!,
        };
        await this.storeSettingKey('lastFetchedTicket', this.lastFetchedTicket);
    }

    private async initLastFetchedTicket() {
        if (this.lastFetchedTicket === undefined) {
            // Only once (if undefined)
            try {
                this.lastFetchedTicket = await this.readSettingKey('lastFetchedTicket') ?? null;
                if (this.lastFetchedTicket?.updatedAt && !this.lastUpdatedTickets) {
                    // Set initial timestamp in case of network error later on
                    this.lastUpdatedTickets = this.lastFetchedTicket.updatedAt;
                }
            }
            catch (e) {
                console.error(e);
                // Probably no database support. Ignore it and load everything.
                this.lastFetchedTicket = null;
            }
        }
    }

    private createBackendTicketsObjectFetcher(): ObjectFetcher<TicketPrivate> {
        return {
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
    }

    async fetchTickets({ isFetchAll, callback }: { isFetchAll?: boolean; callback?: (tickets: TicketPrivate[]) => void } = {}): Promise<boolean> {
        // TODO: clear local database if resetting
        if (this.isLoadingTickets) {
            return false;
        }
        this.isLoadingTickets = true;

        if (isFetchAll) {
            this.lastFetchedTicket = null;
        }
        else {
            await this.initLastFetchedTicket();
        }

        const fetcher = this.createBackendTicketsObjectFetcher();

        // #region create LimitedFilteredRequest
        const sort: SortList = [
            { key: 'updatedAt', order: SortItemDirection.ASC },
            // todo?
            { key: 'id', order: SortItemDirection.ASC },
        ];

        const filter: StamhoofdFilter = {
            webshopId: this.preview.id,
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
            sort,
        });
        // #endregion

        let hadSuccessfulFetch = false;
        let clearTicketsPromise: Promise<void> | undefined = undefined;

        const triedClearTicketsPromise = new Promise<void>((resolve) => {
            if (clearTicketsPromise) {
                clearTicketsPromise
                    .then(() => {
                        console.log('Cleared orders from indexed db.');
                    })
                    .catch((e) => {
                        // Clear only if we have internet access
                        // ignore since some browsers don't support databases
                        console.error('Failed clear orders from indexed db.');
                        console.error(e);
                    })
                    .finally(resolve);
                return;
            }

            resolve();
        });

        const storeTicketsPromises: Promise<void>[] = [];
        let hasUpdatedTickets = false;

        const onResultsReceivedHelper = async (tickets: TicketPrivate[]): Promise<void> => {
            if (isFetchAll && !hadSuccessfulFetch) {
                hadSuccessfulFetch = true;
                // todo
                clearTicketsPromise = Promise.resolve();
            }

            // prevent that tickets get added to indexed db before the db was cleared
            await triedClearTicketsPromise;

            if (tickets.length > 0) {
                if (!hasUpdatedTickets) {
                    hasUpdatedTickets = true;
                }
                const nonDeletedTickets: TicketPrivate[] = [];

                for (const ticket of tickets) {
                    if (ticket.deletedAt) {
                        continue;
                    }

                    nonDeletedTickets.push(ticket);
                }

                const storeTicketsPromise = this.storeTickets(tickets);
                storeTicketsPromises.push(storeTicketsPromise);

                const promises: Promise<unknown>[] = [
                    storeTicketsPromise,
                    // todo: this should be run sync?
                    this.setLastFetchedTicket(tickets[tickets.length - 1]),
                ];

                if (callback) {
                    callback(nonDeletedTickets);
                }

                if (tickets.length > 0) {
                    // deleted tickets get handled in listener
                    promises.push(this.ticketsEventBus.sendEvent('fetched', tickets));
                }

                await Promise.all(promises.map(promise => promise.catch(console.error)));
            }
        };

        // run async
        const onResultsReceived: (tickets: TicketPrivate[]) => void = (tickets) => {
            onResultsReceivedHelper(tickets).catch(console.error);
        };

        try {
            await fetchAll(filteredRequest, fetcher, { onResultsReceived });
        }
        finally {
            this.isLoadingTickets = false;
        }

        // wait for all orders to be stored
        await Promise.all(storeTicketsPromises);
        this.lastUpdatedTickets = new Date();
        return hasUpdatedTickets;
    }
}
