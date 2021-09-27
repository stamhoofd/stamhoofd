import { column, Database, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { OrderData, OrderStatus, PaymentMethod, ProductType, WebshopTicketType } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { Email } from '@stamhoofd/email';
import { Organization } from './Organization';
import { Payment } from './Payment';
import { Webshop } from './Webshop';
import { WebshopCounter } from '../helpers/WebshopCounter';
import { QueueHandler } from "@stamhoofd/queues";
import { Ticket } from "./Ticket";


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
        },
        skipUpdate: true
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
     * Fetch an order
     */
    static async getForPayment(organizationId: string, paymentId: string): Promise<Order | undefined> {
        const order = (await this.where({ paymentId }, { limit: 1 }))[0]
        if (!order) {
            return
        }
        if (order.organizationId !== organizationId) {
            // Security check
            return
        }
        return order
    }

    shouldIncludeStock() {
        return this.status !== OrderStatus.Canceled
    }

    async onPaymentFailed(this: Order) {
        if (this.shouldIncludeStock()) {
            this.status = OrderStatus.Canceled
            await this.save()

            await QueueHandler.schedule("webshop-stock/"+this.webshopId, async () => {
                // Fetch webshop inside queue to make sure the stock is up to date
                const webshop = await Webshop.getByID(this.webshopId);
                if (!webshop) {
                    // ignore for now
                    console.error("Missing webshop with id "+this.webshopId+" in webshop stock queue for order "+this.id)
                    return
                }
                
                await this.setRelation(Order.webshop, webshop).updateStock() // remove reserved stock
            })
        }
    }

    /**
     * Adds or removes the order to the stock of the webshop (if it wasn't already included). If amounts were changed, only those
     * changes will get added
     * Should always happen in the webshop-stock queue to prevent multiple webshop writes at the same time
     * + in combination with validation and reading the webshop
     */
    async updateStock(this: Order & { webshop: Webshop }) {
        // Add or delete this order from the stock?
        const add = this.shouldIncludeStock()

        let changed = false
        for (const item of this.data.cart.items) {
            const difference = add ? (item.amount - item.reservedAmount) : -item.reservedAmount
            if (difference !== 0) {
                const product = this.webshop.products.find(p => p.id === item.product.id)
                if (product) {
                    product.usedStock += difference
                    if (product.usedStock < 0) {
                        product.usedStock = 0
                    }

                    // Keep track that we included this order in the stock already
                    item.reservedAmount += difference
                    changed = true
                }
            }
        }
        if (changed) {
            await this.webshop.save()
            await this.save()
        }
    }

    /**
     * Only call this once! Make sure you use the queues correctly
     */
    async markPaid(this: Order, payment: Payment | null, organization: Organization, knownWebshop?: Webshop) {
        console.log("Marking order "+this.id+" as paid")
        const webshop = (knownWebshop ?? (await Webshop.getByID(this.webshopId)))?.setRelation(Webshop.organization, organization);
        if (!webshop) {
            console.error("Missing webshop for order "+this.id)
            return
        }

        // Create tickets if needed (we might already be valid in case of transfer payments)
        let tickets: Ticket[] = []

        if (webshop.meta.ticketType === WebshopTicketType.Tickets) {
            const ticketMap = new Map<string, number>()

            for (const item of this.data.cart.items) {
                if (item.product.type === ProductType.Ticket || item.product.type === ProductType.Voucher) {
                    const offset = ticketMap.get(item.product.id) ?? 0

                    // Separate ticket if multiple amounts
                    for (let index = 0; index < item.amount; index++) {
                        const ticket = new Ticket()
                        ticket.orderId = this.id
                        ticket.itemId = item.id
                        ticket.organizationId = this.organizationId
                        ticket.webshopId = this.webshopId

                        // Relative index for items with same properties
                        ticket.index = offset + index + 1
                        ticket.total = item.getTotalAmount(this.data.cart)

                        // Do not save yet
                        tickets.push(ticket)
                    }

                    ticketMap.set(item.product.id, offset + item.amount)
                }
            }
        } else if (webshop.meta.ticketType === WebshopTicketType.SingleTicket) {
            // Create a shared ticket for the whole order
            const ticket = new Ticket()
            ticket.orderId = this.id
            ticket.itemId = null
            ticket.organizationId = this.organizationId
            ticket.webshopId = this.webshopId

            // Relative index for items with same properties
            ticket.index = 1
            ticket.total = 1

            // Do not save yet
            tickets.push(ticket)
        }

        let didCreateTickets = false

        if (tickets.length > 0) {
            // First check if we already have tickets
            const existingTickets = !this.id ? [] : await Ticket.where({ orderId: this.id }, { limit: 1, select: "id" })
            if (existingTickets.length > 0) {
                // Skip
                tickets = existingTickets
            } else {
                // Create the tickets
                didCreateTickets = true

                if (!this.id) {
                    await this.save()
                    for (const ticket of tickets) {
                        ticket.orderId = this.id
                    }
                }

                // Wait to save them all
                console.log("Saving tickets for order "+this.id)
                await Promise.all(tickets.map((ticket) => ticket.save()))
            }
        }

        // Needs to happen before validation, because we can include the tickets in the validation that way

        if (this.validAt === null) {
            await this.setRelation(Order.webshop, webshop).markValid(payment, tickets)
        } else {
            if (didCreateTickets && this.data.customer.email.length > 0) {
                const organization = webshop.organization
                
                const { from, replyTo } = organization.getDefaultEmail()
            
                const customer = this.data.customer

                const toStr = this.data.customer.name ? ('"'+this.data.customer.name.replace("\"", "\\\"")+"\" <"+this.data.customer.email+">") : this.data.customer.email

                // Also send a copy
                Email.send({
                    from,
                    replyTo,
                    to: toStr,
                    subject: "["+webshop.meta.name+"] Jouw tickets zijn beschikbaar (bestelling "+this.number+")",
                    text: "Dag "+customer.firstName+", \n\nWe hebben de betaling van bestelling "+ this.number +" ontvangen en jouw tickets kan je nu downloaden via de link hieronder:"
                    + "\n"
                    + this.setRelation(Order.webshop, webshop).getUrl()
                    +"\n\nMet vriendelijke groeten,\n"+organization.name+"\n\n—\n\nOnze ticketverkoop werkt via het Stamhoofd platform, op maat van verenigingen. Probeer het ook via https://www.stamhoofd.be/ticketverkoop\n\n",
                })
            }
        }
    }

    /**
     * WARNING: this should always run inside a queue so it only runs once for the same orde
     * Include any tickets that are generated and should be included in the e-mail
     */
    async markValid(this: Order & { webshop: Webshop & { organization: Organization } }, payment: Payment | null, tickets: Ticket[]) {
        console.log("Marking as valid: order "+this.id)
        const wasValid = this.validAt !== null

        if (wasValid) {
            console.warn("Warning: already validated an order")
            return
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

            if (tickets.length > 0) {
                // Also send a copy
                Email.send({
                    from,
                    replyTo,
                    to: toStr,
                    subject: "["+webshop.meta.name+"] Jouw tickets (bestelling "+this.number+")",
                    text: "Dag "+customer.firstName+", \n\nBedankt voor jouw bestelling! We hebben deze goed ontvangen. "+
                        "Je kan jouw tickets downloaden en jouw bestelling nakijken via deze link::"
                    + "\n"
                    + this.setRelation(Order.webshop, webshop).getUrl()
                    +"\n\nMet vriendelijke groeten,\n"+organization.name+"\n\n—\n\nOnze ticketverkoop werkt via het Stamhoofd platform, op maat van verenigingen. Probeer het ook via https://www.stamhoofd.be/webshops\n\n",
                })
            } else {
                if (this.webshop.meta.ticketType === WebshopTicketType.None) {
                    // Also send a copy
                    Email.send({
                        from,
                        replyTo,
                        to: toStr,
                        subject: "["+webshop.meta.name+"] Bestelling "+this.number,
                        text: "Dag "+customer.firstName+", \n\nBedankt voor jouw bestelling! We hebben deze goed ontvangen. "+
                            ((payment && payment.method === PaymentMethod.Transfer) ? "Je kan de betaalinstructies en bestelling nakijken via deze link:" :  "Je kan jouw bestelling nakijken via deze link:")
                        + "\n"
                        + this.setRelation(Order.webshop, webshop).getUrl()
                        +"\n\nMet vriendelijke groeten,\n"+organization.name+"\n\n—\n\nOnze webshop werkt via het Stamhoofd platform, op maat van verenigingen. Probeer het ook via https://www.stamhoofd.be/webshops\n\n",
                    })
                } else {
                    // Also send a copy
                    Email.send({
                        from,
                        replyTo,
                        to: toStr,
                        subject: "["+webshop.meta.name+"] Bestelling "+this.number,
                        text: "Dag "+customer.firstName+", \n\nBedankt voor jouw bestelling! We hebben deze goed ontvangen. "+
                            ((payment && payment.method === PaymentMethod.Transfer) ? "Zodra jouw overschrijving op onze rekening aankomt, ontvang je jouw tickets via e-mail. Je kan de betaalinstructies en bestelling nakijken via deze link:" :  "Je kan jouw bestelling nakijken via deze link:")
                        + "\n"
                        + this.setRelation(Order.webshop, webshop).getUrl()
                        +"\n\nMet vriendelijke groeten,\n"+organization.name+"\n\n—\n\nOnze ticketverkoop werkt via het Stamhoofd platform, op maat van verenigingen. Probeer het ook via https://www.stamhoofd.be/ticketverkoop\n\n",
                    })
                }
            }
        }
    }
}