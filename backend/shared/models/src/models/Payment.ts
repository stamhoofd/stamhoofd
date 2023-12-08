import { column, Model } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItemDetailed, BalanceItemPaymentDetailed, Country, getPermissionLevelNumber, Member as MemberStruct, Order as OrderStruct, PaymentGeneral, PaymentMethod, PaymentProvider, PaymentStatus, PermissionLevel, Registration as RegistrationStruct, Settlement, TransferDescriptionType, TransferSettings } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { Organization, UserWithOrganization } from './';

export class Payment extends Model {
    static table = "payments"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    method: PaymentMethod;

    @column({ type: "string", nullable: true })
    provider: PaymentProvider | null = null;

    @column({ type: "string" })
    status: PaymentStatus;

    @column({ type: "string", nullable: true })
    organizationId: string| null = null

    // Link a user for debugging
    @column({ type: "string", nullable: true })
    userId: string | null = null;

    // Link a user for debugging
    @column({ type: "string", nullable: true })
    stripeAccountId: string | null = null;

    /**
     * Total price
     */
    @column({ type: "integer" })
    price: number;

    /**
     * Fee paid to the payment provider (if available, otherwise set to 0)
     */
    @column({ type: "integer" })
    transferFee = 0

    /**
     * Included in the total price
     */
    @column({ type: "integer", nullable: true })
    freeContribution: number | null = null;

    @column({ type: "string", nullable: true })
    transferDescription: string | null = null;

    @column({ type: "json", nullable: true, decoder: TransferSettings })
    transferSettings: TransferSettings | null = null;

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

    _forceUpdatedAt: Date | null = null

    @column({
        type: "datetime", beforeSave() {
            if (this._forceUpdatedAt) {
                return this._forceUpdatedAt
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    @column({ type: "datetime", nullable: true })
    paidAt: Date | null = null

    /// Settlement meta data
    @column({ type: "json", decoder: Settlement, nullable: true })
    settlement: Settlement | null = null;

    @column({ type: "string", nullable: true })
    iban: string | null = null;

    @column({ type: "string", nullable: true })
    ibanName: string | null = null;

    generateDescription(organization: Organization, reference: string, replacements: { [key: string]: string } = {}) {
        const settings = this.transferSettings ?? organization.meta.transferSettings
        this.transferDescription = settings.generateDescription(reference, organization.address.country, replacements)
    }

    /**
     * 
     * @param checkPermissions Only set to undefined when not returned in the API + not for public use
     * @returns 
     */
    async getGeneralStructure(checkPermissions?: {user: UserWithOrganization, permissionLevel: PermissionLevel}): Promise<PaymentGeneral> {
        return (await Payment.getGeneralStructure([this], checkPermissions))[0]
    }

    static async loadBalanceItems(payments: Payment[]) {
        if (payments.length === 0) {
            return {balanceItemPayments: [], balanceItems: []}
        }
        const {BalanceItemPayment} = await import("./BalanceItemPayment");
        const {BalanceItem} = await import("./BalanceItem");

        // Load all the related models from the database so we can build the structures
        const balanceItemPayments = await BalanceItemPayment.where({
            paymentId: {
                sign: 'IN',
                value: payments.map(p => p.id)
            }
        })
        const ids = Formatter.uniqueArray(balanceItemPayments.flatMap(p => p.balanceItemId));
        const balanceItems = await BalanceItem.getByIDs(...ids);

        return {balanceItemPayments, balanceItems}
    }

    static async loadBalanceItemRelations(balanceItems: import("./BalanceItem").BalanceItem[]) {
        const {Registration} = await import("./Registration");
        const {Order} = await import("./Order");
        const {Member} = await import("./Member");

        // Load members and orders
        const registrationIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.registrationId ? [b.registrationId] : []))
        const orderIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.orderId ? [b.orderId] : []))
        const memberIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.memberId ? [b.memberId] : []))

        const registrations = await Registration.getByIDs(...registrationIds)
        const orders = await Order.getByIDs(...orderIds)
        const members = await Member.getByIDs(...memberIds)

        return {registrations, orders, members}
    }

    static async checkBalanceItemPermissions(
        checkPermissions: {user: UserWithOrganization, permissionLevel: PermissionLevel}, 
        balanceItems: import("./BalanceItem").BalanceItem[],
        data?: {
            registrations: import("./Registration").Registration[],
            orders: import("./Order").Order[],
            members: import("./Member").Member[]
        }
    ) {
        const {user, permissionLevel} = checkPermissions;
        const {Member} = await import("./Member");
        
        // First try without queries
        if (permissionLevel === PermissionLevel.Read) {
            for (const balanceItem of balanceItems) {
                if (balanceItem.userId === user.id) {
                    return;
                }
            }
        }

        if (user.permissions && (user.permissions.hasFullAccess(user.organization.privateMeta.roles) || user.permissions.canManagePayments(user.organization.privateMeta.roles))) {
            return
        }

        // Slight optimization possible here
        const {registrations, orders, members} = data ?? await this.loadBalanceItemRelations(balanceItems)

        if (user.permissions) {
            const {Group} = await import("./Group");
            const {Webshop} = await import("./Webshop");
            const groupIds = Formatter.uniqueArray(registrations.flatMap(b => b.groupId ? [b.groupId] : []))
            const groups = await Group.getByIDs(...groupIds)

            // We grant permission for a whole payment when the user has at least permission for a part of that payment.
            for (const registration of registrations) {
                if (registration.hasAccess(user, groups, permissionLevel)) {
                    return
                }
            }

            const webshopCache: Map<string, import("./Webshop").Webshop> = new Map()

            for (const order of orders) {
                const webshop = webshopCache.get(order.webshopId) ?? await Webshop.getByID(order.webshopId)
                if (webshop) {
                    webshopCache.set(order.webshopId, webshop)
                    if (webshop.privateMeta.permissions.userHasAccess(user, permissionLevel)) {
                        return
                    }
                }
            }
        }

        if (permissionLevel === PermissionLevel.Read) {
            // Check members
            const userMembers = await Member.getMembersWithRegistrationForUser(user)
            for (const member of userMembers) {
                if (members.find(m => m.id === member.id)) {
                    return
                }
            }
        }

        throw new SimpleError({
            code: "not_found",
            message: "Payment not found",
            human: "Je hebt geen toegang tot deze betaling"
        })
    }

    /**
     * 
     * @param payments 
     * @param checkPermissions Only set to undefined when not returned in the API + not for public use
     * @returns 
     */
    static async getGeneralStructure(payments: Payment[], checkPermissions?: {user: UserWithOrganization, permissionLevel: PermissionLevel}): Promise<PaymentGeneral[]> {
        if (payments.length === 0) {
            return []
        }

        const {balanceItemPayments, balanceItems} = await this.loadBalanceItems(payments)
        const {registrations, orders, members} = await this.loadBalanceItemRelations(balanceItems);

        if (checkPermissions) {
            await this.checkBalanceItemPermissions(checkPermissions, balanceItems, {registrations, orders, members})
        }
        
        return payments.map(payment => {
            return PaymentGeneral.create({
                ...payment,
                balanceItemPayments: balanceItemPayments.filter(item => item.paymentId === payment.id).map((item) => {
                    const balanceItem = balanceItems.find(b => b.id === item.balanceItemId)
                    const registration = balanceItem?.registrationId && registrations.find(r => r.id === balanceItem.registrationId)
                    const member = balanceItem?.memberId ? members.find(r => r.id === balanceItem.memberId) : undefined
                    const order = balanceItem?.orderId && orders.find(r => r.id === balanceItem.orderId)

                    return BalanceItemPaymentDetailed.create({
                        ...item,
                        balanceItem: BalanceItemDetailed.create({
                            ...balanceItem,
                            registration: registration ? registration.getStructure() : null,
                            member: member ? MemberStruct.create(member) : null,
                            order: order ? OrderStruct.create({...order, payment: null}) : null
                        })
                    })
                }),
                ...(!checkPermissions || !checkPermissions.user || !checkPermissions.user.permissions) ? {settlement: null, transferFee: 0, stripeAccountId: null} : {}
            })
        })
    }
}