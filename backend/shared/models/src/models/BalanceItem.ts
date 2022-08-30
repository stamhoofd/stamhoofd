import { column, Model } from '@simonbackx/simple-database';
import { BalanceItemStatus, MemberBalanceItem, MemberBalanceItemPayment, Payment as PaymentStruct } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";
import { Group } from './Group';
import { Order } from './Order';
import { Organization } from './Organization';
import { Payment } from './Payment';
import { Registration } from './Registration';

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

    async markPaid(payment: Payment, organization: Organization) {
        // status and pricePaid changes are handled inside balanceitempayment

        // If registration
        if (this.registrationId) {
            const registration = await Registration.getByID(this.registrationId);

            if (registration) {
                // 1. Mark registration as being valid
                if (registration.registeredAt === null) {
                    registration.registeredAt = new Date()
                    registration.reservedUntil = null
                    await registration.save();

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
            const order = await Order.getByID(this.orderId);
            if (order) {
                await order.markPaid(payment, organization)
            }
        }
    }

    static async getMemberStructure(items: BalanceItem[]): Promise<MemberBalanceItem[]> {
        if (items.length == 0) {
            return []
        }
        
        // Load balance payment items
        const {BalanceItemPayment} = await import('./BalanceItemPayment');
        const balanceItemPayments = await BalanceItemPayment.where({ balanceItemId: {sign: 'IN', value: items.map(i => i.id)} })
    
        // Load payments
        const payments = await Payment.getByIDs(...balanceItemPayments.map(p => p.paymentId))

        return items.map(item => {
            const thisBalanceItemPayments = balanceItemPayments.filter(p => p.balanceItemId === item.id)
            return MemberBalanceItem.create({
                ...item,
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