import { ArrayDecoder, AutoEncoderPatchType, Decoder, ObjectData } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";
import { Request } from "@simonbackx/simple-networking";
import { NetworkManager, SessionManager } from "@stamhoofd/networking";
import { Order, PaginatedResponse, PaginatedResponseDecoder, PrivateWebshop, TicketPrivate, Version, WebshopOrdersQuery, WebshopPreview, WebshopTicketsQuery } from "@stamhoofd/structures";

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


    lastFetchedOrder: { updatedAt: Date, number: number } | null | undefined = undefined
    lastFetchedTicket: { updatedAt: Date, id: string } | null | undefined = undefined
    isLoadingOrders = false
    isLoadingTickets = false

    /**
     * Listen for new orders that are being fetched or loaded
     */
    ordersEventBus = new EventBus<string, Order[]>()

    constructor(preview: WebshopPreview) {
        this.preview = preview
    }

    /**
     * Cancel all pending loading states and retries
     */
    close() {
        Request.cancelAll(this)
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
            this.webshop = webshop
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
            const version = Version + 2
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
                    db.createObjectStore("tickets", { keyPath: "secret" });
                    db.createObjectStore("settings", {});
                } else {
                    db.deleteObjectStore("orders");
                    db.deleteObjectStore("tickets");
                    db.deleteObjectStore("settings");

                    db.createObjectStore("orders", { keyPath: "id" });
                    db.createObjectStore("tickets", { keyPath: "secret" });
                    db.createObjectStore("settings", {});

                    // For now: we clear all stores if we have a version update
                    /*DBOpenRequest.transaction!.objectStore("orders").clear()
                    DBOpenRequest.transaction!.objectStore("tickets").clear()
                    DBOpenRequest.transaction!.objectStore("settings").clear()*/
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
            const transaction = db.transaction(["orders"], "readonly");

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

    async setlastFetchedOrder(order: Order) {
        this.lastFetchedOrder = {
            updatedAt: order.updatedAt,
            number: order.number!
        }
        await this.storeSettingKey("lastFetchedOrder", this.lastFetchedOrder)
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
            if (this.lastFetchedOrder === undefined) {
                // Only once (if undefined)
                try {
                    this.lastFetchedOrder = await this.readSettingKey("lastFetchedOrder") ?? null
                } catch (e) {
                    console.error(e)
                    // Probably no database support. Ignore it and load everything.
                    this.lastFetchedOrder = null
                }
            }
            let query: WebshopOrdersQuery | undefined = reset ? WebshopOrdersQuery.create({}) : WebshopOrdersQuery.create({
                updatedSince: this.lastFetchedOrder ? this.lastFetchedOrder.updatedAt : undefined,
                afterNumber: this.lastFetchedOrder ? this.lastFetchedOrder.number : undefined,
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
                    this.setlastFetchedOrder(response.results[response.results.length - 1]).catch(console.error)

                    // Already send these new orders to our listeners, who want to know new incoming orders
                    this.ordersEventBus.sendEvent("fetched", response.results).catch(console.error)
                }
                
                query = response.next
            }
        } finally {
            this.isLoadingOrders = false
        }
    }



    /// TICKETS

    async storeTickets(tickets: TicketPrivate[]) {
        const db = await this.getDatabase()

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(["tickets"], "readwrite");

            transaction.oncomplete = () => {
                resolve()
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event)
            };

            // Do the actual saving
            const objectStore = transaction.objectStore("tickets");

            for (const ticket of tickets) {
                objectStore.put(ticket.encode({ version: Version }));
            }
        })
    }

    async getTicketFromDatabase(secret: string): Promise<TicketPrivate | undefined> {
        const db = await this.getDatabase()

        return new Promise<TicketPrivate | undefined>((resolve, reject) => {
            const transaction = db.transaction(["tickets"], "readonly");

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event)
            };

            // Do the actual saving
            const objectStore = transaction.objectStore("tickets");

            const request = objectStore.get(secret)
            request.onsuccess = () => {
                const rawTicket = request.result

                if (rawTicket === undefined) {
                    resolve(undefined)
                }

                const ticket = (TicketPrivate as Decoder<TicketPrivate>).decode(new ObjectData(rawTicket, { version: Version }))
                resolve(ticket)
            }

        })
    }

    async getOrderFromDatabase(id: string): Promise<Order | undefined> {
        const db = await this.getDatabase()

        return new Promise<Order | undefined>((resolve, reject) => {
            const transaction = db.transaction(["orders"], "readonly");

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event)
            };

            // Do the actual saving
            const objectStore = transaction.objectStore("orders");

            const request = objectStore.get(id)
            request.onsuccess = () => {
                const rawOrder = request.result

                if (rawOrder === undefined) {
                    resolve(undefined)
                }

                const order = (Order as Decoder<Order>).decode(new ObjectData(rawOrder, { version: Version }))
                resolve(order)
            }

        })
    }

    async fetchTickets(query: WebshopOrdersQuery, retry = false): Promise<PaginatedResponse<TicketPrivate, WebshopTicketsQuery>> {
        const response = await SessionManager.currentSession!.authenticatedServer.request({
            method: "GET",
            path: "/webshop/"+this.preview.id+"/tickets/private",
            query,
            shouldRetry: retry,
            decoder: new PaginatedResponseDecoder(TicketPrivate as Decoder<TicketPrivate>, WebshopTicketsQuery as Decoder<WebshopTicketsQuery>),
            owner: this
        })

        return response.data
    }

    async setLastFetchedTicket(ticket: TicketPrivate) {
        this.lastFetchedTicket = {
            updatedAt: ticket.updatedAt,
            id: ticket.id!
        }
        await this.storeSettingKey("lastFetchedTicket", this.lastFetchedTicket)
    }

    /**
     * Fetch new orders from the server.
     * Try to avoid this if needed and use the cache first + fetch changes
     */
    async fetchNewTickets(retry = false, reset = false) {
        // Todo: clear local database if resetting
        if (this.isLoadingTickets) {
            return
        }
        this.isLoadingTickets = true

        try {
            if (this.lastFetchedTicket === undefined) {
                // Only once (if undefined)
                try {
                    this.lastFetchedTicket = await this.readSettingKey("lastFetchedTicket") ?? null
                } catch (e) {
                    console.error(e)
                    // Probably no database support. Ignore it and load everything.
                    this.lastFetchedTicket = null
                }
            }
            let query: WebshopTicketsQuery | undefined = reset ? WebshopTicketsQuery.create({}) : WebshopTicketsQuery.create({
                updatedSince: this.lastFetchedTicket ? this.lastFetchedTicket.updatedAt : undefined,
                lastId: this.lastFetchedTicket ? this.lastFetchedTicket.id : undefined,
            })

            while (query) {
                const response: PaginatedResponse<TicketPrivate, WebshopTicketsQuery> = await this.fetchTickets(query, retry)

                if (response.results.length > 0) {
                    // Save these orders to the local database
                    // Non-critical:
                    this.storeTickets(response.results).then(() => {
                        console.log("Saved tickets to the local database")
                    }).catch(console.error)

                    // Non-critical:
                    this.setLastFetchedTicket(response.results[response.results.length - 1]).catch(console.error)
                }
                
                query = response.next
            }
        } finally {
            this.isLoadingOrders = false
        }
    }

}