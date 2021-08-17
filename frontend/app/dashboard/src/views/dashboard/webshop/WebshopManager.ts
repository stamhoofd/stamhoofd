import { ArrayDecoder, AutoEncoderPatchType, Decoder, ObjectData } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";
import { Request } from "@simonbackx/simple-networking";
import { NetworkManager, SessionManager } from "@stamhoofd/networking";
import { Order, PaginatedResponse, PaginatedResponseDecoder, PrivateWebshop, Version, WebshopOrdersQuery, WebshopPreview } from "@stamhoofd/structures";

import { EventBus } from "../../../../../../shared/components";
import { OrganizationManager } from "../../../classes/OrganizationManager";

/**
 * Responsible for managing a single webshop orders and tickets
 * + persistent storage and loading orders from local database instead of the server
 */
export class WebshopManager {
    preview: WebshopPreview
    webshop: PrivateWebshop | null = null
    private webshopPromise: Promise<PrivateWebshop> | null = null

    database: IDBDatabase | null = null
    private databasePromise: Promise<IDBDatabase> | null = null


    lastUpdatedOrder: { updatedAt: Date, number: number } | null | undefined = undefined
    isLoadingOrders = false

    /**
     * Listen for new orders that are being fetched or loaded
     */
    ordersEventBus = new EventBus<string, Order[]>()

    constructor(preview: WebshopPreview) {
        this.preview = preview
    }

    async loadWebshop() {
        const response = await SessionManager.currentSession!.authenticatedServer.request({
            method: "GET",
            path: "/webshop/"+this.preview.id,
            decoder: PrivateWebshop as Decoder<PrivateWebshop>
        })

        // Clone data and keep references
        OrganizationManager.organization.webshops.find(w => w.id == this.preview.id)?.set(response.data)

        return response.data
    }

    async loadWebshopIfNeeded(): Promise<PrivateWebshop> {
        if (this.webshop) {
            return this.webshop
        }

        if (this.webshopPromise) {
            return this.webshopPromise
        }

        this.webshopPromise = this.loadWebshop()
        return this.webshopPromise.then((webshop: PrivateWebshop) => {
            this.webshopPromise = null
            return webshop
        })
    }

    async getDatabase(): Promise<IDBDatabase> {
        if (this.database) {
            return this.database
        }

        if (this.databasePromise) {
            return this.databasePromise
        }

        // Open a connection with our database
        this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
            const version = Version
            const DBOpenRequest = window.indexedDB.open('webshop-'+this.preview.id, version);
            DBOpenRequest.onsuccess = () => {
                this.database = DBOpenRequest.result;
                resolve(DBOpenRequest.result)
            }

            DBOpenRequest.onerror = (event) => {
                console.error(event)
                reject(new SimpleError({
                    code: "not_supported",
                    message: "Jouw browser ondersteunt bepaalde functies niet waardoor we geen bestellingen offline kunnen bijhouden als je internet wegvalt. Probeer in een andere browser te werken."
                }))
            };

            DBOpenRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = DBOpenRequest.result;

                if (event.oldVersion < 1) {
                    // Version 1 is the first version of the database.
                    db.createObjectStore("orders", { keyPath: "id" });
                    db.createObjectStore("tickets", { keyPath: "id" });
                    db.createObjectStore("settings", {});
                } else {
                    // For now: we clear all stores if we have a version update
                    DBOpenRequest.transaction!.objectStore("orders").clear()
                    DBOpenRequest.transaction!.objectStore("tickets").clear()
                    DBOpenRequest.transaction!.objectStore("settings").clear()
                }
            };
        })

        return this.databasePromise.then(database => {
            this.databasePromise = null
            return database
        })
    }

    async readSettingKey(key: IDBValidKey): Promise<any | undefined> {
        const db = await this.getDatabase()

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(["settings"], "readonly");

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event)
            };

            // Do the actual saving
            const objectStore = transaction.objectStore("settings");
            const request = objectStore.get(key)

            request.onsuccess = () => {
                resolve(request.result)
            }
        })
    }

    async storeSettingKey(key: IDBValidKey, value: any) {
        const db = await this.getDatabase()

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(["settings"], "readwrite");

            transaction.oncomplete = () => {
                resolve()
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event)
            };

            // Do the actual saving
            const objectStore = transaction.objectStore("settings");
            objectStore.put(value, key)
        })
    }

    async storeOrders(orders: Order[]) {
        const db = await this.getDatabase()

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(["orders"], "readwrite");

            transaction.oncomplete = () => {
                resolve()
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event)
            };

            // Do the actual saving
            const objectStore = transaction.objectStore("orders");

            for (const order of orders) {
                objectStore.put(order.encode({ version: Version }));
            }
        })
    }

    async getOrdersFromDatabase(): Promise<Order[]> {
        const db = await this.getDatabase()

        return new Promise<Order[]>((resolve, reject) => {
            const transaction = db.transaction(["orders"], "readwrite");

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event)
            };

            // Do the actual saving
            const objectStore = transaction.objectStore("orders");

            const request = objectStore.getAll()
            request.onsuccess = () => {
                const rawOrders = request.result

                // Todo: need version fix here
                const orders = new ArrayDecoder(Order as Decoder<Order>).decode(new ObjectData(rawOrders, { version: Version }))
                resolve(orders)
            }

        })
    }

    async fetchOrders(query: WebshopOrdersQuery, retry = false): Promise<PaginatedResponse<Order, WebshopOrdersQuery>> {
        const response = await SessionManager.currentSession!.authenticatedServer.request({
            method: "GET",
            path: "/webshop/"+this.preview.id+"/orders",
            query,
            shouldRetry: retry,
            decoder: new PaginatedResponseDecoder(Order as Decoder<Order>, WebshopOrdersQuery as Decoder<WebshopOrdersQuery>),
            owner: this
        })

        return response.data
    }

    async patchOrders(patches: AutoEncoderPatchType<Order>[]) {
        const response = await SessionManager.currentSession!.authenticatedServer.request({
            method: "PATCH",
            path: "/webshop/"+this.preview.id+"/orders",
            decoder: new ArrayDecoder(Order as Decoder<Order>),
            body: patches,
            shouldRetry: false
        })

        // Move all data to original order
        try {
            await this.storeOrders(response.data)
        } catch (e) {
            console.error(e)
            // No db support or other error. Should ignore
        }

        await this.ordersEventBus.sendEvent("fetched", response.data)
        return response.data
    }

    async setLastUpdatedOrder(order: Order) {
        this.lastUpdatedOrder = {
            updatedAt: order.updatedAt,
            number: order.number!
        }
        await this.storeSettingKey("lastUpdatedOrder", this.lastUpdatedOrder)
    }

    /**
     * Cancel all pending loading states and retries
     */
    close() {
        Request.cancelAll(this)
    }

    /**
     * Fetch new orders from the server.
     * Try to avoid this if needed and use the cache first + fetch changes
     */
    async fetchNewOrders(retry = false, reset = false) {
        // Todo: clear local database if resetting
        if (this.isLoadingOrders) {
            return
        }
        this.isLoadingOrders = true

        try {
            if (this.lastUpdatedOrder === undefined) {
                // Only once (if undefined)
                this.lastUpdatedOrder = await this.readSettingKey("lastUpdatedOrder") ?? null
            }
            let query: WebshopOrdersQuery | undefined = reset ? WebshopOrdersQuery.create({}) : WebshopOrdersQuery.create({
                updatedSince: this.lastUpdatedOrder ? this.lastUpdatedOrder.updatedAt : undefined,
                afterNumber: this.lastUpdatedOrder ? this.lastUpdatedOrder.number : undefined,
            })

            while (query) {
                const response: PaginatedResponse<Order, WebshopOrdersQuery> = await this.fetchOrders(query, retry)

                if (response.results.length > 0) {
                    // Save these orders to the local database
                    // Non-critical:
                    this.storeOrders(response.results).then(() => {
                        console.log("Saved orders to the local database")
                    }).catch(console.error)

                    // Non-critical:
                    this.setLastUpdatedOrder(response.results[response.results.length - 1]).catch(console.error)

                    // Already send these new orders to our listeners, who want to know new incoming orders
                    this.ordersEventBus.sendEvent("fetched", response.results).catch(console.error)
                }
                
                query = response.next
            }
        } finally {
            this.isLoadingOrders = false
        }
    }

}