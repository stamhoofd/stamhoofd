import { column, Database, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { OrderData, OrderStatus } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import Email from '../email/Email';
import { Organization } from './Organization';
import { Payment } from './Payment';
import { Webshop } from './Webshop';
import { WebshopCounter } from './WebshopCounter';


export class Order extends Model {
    static table = "webshop_orders";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ foreignKey: Order.organization, type: "string" })
    organizationId: string;

    @column({ foreignKey: Order.webshop, type: "string" })
    webshopId: string;

    @column({ type: "string", nullable: true, foreignKey: Order.payment })
    paymentId: string | null = null
    
    @column({ type: "json", decoder: OrderData })
    data: OrderData

    @column({ type: "integer", nullable: true })
    number: number | null = null

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
        }
    })
    updatedAt: Date

    @column({ type: "datetime", nullable: true })
    validAt: Date | null = null

    @column({ type: "string" })
    status = OrderStatus.Created

    static webshop = new ManyToOneRelation(Webshop, "webshop");
    static payment = new ManyToOneRelation(Payment, "payment");
    static organization = new ManyToOneRelation(Organization, "organization");

    getUrl(this: Order & { webshop: Webshop & { organization: Organization } }) {
        return "https://"+this.webshop.getHost()+"/order/"+this.id
    }

     /**
     * Fetch all registrations with members with their corresponding (valid) registrations and payment
     */
    static async getForPayment(organization: Organization, paymentId: string): Promise<(Order & { webshop: Webshop & { organization: Organization } }) | undefined> {
        let query = `SELECT ${Order.getDefaultSelect()}, ${Webshop.getDefaultSelect()} from \`${Order.table}\`\n`;
        
        query += `JOIN \`${Webshop.table}\` ON \`${Order.table}\`.\`${Order.webshop.foreignKey}\` = \`${Webshop.table}\`.\`${Webshop.primary.name}\`\n`

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where \`${Order.table}\`.\`paymentId\` = ? LIMIT 1`

        const [results] = await Database.select(query, [paymentId])

        const orders = Order.fromRows(results, Order.table)
        if (orders.length != 1) {
            return undefined;
        }
        
        const webshops = Webshop.fromRows(results, Webshop.table)
        if (webshops.length != 1) {
            return undefined;
        }

        return orders[0].setRelation(Order.webshop, webshops[0].setRelation(Webshop.organization, organization))
    }

    shouldIncludeStock() {
        return this.status !== OrderStatus.Canceled
    }

    async onPaymentFailed(this: Order & { webshop: Webshop }) {
        if (this.status !== OrderStatus.Canceled) {
            this.status = OrderStatus.Canceled
            await this.save()
            await this.updateStock(false) // remove reserved stock
        }
    }

    async updateStock(this: Order & { webshop: Webshop }, add = true) {
        // Update product stock
        let changed = false
        for (const item of this.data.cart.items) {
            if (item.product.stock !== null) {
                const product = this.webshop.products.find(p => p.id === item.product.id)
                if (product) {
                    if (add) {
                        product.usedStock += item.amount
                    } else {
                        product.usedStock -= item.amount
                        if (product.usedStock < 0) {
                            product.usedStock = 0
                        }
                    }
                    changed = true
                }
            }
        }
        if (changed) {
            await this.webshop.save()
        }
    }

    async markValid(this: Order & { webshop: Webshop & { organization: Organization } }) {
        const wasValid = this.validAt !== null

        if (wasValid) {
            console.warn("Warning: already validated an order")
        }
        this.validAt = new Date() // will get flattened AFTER calculations
        this.validAt.setMilliseconds(0)
        this.number = await WebshopCounter.getNextNumber(this.webshopId)
        await this.save()

        if (this.data.customer.email.length > 0) {
            const webshop = this.webshop
            const organization = webshop.organization
            
            const { from, replyTo } = organization.getDefaultEmail()
           
            const customer = this.data.customer

            const toStr = this.data.customer.name ? ('"'+this.data.customer.name.replace("\"", "\\\"")+"\" <"+this.data.customer.email+">") : this.data.customer.email

            // Also send a copy
            Email.send({
                from,
                replyTo,
                to: toStr,
                subject: "["+webshop.meta.name+"] Bestelling "+this.number,
                text: "Dag "+customer.firstName+", \n\nBedankt voor jouw bestelling! We hebben deze goed ontvangen. Je kan jouw bestelling nakijken via \n"+this.getUrl()+"\n\n"+organization.name,
            })
        }
    }


}
