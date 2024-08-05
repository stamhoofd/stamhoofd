import { column, Database, Model } from '@simonbackx/simple-database';
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

    // Receiving organization
    
    @column({ type: "string" })
    organizationId: string

    // Payer: memberId, userId or payingOrganizationId

    @column({ type: "string", nullable: true })
    memberId: string | null = null;

    @column({ type: "string", nullable: true })
    userId: string | null = null;

    @column({ type: "string", nullable: true })
    payingOrganizationId: string | null = null;

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

    /**
     * The depending balance item ID that is linked to this balance item
     * -> as soon as this balance item is paid, we'll mark this balance item as pending if it is still hidden
     * -> allows for a pay back system where one user needs to pay back a different user
     */
    @column({ type: "string", nullable: true })
    dependingBalanceItemId: string | null = null;

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
        if (this.dependingBalanceItemId) {
            const depending = await BalanceItem.getByID(this.dependingBalanceItemId)
            if (depending && depending.status === BalanceItemStatus.Hidden) {
                await BalanceItem.reactivateItems([depending])
            }
        }

        // If registration
        if (this.registrationId) {
            const {Registration} = await import("./Registration");
            const registration = await Registration.getByID(this.registrationId);

            if (registration) {
                // 1. Mark registration as being valid
                if (registration.registeredAt === null || registration.deactivatedAt) {
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

        // Do we have a different connected balance item?
        // Make it visible if this one is paid
        if (this.dependingBalanceItemId) {
            const depending = await BalanceItem.getByID(this.dependingBalanceItemId)
            if (depending) {
                if (this.status === BalanceItemStatus.Hidden) {
                    depending.status = BalanceItemStatus.Pending
                    await depending.save()

                    if (depending.memberId) {
                        const {Member} = await import("./Member");
                        await Member.updateOutstandingBalance([depending.memberId])
                    }

                    if (depending.registrationId) {
                        const {Registration} = await import("./Registration");
                        await Registration.updateOutstandingBalance([depending.registrationId], depending.organizationId)
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
        this.status = this.pricePaid >= this.price ? BalanceItemStatus.Paid : (this.pricePaid > 0 ? BalanceItemStatus.Pending : (this.status === BalanceItemStatus.Hidden ? BalanceItemStatus.Hidden : BalanceItemStatus.Pending));
    }

    static async deleteItems(items: BalanceItem[]) {
        const {balanceItemPayments} = await BalanceItem.loadPayments(items)

        // todo: in the future we could automatically delete payments that are not needed anymore and weren't paid yet -> to prevent leaving ghost payments
        // for now, an admin can manually cancel those payments
        let needsUpdate = false

        // Set other items to zero (the balance item payments keep the real price)
        for (const item of items) {
            needsUpdate = needsUpdate || (item.price > 0 && item.status !== BalanceItemStatus.Hidden)

            // Don't change status of items that are already paid or are partially paid
            // Not using item.paidPrice, since this is cached
            const bip = balanceItemPayments.filter(p => p.balanceItemId == item.id)

            if (bip.length === 0) {
                // No payments associated with this item
                item.status = BalanceItemStatus.Hidden
                item.price = 0
                await item.save()
            } else {
                item.price = 0
                await item.save()
            }
        }

        if (needsUpdate) {
            await this.updateOutstanding(items)
        }
    }

    static async reactivateItems(items: BalanceItem[]) {
        let needsUpdate = false
        for (const item of items) {
            if (item.status === BalanceItemStatus.Hidden) {
                item.status = BalanceItemStatus.Pending
                needsUpdate = needsUpdate || item.price > 0
                await item.save()
            }
        }

        if (needsUpdate) {
            await this.updateOutstanding(items)
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

    static async updateOutstanding(items: BalanceItem[], organizationId?: string) {
        const Member = (await import('./Member')).Member;

        // Update outstanding amount of related members and registrations
        const memberIds: string[] = Formatter.uniqueArray(items.map(p => p.memberId).filter(id => id !== null)) as any
        await Member.updateOutstandingBalance(memberIds)

        const {Registration} = await import('./Registration');
        const registrationIds: string[] = Formatter.uniqueArray(items.map(p => p.registrationId).filter(id => id !== null)) as any
        await Registration.updateOutstandingBalance(registrationIds, organizationId)
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
        const {Group} = await import("./Group");

        const {payments, balanceItemPayments} = await BalanceItem.loadPayments(items)
        
        // Load members and orders
        const registrationIds = Formatter.uniqueArray(items.flatMap(b => b.registrationId ? [b.registrationId] : []))
        const orderIds = Formatter.uniqueArray(items.flatMap(b => b.orderId ? [b.orderId] : []))

        const registrations = await Registration.getByIDs(...registrationIds)
        const orders = await Order.getByIDs(...orderIds)

        const groupIds = Formatter.uniqueArray(registrations.map(r => r.groupId))
        const groups = await Group.getByIDs(...groupIds)
    
        return items.map(item => {
            const thisBalanceItemPayments = balanceItemPayments.filter(p => p.balanceItemId === item.id)
            const registration = registrations.find(r => r.id === item.registrationId)
            const group = registration ? groups.find(g => g.id === registration.groupId) : null

            return MemberBalanceItem.create({
                ...item,
                registration: registration && group ? registration.setRelation(Registration.group, group).getStructure() : null,
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

    static async balanceItemsForUsersAndMembers(organizationId: string|null, userIds: string[], memberIds: string[]): Promise<BalanceItem[]> {
        if (memberIds.length == 0 && userIds.length == 0) {
            return []
        }
        
        const params: any[] = [];
        const where: string[] = [];

        if (memberIds.length) {
            if (memberIds.length == 1) {
                where.push(`memberId = ?`)
                params.push(memberIds[0]);
            } else {
                where.push(`memberId IN (?)`)
                params.push(memberIds);
            }
        }

        // Note here, we don't search for memberId IS NULL restriction in MySQL because it slows down the query too much (500ms)
        // Better if we do it in code here
        if (userIds.length) {
            if (userIds.length == 1) {
                where.push('userId = ?')
                params.push(userIds[0]);
            } else {
                where.push('userId IN (?)')
                params.push(userIds);
            }
        }

        const requiredWhere: string[] = [];

        if (organizationId) {
            requiredWhere.push('organizationId = ?')
            params.push(organizationId);
        }
        
        const query = `SELECT ${BalanceItem.getDefaultSelect()} FROM ${BalanceItem.table} WHERE (${where.join(" OR ")}) ${requiredWhere.length ? (' AND ' + requiredWhere.join(' AND ')) : ''} AND ${BalanceItem.table}.status != ?`;
        params.push(BalanceItemStatus.Hidden);
        
        const [rows] = await Database.select(query, params);
        const balanceItems = BalanceItem.fromRows(rows, BalanceItem.table);

        // Filter out items of other members
        if (memberIds.length) {
            return balanceItems.filter(b => !b.memberId || memberIds.includes(b.memberId))
        }
        return balanceItems;
    }
}
