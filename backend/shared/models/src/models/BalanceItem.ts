import { column, Model } from '@simonbackx/simple-database';
import { BalanceItemStatus, MemberBalanceItem, MemberBalanceItemPayment, OrderStatus, Payment as PaymentStruct, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { Organization, Payment, Webshop } from './';

/**
 * Keeps track of how much a member/user owes or needs to be reimbursed.
 */
export class BalanceItem extends Model {
    static table = "balance_items"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    organizationId: string

    @column({ type: "string", nullable: true })
    memberId: string | null = null;

    @column({ type: "string", nullable: true })
    userId: string | null = null;

    /**
     * The registration ID that is linked to this balance item
     */
    @column({ type: "string", nullable: true })
    registrationId: string | null = null;

    /**
     * The order ID that is linked to this balance item
     */
    @column({ type: "string", nullable: true })
    orderId: string | null = null;

    @column({ type: "string" })
    description = "";

    /**
     * Total prices
     */
    @column({ type: "integer" })
    price: number;

    /**
     * Cached value, for optimizations
     */
    @column({ type: "integer" })
    pricePaid = 0

    @column({ type: "string" })
    status = BalanceItemStatus.Pending

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

    async markUpdated(payment: Payment, organization: Organization) {
        // For orders: mark order as changed (so they are refetched in front ends)
        if (this.orderId) {
            const {Order} = await import("./Order");
            const order = await Order.getByID(this.orderId);
            if (order) {
                await order.paymentChanged(payment, organization)
            }
        }
    }

    async markPaid(payment: Payment, organization: Organization) {
        // status and pricePaid changes are handled inside balanceitempayment

        // If registration
        if (this.registrationId) {
            const {Registration} = await import("./Registration");
            const registration = await Registration.getByID(this.registrationId);

            if (registration) {
                // 1. Mark registration as being valid
                if (registration.registeredAt === null) {
                    await registration.markValid()

                    const {Group} = await import("./Group");

                    // Update group occupancy
                    // TODO: maybe we should schedule this, to prevent doing many updates at once
                    const group = await Group.getByID(registration.groupId)
                    if (group) {
                        await group.updateOccupancy()
                        await group.save()
                    }
                }

                // 2. Update registration cached prices  
                // TODO          
            }
        }

        // If order
        if (this.orderId) {
            const {Order} = await import("./Order");
            const order = await Order.getByID(this.orderId);
            if (order) {
                await order.markPaid(payment, organization)

                // Save number in balacance description
                if (order.number !== null) {
                    const webshop = await Webshop.getByID(order.webshopId)

                    if (webshop) {
                        this.description = order.generateBalanceDescription(webshop)
                        await this.save()
                    }
                }
            }
        }
    }

    async undoPaid(payment: Payment, organization: Organization) {
        // If order
        if (this.orderId) {
            const {Order} = await import("./Order");
            const order = await Order.getByID(this.orderId);
            if (order) {
                await order.undoPaid(payment, organization)
            }
        }
    }

    async markFailed(payment: Payment, organization: Organization) {
        // If order
        if (this.orderId) {
            const {Order} = await import("./Order");
            const order = await Order.getByID(this.orderId);
            if (order) {
                await order.onPaymentFailed(payment, organization)

                if (order.status === OrderStatus.Deleted) {
                    this.status = BalanceItemStatus.Hidden
                    await this.save()
                }
            }
        }
    }

    async undoFailed(payment: Payment, organization: Organization) {
        // If order
        if (this.orderId) {
            const {Order} = await import("./Order");
            const order = await Order.getByID(this.orderId);
            if (order) {
                await order.undoPaymentFailed(payment, organization)
            }
        }
    }

    updateStatus() {
        this.status = this.pricePaid >= this.price ? BalanceItemStatus.Paid : BalanceItemStatus.Pending;
    }

    static async deleteItems(items: BalanceItem[]) {
        const {payments} = await BalanceItem.loadPayments(items)

        // Load all balance items
        const {balanceItems, balanceItemPayments: allBalanceItemPayments} = await Payment.loadBalanceItems(payments)
        for (const payment of payments) {
            if (payment.status === PaymentStatus.Succeeded) {
                continue;
            }
            if (!(payment.method === PaymentMethod.PointOfSale || payment.method === PaymentMethod.Transfer || payment.method === PaymentMethod.Unknown)) {
                continue;
            }
            const bip = allBalanceItemPayments.filter(p => p.paymentId == payment.id)
            const bis = balanceItems.filter(b => b.status !== BalanceItemStatus.Hidden && bip.find(p => p.balanceItemId == b.id))

            const remainingAfterDelete = bis.filter(b => !items.find(i => i.id == b.id))
            if (remainingAfterDelete.length == 0) {
                // Delete payment
                payment.status = PaymentStatus.Failed
                payment._forceUpdatedAt = new Date(1900, 0, 1)
                await payment.save()
            }
        }

        // Set other items to zero (the balance item payments keep the real price)
        for (const item of items) {
            // Don't change status of items that are already paid or are partially paid
            // Not using item.paidPrice, since this is cached
            const bip = allBalanceItemPayments.filter(p => p.balanceItemId == item.id)
            const relatedPayments = payments.filter(p => bip.find(b => b.paymentId == p.id))

            if (relatedPayments.length === 0 || !relatedPayments.find(p => p.status === PaymentStatus.Succeeded)) {
                // No paid payments associated with this item
                item.status = BalanceItemStatus.Hidden
                await item.save()
            }
        }
    }

    static async reactivateItems(items: BalanceItem[]) {
        // Set other items to zero (the balance item payments keep the real price)
        for (const item of items) {
            if (item.status === BalanceItemStatus.Hidden) {
                item.status = BalanceItemStatus.Pending
                await item.save()
            }
        }

        const {payments} = await BalanceItem.loadPayments(items)

        // Load all balance items
        const {balanceItems, balanceItemPayments: allBalanceItemPayments} = await Payment.loadBalanceItems(payments)
        for (const payment of payments) {
            if (payment.status !== PaymentStatus.Failed) {
                continue;
            }
            if (!(payment.method === PaymentMethod.PointOfSale || payment.method === PaymentMethod.Transfer || payment.method === PaymentMethod.Unknown)) {
                continue;
            }
            const bip = allBalanceItemPayments.filter(p => p.paymentId == payment.id)
            const bis = balanceItems.filter(b => b.status !== BalanceItemStatus.Hidden && bip.find(p => p.balanceItemId == b.id))

            if (bis.length > 0) {
                // Undo failed
                payment.status = PaymentStatus.Created
                await payment.save()
            }
        }
    }

    static async undoForDeletedOrders(orderIds: string[]) {
        if (orderIds.length === 0) {
            return
        }
        const items = await BalanceItem.where({ orderId: { sign: 'IN', value: orderIds } })
        await this.reactivateItems(items)
    }

    static async deleteForDeletedOrders(orderIds: string[]) {
        if (orderIds.length === 0) {
            return
        }
        const items = await BalanceItem.where({ orderId: { sign: 'IN', value: orderIds } })
        await this.deleteItems(items)
    }

    static async deleteForDeletedMember(memberId: string) {
        const items = await BalanceItem.where({ memberId })
        await this.deleteItems(items)
    }

    static async deleteForDeletedRegistration(registrationId: string) {
        const items = await BalanceItem.where({ registrationId })
        await this.deleteItems(items)
    }

    static async getForRegistration(registrationId: string) {
        const items = await BalanceItem.where({ registrationId })
        return {
            items,
            ...(await this.loadPayments(items))
        }
    }

    static async loadPayments(items: BalanceItem[]) {
        if (items.length == 0) {
            return {balanceItemPayments: [], payments: []}
        }

        // Load balance payment items
        const {BalanceItemPayment} = await import('./BalanceItemPayment');
        const balanceItemPayments = await BalanceItemPayment.where({ balanceItemId: {sign: 'IN', value: items.map(i => i.id)} })

        const payments = await Payment.getByIDs(...balanceItemPayments.map(p => p.paymentId))

        return {payments, balanceItemPayments}
    }

    static async getMemberStructure(items: BalanceItem[]): Promise<MemberBalanceItem[]> {
        if (items.length == 0) {
            return []
        }

        const {Registration} = await import("./Registration");
        const {Order} = await import("./Order");

        const {payments, balanceItemPayments} = await BalanceItem.loadPayments(items)
        
        // Load members and orders
        const registrationIds = Formatter.uniqueArray(items.flatMap(b => b.registrationId ? [b.registrationId] : []))
        const orderIds = Formatter.uniqueArray(items.flatMap(b => b.orderId ? [b.orderId] : []))

        const registrations = await Registration.getByIDs(...registrationIds)
        const orders = await Order.getByIDs(...orderIds)
    
        return items.map(item => {
            const thisBalanceItemPayments = balanceItemPayments.filter(p => p.balanceItemId === item.id)
            return MemberBalanceItem.create({
                ...item,
                registration: registrations.find(r => r.id === item.registrationId)?.getStructure() ?? null,
                order: orders.find(o => o.id === item.orderId)?.getStructureWithoutPayment() ?? null,
                payments: thisBalanceItemPayments.map(p => {
                    const payment = payments.find(pp => pp.id === p.paymentId)!
                    return MemberBalanceItemPayment.create({
                        ...p,
                        payment: PaymentStruct.create(payment)
                    })
                })
            })
        })
    }
}