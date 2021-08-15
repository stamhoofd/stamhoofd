import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { v4 as uuidv4 } from "uuid";

import { Organization } from './Organization';
import { Webshop } from './Webshop';
import { Order } from "./Order";

import basex from "base-x";
import crypto from "crypto";

// Note: 0 and O is removed to prevent typing it in wrong
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const bs58 = basex(ALPHABET)

async function randomBytes(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err: Error | null, buf: Buffer) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(buf);
        });
    });
}

/**
 * Use this method when you don't need access to the items of an order.
 * This avoids the select in the database, saving some bytes in network communication 
 * (especially needed when clients requests all the changed tickets)
 */
export class Ticket extends Model {
    static table = "webshop_tickets";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    /**
     * Unique per webshop. Used for lookups
     */
    @column({ type: "string", async beforeSave(value) {
        return value ?? bs58.encode(await randomBytes(10));
    } })
    secret!: string


    @column({ foreignKey: Ticket.organization, type: "string" })
    organizationId: string;

    @column({ foreignKey: Ticket.webshop, type: "string" })
    webshopId: string;

    /**
     * Important note: access to a ticket doesn't guarantee access to an order
     * because one person could buy 10 tickets and share them with friends.
     * The order details should remain private to a ticket holder except for the item details
     * + also the orderID should remain private for the holder (since this provides access via URL, need to add a secret here)
     */
    @column({ foreignKey: Ticket.order, type: "string" })
    orderId: string

    /**
     * null = whole order
     */
    @column({ type: "string", nullable: true })
    itemId: string | null = null

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    @column({ type: "datetime", nullable: true })
    scannedAt: Date | null = null

    @column({ type: "string", nullable: true })
    scannedBy: string | null = null

    static webshop = new ManyToOneRelation(Webshop, "webshop");
    static order = new ManyToOneRelation(Order, "order");
    static organization = new ManyToOneRelation(Organization, "organization");

    getUrl(this: Ticket & { webshop: Webshop & { organization: Organization } }) {
        return "https://"+this.webshop.getHost()+"/ticket/"+this.secret
    }
}