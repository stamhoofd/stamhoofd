import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { SimpleError } from "@simonbackx/simple-errors";
import { Email } from '@stamhoofd/email';
import { QueueHandler } from "@stamhoofd/queues";
import { BalanceItemPaymentWithPrivatePayment,BalanceItemWithPayments, BalanceItemWithPrivatePayments, EmailTemplateType, MemberBalanceItemPayment, Order as OrderStruct, OrderData, OrderStatus, Payment as PaymentStruct, PaymentMethod, PrivateOrder, PrivatePayment, ProductType, Recipient, Replacement, WebshopPreview, WebshopStatus, WebshopTicketType, WebshopTimeSlot } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { getEmailBuilder } from "../helpers/EmailBuilder";
import { WebshopCounter } from '../helpers/WebshopCounter';
import { BalanceItem, EmailTemplate, Organization, Payment, Ticket, Webshop } from './';

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

    @column({ type: "string", nullable: true })
    userId: string | null = null
    
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

    getTransferReplacements(): { [key: string]: string } {
        return {
            nr: this.number?.toString() ?? "",
            email: this.data.customer.email ?? '',
            phone: this.data.customer.phone ?? '',
            name: this.data.customer.name ?? '',
            naam: this.data.customer.name ?? '',
        }
    }

    getUrl(this: Order & { webshop: Webshop & { organization: Organization } }) {
        // Country locales are disabled on webshops (always the same country). But we need to add the language if it isn't the same as the organization default language
        let locale = ""
        if (this.data.consumerLanguage != this.webshop.organization.i18n.language) {
            locale = "/"+this.data.consumerLanguage
        }

        return "https://"+this.webshop.getHost()+locale+"/order/"+this.id
    }

    generateBalanceDescription(webshop: Webshop) {
        if (!this.number) {
            return 'Bestelling - ' + webshop.meta.name
        }
        return 'Bestelling #' + this.number.toString() + ' - ' + webshop.meta.name
    }

    /**
     * Fetch an order
     */
    static async getForPayment(organizationId: string | null, paymentId: string): Promise<Order | undefined> {
        const order = (await this.where({ paymentId }, { limit: 1 }))[0]
        if (!order) {
            return
        }
        if (organizationId !== null && order.organizationId !== organizationId) {
            // Security check
            return
        }
        return order
    }

    shouldIncludeStock() {
        return this.status !== OrderStatus.Canceled && this.status !== OrderStatus.Deleted
    }

    get totalToPay() {
        if (this.status === OrderStatus.Canceled || this.status === OrderStatus.Deleted) {
            return 0
        }
        return this.data.totalPrice
    }

    async undoPaymentFailed(this: Order, _payment: Payment | null, _organization: Organization) {
        if (this.status !== OrderStatus.Deleted && this.status !== OrderStatus.Canceled) {
            this.markUpdated()
            await this.save()
            return
        }

        console.log('Undoing payment failed for order '+this.id)
        this.markUpdated()
        this.status = OrderStatus.Created
        await this.save()

        await QueueHandler.schedule("webshop-stock/"+this.webshopId, async () => {
            // Fetch webshop inside queue to make sure the stock is up to date
            const webshop = await Webshop.getByID(this.webshopId);
            if (!webshop) {
                // ignore for now
                console.error("Missing webshop with id "+this.webshopId+" in webshop stock queue for order "+this.id)
                return
            }
            
            await this.setRelation(Order.webshop, webshop).updateStock() // readd reserved stock
        })
    }

    async onPaymentFailed(this: Order, payment: Payment | null, organization: Organization) {
        if (this.shouldIncludeStock()) {
            this.markUpdated()
            if (this.number === null) {
                this.status = OrderStatus.Deleted
            }
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

            // Send an email if the payment failed after 15 minutes being pending
            const difference = new Date().getTime() - this.createdAt.getTime()
            if (difference > 1000 * 60 * 10 && difference < 1000 * 60 * 60 * 24) {

                if (payment && payment.method !== PaymentMethod.Transfer && payment.method !== PaymentMethod.PointOfSale) {
                    console.log('Marked order '+this.id+' as payment failed after ' + (difference / 1000 / 60).toFixed(1) + ' mins. Sending email.')
                    const webshop = await Webshop.getByID(this.webshopId)

                    if (!webshop) {
                        console.error("Missing organization or webshop for order "+this.id)
                        return
                    }

                    const { from, replyTo } = organization.getEmail(webshop.privateMeta.defaultEmailId, true)

                    await this.setRelation(Order.webshop, webshop.setRelation(Order.organization, organization)).sendEmailTemplate({
                        type: EmailTemplateType.OrderOnlinePaymentFailed,
                        from,
                        replyTo
                    })
                } else {
                    console.log('Marked order '+this.id+' as payment failed after ' + (difference / 1000 / 60).toFixed(1) + ' mins. Payment method not matching.')
                }
            } else {
                console.log('Marked order '+this.id+' as payment failed after ' + (difference / 1000 / 60).toFixed(1) + ' mins. Not sending email.')
            }
        } else {
            this.markUpdated()
            await this.save()
        }
    }

    /**
     * Adds or removes the order to the stock of the webshop (if it wasn't already included). If amounts were changed, only those
     * changes will get added
     * Should always happen in the webshop-stock queue to prevent multiple webshop writes at the same time
     * + in combination with validation and reading the webshop
     */
    async updateStock(this: Order & { webshop: Webshop }, previousData: OrderData | null = null) {
        // Previous data?

        // Add or delete this order from the stock?
        const add = this.shouldIncludeStock()

        let changed = false

        if (previousData !== null) {
            // Remove stock from old items without modifying old data
            for (const item of previousData.cart.items) {
                const product = this.webshop.products.find(p => p.id === item.product.id)
                if (product) {
                    if (item.reservedAmount > 0) {
                        product.usedStock -= item.reservedAmount
                        if (product.usedStock < 0) {
                            product.usedStock = 0
                        }
                        changed = true
                    }

                    // Product price
                    for (const [priceId, amount] of item.reservedPrices) {
                        const productPrice = product.prices.find(p => p.id === priceId)
                        if (productPrice) {
                            productPrice.usedStock -= amount
                            if (productPrice.usedStock < 0) {
                                productPrice.usedStock = 0
                            }
                            changed = true
                        }
                    }

                    // Options
                    for (const [optionId, amount] of item.reservedOptions) {
                        const option = product.optionMenus.flatMap(om => om.options).find(o => o.id === optionId)
                        if (option) {
                            option.usedStock -= amount
                            if (option.usedStock < 0) {
                                option.usedStock = 0
                            }
                            changed = true
                        }
                    }

                    // Seats
                    if (item.reservedSeats.length > 0) {
                        product.reservedSeats = product.reservedSeats.filter(s => !item.reservedSeats.find(s2 => s2.equals(s)))
                        changed = true
                    }
                }
            }
        }

        for (const item of this.data.cart.items) {
            if (previousData !== null) {
                // If we have previousData, we already removed the stock from the old items, so reservedAmount is always zero
                item.reservedAmount = 0
                item.reservedPrices = new Map()
                item.reservedOptions = new Map()
                changed = true
            }

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

                    const productPrice = product.prices.find(p => p.id === item.productPrice.id)
                    if (productPrice) {
                        productPrice.usedStock += difference
                        if (productPrice.usedStock < 0) {
                            productPrice.usedStock = 0
                        }

                        // Keep track that we included this order in the stock already
                        item.reservedPrices.set(productPrice.id, (item.reservedPrices.get(productPrice.id) ?? 0) + difference)
                    }

                    // Options
                    for (const cartItemOption of item.options) {
                        const option = product.optionMenus.find(om => om.id === cartItemOption.optionMenu.id)?.options.find(o => o.id === cartItemOption.option.id)
                        if (option) {
                            option.usedStock += difference
                            if (option.usedStock < 0) {
                                option.usedStock = 0
                            }

                            // Keep track that we included this order in the stock already
                            item.reservedOptions.set(option.id, (item.reservedOptions.get(option.id) ?? 0) + difference)
                        }
                    }
                }
            }
        }

        if (previousData !== null && previousData.timeSlot) {
            // Changed timeslot. Remove all reserved ones
            const ps = previousData.timeSlot
            const timeSlot = this.webshop.meta.checkoutMethods.flatMap(m => m.timeSlots).flatMap(t => t.timeSlots).find(t => t.id === ps.id)
            if (timeSlot) {
                // Remove any reserved stock
                const updated = Order.updateTimeSlotStock(timeSlot, this.data, false)
                changed = changed || updated
            } else {
                this.data.reservedOrder = false
                this.data.reservedPersons = 0
                changed = true
            }
        }

        if (this.data.timeSlot !== null) {
            const s = this.data.timeSlot
            const timeSlot = this.webshop.meta.checkoutMethods.flatMap(m => m.timeSlots).flatMap(t => t.timeSlots).find(t => t.id === s.id)

            if (timeSlot) {
                const updated = Order.updateTimeSlotStock(timeSlot, this.data, add)
                changed = changed || updated
            } else {
                console.error("Missing timeslot "+s.id+" in webshop "+this.webshopId)
            }
        }

        // Seats
        for (const item of this.data.cart.items) {
            if (item.seats.length > 0) {
                const product = this.webshop.products.find(p => p.id === item.product.id)
                if (product) {
                    // First remove all, to avoid duplicates
                    for (const seat of item.seats) {
                        product.reservedSeats = product.reservedSeats.filter(s => !s.equals(seat))

                        if (add) {
                            product.reservedSeats.push(seat)
                        }
                    }
                    changed = true
                    item.reservedSeats = add ? item.seats : []
                }
            }
        }

        if (changed) {
            await this.webshop.save()
            await this.save()
        }
    }

    private static updateTimeSlotStock(timeSlot: WebshopTimeSlot, data: OrderData, add: boolean) {
        let changed = false
        if (data.reservedOrder !== add) {
            data.reservedOrder = add
            timeSlot.usedOrders += add ? 1 : -1
            if (timeSlot.usedOrders < 0) {
                timeSlot.usedOrders = 0
            }
            changed = true
        }

        const personDifference = (add ? data.cart.persons : 0) - data.reservedPersons 

        if (personDifference !== 0) {
            timeSlot.usedPersons += personDifference
            if (timeSlot.usedPersons < 0) {
                timeSlot.usedPersons = 0
            }
            data.reservedPersons += personDifference
            changed = true
        }
        return changed
    }

    async updateTickets(this: Order & { webshop: Webshop }): Promise<{ tickets: Ticket[], didCreateTickets: boolean }> {
        const webshop = this.webshop

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

                        // Seat
                        ticket.seat = item.seats.length > 0 ? item.seats[index] : null
                        ticket.originalSeat = ticket.seat

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
            const existingTickets = !this.id ? [] : await Ticket.where({ orderId: this.id })
            if (existingTickets.length > 0) {
                // Skip
                // Check difference: do we need to create new tickets or not?
                const mergedTickets: Ticket[] = []
                for (const ticket of tickets) {
                    // Check if this combination already exists or not. Else create it. Update existing total if needed
                    const existing = existingTickets.find(existing => existing.itemId === ticket.itemId && ticket.index === existing.index)
                    if (existing) {
                        existing.total = ticket.total
                        existing.seat = ticket.seat
                        mergedTickets.push(existing)
                    } else {
                        didCreateTickets = true
                        mergedTickets.push(ticket)
                    }
                }

                tickets = mergedTickets

                // Wait to save them all
                console.log("Saving merged tickets for order "+this.id)
                await Promise.all(tickets.map((ticket) => ticket.save()))

                // Delete others
                for (const existing of existingTickets) {
                    if (!mergedTickets.find(m => m.id === existing.id)) {
                        console.log("Deleting ticket for order "+this.id+", ticket id = "+existing.id)
                        await existing.delete()
                    }
                }
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

        return { tickets, didCreateTickets }
    }

    markUpdated() {
        this.updatedAt = new Date()

        // Also save if this is the only saved property
        this.forceSaveProperty("updatedAt")
    }

    /**
     * A payment changed the total paid amount
     */
    async paymentChanged(this: Order, payment: Payment | null, organization: Organization, knownWebshop?: Webshop) {
        this.markUpdated()
        await this.save()
    }

    async undoPaid(this: Order, payment: Payment | null, organization: Organization, knownWebshop?: Webshop) {
        this.markUpdated()
        await this.save()
    }

    /**
     * Only call this once! Make sure you use the queues correctly
     */
    async markPaid(this: Order, payment: Payment | null, organization: Organization, knownWebshop?: Webshop) {
        console.log("Marking order "+this.id+" as paid")
        this.markUpdated()
        await this.save()
        const webshop = (knownWebshop ?? (await Webshop.getByID(this.webshopId)))?.setRelation(Webshop.organization, organization);
        if (!webshop) {
            console.error("Missing webshop for order "+this.id)
            return
        }

        if (this.status === OrderStatus.Deleted) {
            await this.undoPaymentFailed(payment, organization)
        }

        const { tickets, didCreateTickets } = await this.setRelation(Order.webshop, webshop).updateTickets()

        // Needs to happen before validation, because we can include the tickets in the validation that way
        if (this.validAt === null) {
            await this.setRelation(Order.webshop, webshop).markValid(payment, tickets)
        } else {
            if (!this.data.shouldSendPaymentUpdates) {
                console.log("Skip sending paid email for order "+this.id)
                return
            }
            if (this.data.customer.email.length > 0){
                if (didCreateTickets) {
                    await this.setRelation(Order.webshop, webshop).sendTickets()
                } else {
                    if (payment && payment.method === PaymentMethod.Transfer) {
                        await this.setRelation(Order.webshop, webshop).sendPaidMail()
                    }
                }
            }
        }
    }

    async sendPaidMail(this: Order & { webshop: Webshop & { organization: Organization } }) {        
        const organization = this.webshop.organization
        const { from, replyTo } = organization.getEmail(this.webshop.privateMeta.defaultEmailId, true)

        await this.sendEmailTemplate({
            type: EmailTemplateType.OrderReceivedTransfer,
            from,
            replyTo
        })
    }

    async sendTickets(this: Order & { webshop: Webshop & { organization: Organization } }) {        
        const organization = this.webshop.organization
        const { from, replyTo } = organization.getEmail(this.webshop.privateMeta.defaultEmailId, true)

        await this.sendEmailTemplate({
            type: EmailTemplateType.TicketsReceivedTransfer,
            from,
            replyTo
        })
    }

    getStructureWithoutPayment()  {
        return OrderStruct.create({...this});
    }

    static async getStructures(orders: Order[]): Promise<OrderStruct[]> {
        if (orders.length === 0) {
            return []
        }

        // Balance items
        const allBalanceItems = await BalanceItem.where({ orderId: {
            sign: "IN",
            value: orders.map(o => o.id)
        } })

        const {payments, balanceItemPayments} = await BalanceItem.loadPayments(allBalanceItems)

        const structures: OrderStruct[] = []
        for (const order of orders) {
            const balanceItems = allBalanceItems.filter(b => b.orderId === order.id)

            const balanceItemStructures = balanceItems.map((balanceItem) => {
                return BalanceItemWithPayments.create({
                    ...balanceItem,
                    payments: balanceItemPayments.filter(b => b.balanceItemId === balanceItem.id).map(balanceItemPayment => {
                        const payment = payments.find(pp => pp.id === balanceItemPayment.paymentId)!
                        return MemberBalanceItemPayment.create({
                            ...balanceItemPayment,
                            payment: PaymentStruct.create(payment)
                        })
                    })
                });
            })

            structures.push(
                OrderStruct.create({
                    ...order,
                    balanceItems: balanceItemStructures,
                    // Compatibility
                    payment: balanceItemStructures[0]?.payments[0]?.payment ?? null
                })
            )
        }

        return structures
    }

    static async getPrivateStructures(orders: Order[]): Promise<PrivateOrder[]> {
        if (orders.length === 0) {
            return []
        }

        // Balance items
        const allBalanceItems = await BalanceItem.where({ orderId: {
            sign: "IN",
            value: orders.map(o => o.id)
        } })

        const {payments, balanceItemPayments} = await BalanceItem.loadPayments(allBalanceItems)

        const structures: PrivateOrder[] = []
        for (const order of orders) {
            const balanceItems = allBalanceItems.filter(b => b.orderId === order.id)

            const balanceItemStructures = balanceItems.map((balanceItem) => {
                return BalanceItemWithPrivatePayments.create({
                    ...balanceItem,
                    payments: balanceItemPayments.filter(b => b.balanceItemId === balanceItem.id).map(balanceItemPayment => {
                        const payment = payments.find(pp => pp.id === balanceItemPayment.paymentId)!
                        return BalanceItemPaymentWithPrivatePayment.create({
                            ...balanceItemPayment,
                            payment: PrivatePayment.create(payment)
                        })
                    })
                });
            })

            structures.push(
                PrivateOrder.create({
                    ...order,
                    balanceItems: balanceItemStructures,
                    // Compatibility
                    payment: balanceItemStructures[0]?.payments[0]?.payment ?? null
                })
            )
        }

        return structures
    }


    async getStructure()  {
       return (await Order.getStructures([this]))[0]!
    }

    async sendEmailTemplate(this: Order & { webshop: Webshop & { organization: Organization } }, data: {
        type: EmailTemplateType,
        from: string,
        replyTo?: string,
        to?: Recipient,
    }) {
        // Never send an email for archived webshops
        if (this.webshop.meta.status === WebshopStatus.Archived) {
            return
        }

        // First fetch template
        let templates = (await EmailTemplate.where({ type: data.type, webshopId: this.webshop.id }))

        if (templates.length == 0) {
            templates = (await EmailTemplate.where({ type: data.type, organizationId: null }))
        }

        if (templates.length == 0) {
            console.error("Could not find email template for type "+data.type)
            return
        }

        const template = templates[0]

        let recipient = (await this.getStructure()).getRecipient(
            await this.webshop.organization.getStructure(), 
            WebshopPreview.create(this.webshop)
        )

        if (data.to) {
            // Clear first and last name
            recipient.firstName = null;
            recipient.lastName = null;
            recipient.replacements = recipient.replacements.filter(r => !['firstName', 'lastName'].includes(r.token))
            data.to.merge(recipient);
            recipient = data.to
        }

        // Create e-mail builder
        const builder = await getEmailBuilder(this.webshop.organization, {
            recipients: [recipient],
            subject: template.subject,
            html: template.html,
            // text: template.text,
            from: data.from,
            replyTo: data.replyTo,
            type: 'transactional',
            defaultReplacements: this.webshop.meta.getEmailReplacements()
        })

        Email.schedule(builder)
    }

    /**
     * WARNING: this should always run inside a queue so it only runs once for the same orde
     * Include any tickets that are generated and should be included in the e-mail
     */
    async markValid(this: Order & { webshop: Webshop & { organization: Organization } }, payment: Payment | null, tickets: Ticket[]) {
        const webshop = this.webshop
        const organization = webshop.organization

        console.log("Marking as valid: order "+this.id)
        const wasValid = this.validAt !== null

        if (wasValid) {
            console.warn("Warning: already validated an order")
            return
        }
        this.validAt = new Date() // will get flattened AFTER calculations
        this.validAt.setMilliseconds(0)
        this.number = await WebshopCounter.getNextNumber(this.webshopId, this.webshop.privateMeta.numberingType)

        if (payment && !Order.payment.isLoaded(this)) {
            this.setRelation(Order.payment, payment)
        }

        // Now we have a number, update the payment
        if (payment && payment.method === PaymentMethod.Transfer) {
            // Only now we can update the transfer description, since we need the order number as a reference
            payment.transferSettings = webshop.meta.transferSettings.fillMissing(organization.mappedTransferSettings)

            if (!payment.transferSettings.iban) {
                throw new SimpleError({
                    code: "no_iban",
                    message: "No IBAN",
                    human: "Er is geen rekeningnummer ingesteld voor overschrijvingen. Contacteer de beheerder."
                })
            }
            payment.generateDescription(organization, this.number.toString(), this.getTransferReplacements())
            await payment.save();
        }

        await this.save()

        if (this.data.customer.email.length > 0) {
            const webshop = this.webshop
            const organization = webshop.organization
            
            const { from, replyTo } = organization.getEmail(webshop.privateMeta.defaultEmailId, true)
        
            if (tickets.length > 0) {
                // Also send a copy
                if (payment && payment.method === PaymentMethod.PointOfSale) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.TicketsConfirmationPOS,
                        from,
                        replyTo
                    })
                } else {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.TicketsConfirmation,
                        from,
                        replyTo
                    })
                }
            } else {
                if (this.webshop.meta.ticketType === WebshopTicketType.None) {

                    if (payment && payment.method === PaymentMethod.Transfer) {
                        // Also send a copy
                        await this.sendEmailTemplate({
                            type: EmailTemplateType.OrderConfirmationTransfer,
                            from,
                            replyTo
                        })
                    } else if (payment && payment.method === PaymentMethod.PointOfSale) {
                        await this.sendEmailTemplate({
                            type: EmailTemplateType.OrderConfirmationPOS,
                            from,
                            replyTo
                        })
                    } else {
                        // Also send a copy
                        await this.sendEmailTemplate({
                            type: EmailTemplateType.OrderConfirmationOnline,
                            from,
                            replyTo
                        })
                    }
                    
                } else {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.TicketsConfirmationTransfer,
                        from,
                        replyTo
                    })
                }
            }
        }

        if (this.webshop.privateMeta.notificationEmails) {
            const webshop = this.webshop
            const organization = webshop.organization
            const { from, replyTo } = organization.getEmail(webshop.privateMeta.defaultEmailId, true)
            const i18n = organization.i18n;

            const webshopDashboardUrl = "https://"+(STAMHOOFD.domains.dashboard ?? "stamhoofd.app")+"/"+i18n.locale + '/webshops/'+Formatter.slug(webshop.meta.name)+'/orders';

            // Send an email to all these notification emails
            for (const email of this.webshop.privateMeta.notificationEmails) {
                await this.sendEmailTemplate({
                    type: EmailTemplateType.OrderNotification,
                    from,
                    replyTo,
                    to: Recipient.create({
                        email,
                        replacements: [
                            Replacement.create({
                                token: 'orderUrl',
                                value: webshopDashboardUrl
                            })
                        ]
                    })
                })
            }
        }
    }
}