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

    @column({ type: "string", nullable: true })
    method: PaymentMethod | null = null;

    @column({ type: "string", nullable: true })
    provider: PaymentProvider | null = null;

    @column({ type: "string" })
    status: PaymentStatus;

    @column({ type: "string", nullable: true })
    organizationId: string| null = null

    // Link a user for debugging
    @column({ type: "string", nullable: true })
    userId: string | null = null;

    /**
     * Total price
     */
    @column({ type: "integer" })
    price: number;

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
    paidAt: Date | null = null

    /// Settlement meta data
    @column({ type: "json", decoder: Settlement, nullable: true })
    settlement: Settlement | null = null;

    @column({ type: "string", nullable: true })
    iban: string | null = null;

    @column({ type: "string", nullable: true })
    ibanName: string | null = null;

    generateDescription(organization: Organization, reference: string) {
        const settings = this.transferSettings ?? organization.meta.transferSettings
        if (settings.type == TransferDescriptionType.Structured) {
            if (organization.address.country === Country.Belgium) {
                this.transferDescription = Payment.generateOGM()
                return
            }
             this.transferDescription = Payment.generateOGMNL()
             return
        }

        if (settings.type == TransferDescriptionType.Reference) {
            this.transferDescription = (settings.prefix ? (settings.prefix + " ") : "" ) + reference
            return
        }

        this.transferDescription = settings.prefix
    }

    static generateOGMNL() {
        /**
         * Reference: https://www.betaalvereniging.nl/betalingsverkeer/giraal-betalingsverkeer/betalingskenmerken/
         * Check: https://rudhar.com/cgi-bin/chkdigit.cgi
         * Lengte: 16 cijfers
         * Eerste cijfer = controlegetal
         * Controlegetal wordt berekend door alle cijfers te vermenigvuldigen met een gewicht en vervolgens de modulus van 11 te nemen, 
         * het controlegetal is 11 min die modulus
         */

        const length = 15 // allowed values: 15, 12, 11, 10, 9, 8, 7
        const needsLengthIdentification = length < 15
        const L = needsLengthIdentification ? (length % 10) : ""
        // WARNING: lengths other than 15 are not yet supported because it is not clear whether L needs to be used in the calculation of C or not

        const weights = [2, 4, 8, 5, 10, 9, 7, 3, 6, 1] // repeat if needed (in reverse order!)

        // Warning: we'll reverse the order of the numbers afterwards!
        const numbers: number[] = []
        for (let index = 0; index < length; index++) {
            numbers.push(Math.floor(Math.random() * 10))
        }
        const sum = numbers.reduce((sum, num, index) => {
            const weight = weights[index % (weights.length)]
            return sum + num*weight
        }, 0)
        let C = 11 - (sum % 11)

        // Transform to 1 number following the specs
        if (C === 11) {
            C = 0
        }

        if (C === 10) {
            C = 1
        }

        return C+""+L+(numbers.reverse().map(n => n+"")).join("")
    }

    static generateOGM() {
        /**
         * De eerste tien cijfers zijn bijvoorbeeld een klantennummer of een factuurnummer. 
         * De laatste twee cijfers vormen het controlegetal dat verkregen wordt door van de 
         * voorgaande tien cijfers de rest bij Euclidische deling door 97 te berekenen (modulo 97). 
         * Voor en achter de cijfers worden drie plussen (+++) of sterretjes (***) gezet.
         * 
         * Uitzondering: Indien de rest 0 bedraagt, dan wordt als controlegetal 97 gebruikt.[1]
         */

        const firstChars = Math.round(Math.random() * 9999999999)
        let modulo = firstChars % 97
        if (modulo == 0) {
            modulo = 97
        }

        const str = (firstChars + "").padStart(10, "0") + (modulo + "").padStart(2, "0")

        return "+++"+str.substr(0, 3) + "/" + str.substr(3, 4) + "/"+str.substr(3 + 4)+"+++"
    }

    /**
     * 
     * @param checkPermissions Only set to undefined when not returned in the API + not for public use
     * @returns 
     */
    async getGeneralStructure(checkPermissions?: {user: UserWithOrganization, permissionLevel: PermissionLevel}): Promise<PaymentGeneral> {
        return (await Payment.getGeneralStructure([this], checkPermissions))[0]
    }

    /**
     * 
     * @param payments 
     * @param checkPermissions Only set to undefined when not returned in the API + not for public use
     * @returns 
     */
    static async getGeneralStructure(payments: Payment[], checkPermissions?: {user: UserWithOrganization, permissionLevel: PermissionLevel}): Promise<PaymentGeneral[]> {
        const {BalanceItemPayment} = await import("./BalanceItemPayment");
        const {BalanceItem} = await import("./BalanceItem");
        const {Registration} = await import("./Registration");
        const {Order} = await import("./Order");
        const {Member} = await import("./Member");

        // Load all the related models from the database so we can build the structures
        const balanceItemPayments = await BalanceItemPayment.where({
            paymentId: {
                sign: 'IN',
                value: payments.map(p => p.id)
            }
        })
        const ids = Formatter.uniqueArray(balanceItemPayments.flatMap(p => p.balanceItemId));
        const balanceItems = await BalanceItem.getByIDs(...ids);

        // Load members and orders
        const registrationIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.registrationId ? [b.registrationId] : []))
        const orderIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.orderId ? [b.orderId] : []))
        const memberIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.memberId ? [b.memberId] : []))

        const registrations = await Registration.getByIDs(...registrationIds)
        const orders = await Order.getByIDs(...orderIds)
        const members = await Member.getByIDs(...memberIds)

        if (checkPermissions) {
            // This needs some optimizations
            const {user, permissionLevel} = checkPermissions;

            let hasAccess = false;
            
            // First try without queries
            if (!hasAccess && permissionLevel === PermissionLevel.Read) {
                for (const balanceItem of balanceItems) {
                    if (balanceItem.userId === user.id) {
                        hasAccess = true;
                        break;
                    }
                }
            }

            if (!hasAccess && user.permissions) {
                if (user.permissions.hasFullAccess() || user.permissions.canManagePayments(user.organization.privateMeta.roles)) {
                    hasAccess = true;
                } else {
                    const {Group} = await import("./Group");
                    const {Webshop} = await import("./Webshop");
                    const groupIds = Formatter.uniqueArray(registrations.flatMap(b => b.groupId ? [b.groupId] : []))
                    const groups = await Group.getByIDs(...groupIds)

                    // We grant permission for a whole payment when the user has at least permission for a part of that payment.
                    for (const registration of registrations) {
                        if (registration.hasAccess(user, groups, permissionLevel)) {
                            hasAccess = true;
                            break;
                        }
                    }

                    if (!hasAccess) {
                        for (const order of orders) {
                            const webshop = await Webshop.getByID(order.webshopId)
                            if (webshop && getPermissionLevelNumber(webshop.privateMeta.permissions.getPermissionLevel(user.permissions)) >= getPermissionLevelNumber(permissionLevel)) {
                                hasAccess = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (!hasAccess && permissionLevel === PermissionLevel.Read) {
                // Check members
                const userMembers = await Member.getMembersWithRegistrationForUser(user)
                for (const member of userMembers) {
                    if (memberIds.includes(member.id)) {
                        hasAccess = true;
                        break;
                    }
                }
            }

            if (!hasAccess) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Payment not found",
                    human: "Je hebt geen toegang tot deze betaling"
                })
            }
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
                            member: member ? MemberStruct.create(member!) : null,
                            order: order ? OrderStruct.create(order) : null
                        })
                    })
                })
            })
        })
    }
}