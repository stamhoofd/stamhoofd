import { Decoder } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";
import { SessionManager } from "@stamhoofd/networking";
import { Order, PaginatedResponseDecoder, PrivateWebshop, Version, WebshopOrdersQuery, WebshopPreview } from "@stamhoofd/structures";
import { restore } from "pdfkit";

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
            const version = 1
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
                }
            };
        })

        return this.databasePromise.then(database => {
            this.databasePromise = null
            return database
        })
    }

    async readSettingKey(key: IDBValidKey) {
        const db = await this.getDatabase()

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(["settings"], "readonly");

            transaction.oncomplete = () => {
                resolve()
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event)
            };

            // Do the actual saving
            const objectStore = transaction.objectStore("settings");
            objectStore.get(key)
        })
    }

    async storeSettingKey(key: IDBValidKey) {
        const db = await this.getDatabase()

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(["settings"], "readonly");

            transaction.oncomplete = () => {
                resolve()
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event)
            };

            // Do the actual saving
            const objectStore = transaction.objectStore("settings");
            objectStore.get(key)
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

    fetchOrders(query: WebshopOrdersQuery) {
        const response = await SessionManager.currentSession!.authenticatedServer.request({
            method: "GET",
            path: "/webshop/"+this.preview.id+"/orders",
            query,
            decoder: new PaginatedResponseDecoder(Order as Decoder<Order>, WebshopOrdersQuery as Decoder<WebshopOrdersQuery>)
        })
        return response.data.results
    }
}