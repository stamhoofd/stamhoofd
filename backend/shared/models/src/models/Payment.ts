import { column } from '@simonbackx/simple-database';
import { BalanceItemDetailed, BalanceItemPaymentDetailed, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentProvider, PaymentStatus, Settlement, TransferSettings, BaseOrganization, PaymentType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { BalanceItem, Organization } from './index.js';
import { QueryableModel } from '@stamhoofd/sql';

export class Payment extends QueryableModel {
    static table = 'payments';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    /**
     * Types of payment:
     * - Payment (default) = positive amount or zero
     * - Refund = negative amount
     * - Rebooking = zero payment due to rebooking
     */
    @column({ type: 'string' })
    type = PaymentType.Payment;

    /**
     * How the payment is paid out or refunded
     */
    @column({ type: 'string' })
    method: PaymentMethod;

    @column({ type: 'json', decoder: PaymentCustomer, nullable: true })
    customer: PaymentCustomer | null = null;

    @column({ type: 'string', nullable: true })
    provider: PaymentProvider | null = null;

    @column({ type: 'string' })
    status: PaymentStatus;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    /**
     * payingUserId
     */
    @column({ type: 'string', nullable: true })
    payingUserId: string | null = null;

    /**
     * @deprecated
     */
    get userId() {
        return this.payingUserId;
    }

    /**
     * @deprecated
     */
    set userId(id: string | null) {
        this.payingUserId = id;
    }

    /**
     * If an organization paid, this contains the organization id
     */
    @column({ type: 'string', nullable: true })
    payingOrganizationId: string | null = null;

    @column({ type: 'string', nullable: true })
    stripeAccountId: string | null = null;

    /**
     * Total price
     */
    @column({ type: 'integer' })
    price: number;

    /**
     * The difference between the sum of the balance item payments price and the price of the payment, caused by rounding to 1 cent.
     * This cannot be >= 100 (= 0,01 euro) or <= -100 (=-0,01 euro)
     *
     * Just like all prices, this price is stored per ten thousand (1 = 0,0001 ). Storing smaller units is not possible because even in balance items, the price to pay cannot be smaller than 0,0001 euro
     *
     * E.g. total price to pay is 0,242 because of VAT, then we round this to 0,24. The roundingAmount will be -0,002 in this case.
     */
    // @column({ type: 'integer' })
    // roundingAmount = 0;

    /**
     * Fee paid to the payment provider (if available, otherwise set to 0)
     * Note: only set when we substract it from the payouts and need to invoice it (if using Stripe Express)
     */
    @column({ type: 'integer' })
    transferFee = 0;

    /**
     * Service fee that will be substracted from the payout (in addition to the transfer fee)
     * Will get invoiced at the end of the month
     *
     * This INCLUDES VAT
     */
    @column({ type: 'integer' })
    serviceFeePayout = 0;

    /**
     * Service fee, not substracted from a payout, that needs to be paid via a different payment
     *
     * This EXCLUDES VAT
     */
    @column({ type: 'integer' })
    serviceFeeManual = 0;

    /**
     * Part of the serviceFeeManual, that has been invoiced (added to outstanding balance)
     */
    @column({ type: 'integer' })
    serviceFeeManualCharged = 0;

    /**
     * Included in the total price
     */
    @column({ type: 'integer', nullable: true })
    freeContribution: number | null = null;

    @column({ type: 'string', nullable: true })
    transferDescription: string | null = null;

    @column({ type: 'json', nullable: true, decoder: TransferSettings })
    transferSettings: TransferSettings | null = null;

    @column({ type: 'string', nullable: true })
    invoiceId: string | null = null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    _forceUpdatedAt: Date | null = null;

    @column({
        type: 'datetime', beforeSave() {
            if (this._forceUpdatedAt) {
                return this._forceUpdatedAt;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    @column({ type: 'datetime', nullable: true })
    paidAt: Date | null = null;

    /// Settlement meta data
    @column({ type: 'json', decoder: Settlement, nullable: true })
    settlement: Settlement | null = null;

    @column({ type: 'string', nullable: true })
    iban: string | null = null;

    @column({ type: 'string', nullable: true })
    ibanName: string | null = null;

    generateDescription(organization: Organization, reference: string, replacements: { [key: string]: string } = {}) {
        const settings = this.transferSettings ?? organization.meta.transferSettings;
        this.transferDescription = settings.generateDescription(reference, organization.address.country, replacements);
    }

    static roundPrice(price: number) {
        return Math.round(price / 100) * 100;
    }

    static async getGeneralStructure(payments: Payment[], includeSettlements = false): Promise<PaymentGeneral[]> {
        if (payments.length === 0) {
            return [];
        }

        const { balanceItemPayments, balanceItems } = await Payment.loadBalanceItems(payments);
        const { payingOrganizations } = await Payment.loadPayingOrganizations(payments);

        return this.getGeneralStructureFromRelations({
            payments,
            balanceItemPayments,
            balanceItems,
            payingOrganizations,
        }, includeSettlements);
    }

    static getGeneralStructureFromRelations({ payments, balanceItemPayments, balanceItems, payingOrganizations }: {
        payments: Payment[];
        balanceItemPayments: import('./BalanceItemPayment').BalanceItemPayment[];
        balanceItems: import('./BalanceItem').BalanceItem[];
        payingOrganizations: Organization[];
    }, includeSettlements = false): PaymentGeneral[] {
        if (payments.length === 0) {
            return [];
        }

        return payments.map((payment) => {
            const payingOrganization = payment.payingOrganizationId ? payingOrganizations.find(o => o.id === payment.payingOrganizationId) : null;
            return PaymentGeneral.create({
                ...payment,
                payingOrganization: payingOrganization
                    ? BaseOrganization.create({
                            ...payingOrganization,
                        })
                    : null,
                balanceItemPayments: balanceItemPayments.filter(item => item.paymentId === payment.id).map((item) => {
                    const balanceItem = balanceItems.find(b => b.id === item.balanceItemId);

                    return BalanceItemPaymentDetailed.create({
                        ...item,
                        balanceItem: BalanceItemDetailed.create({
                            ...balanceItem,
                        }),
                    });
                }),
                ...(payment.provider !== PaymentProvider.Stripe ? { stripeAccountId: null } : {}),
                ...(!includeSettlements) ? { settlement: null, transferFee: 0, stripeAccountId: null, serviceFeeManual: 0, serviceFeeManualCharged: 0, serviceFeePayout: 0 } : {},
            });
        });
    }

    /**
     *
     * @param checkPermissions Only set to undefined when not returned in the API + not for public use
     * @returns
     */
    async getGeneralStructure(): Promise<PaymentGeneral> {
        return (await Payment.getGeneralStructure([this], false))[0];
    }

    static async loadBalanceItems(payments: Payment[]) {
        if (payments.length === 0) {
            return { balanceItemPayments: [], balanceItems: [] };
        }
        const { BalanceItemPayment } = await import('./BalanceItemPayment.js');
        const { BalanceItem } = await import('./BalanceItem.js');

        // Load all the related models from the database so we can build the structures
        const balanceItemPayments = await BalanceItemPayment.where({
            paymentId: {
                sign: 'IN',
                value: payments.map(p => p.id),
            },
        });
        const ids = Formatter.uniqueArray(balanceItemPayments.map(p => p.balanceItemId));
        const balanceItems = await BalanceItem.getByIDs(...ids);

        return { balanceItemPayments, balanceItems };
    }

    static async loadPayingOrganizations(payments: Payment[]) {
        const ids = Formatter.uniqueArray(payments.map(p => p.payingOrganizationId).filter(p => p !== null));
        if (ids.length === 0) {
            return { payingOrganizations: [] };
        }

        const payingOrganizations = await Organization.getByIDs(...ids);

        return { payingOrganizations };
    }

    static async loadBalanceItemRelations(balanceItems: import('./BalanceItem').BalanceItem[]) {
        const { Order } = await import('./Order.js');
        const { Member } = await import('./Member.js');

        // Load members and orders
        const registrationIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.registrationId ? [b.registrationId] : []));
        const orderIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.orderId ? [b.orderId] : []));

        const registrations = await Member.getRegistrationWithMembersByIDs(registrationIds);
        const orders = await Order.getByIDs(...orderIds);

        return { registrations, orders };
    }
}
