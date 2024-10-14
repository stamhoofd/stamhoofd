import { column, Model, SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { BalanceItemDetailed, BalanceItemPaymentDetailed, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentProvider, PaymentStatus, Settlement, TransferSettings } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { Organization } from './';
import { SQL, SQLSelect } from '@stamhoofd/sql';

export class Payment extends Model {
    static table = 'payments';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

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
     * Fee paid to the payment provider (if available, otherwise set to 0)
     */
    @column({ type: 'integer' })
    transferFee = 0;

    /**
     * Included in the total price
     */
    @column({ type: 'integer', nullable: true })
    freeContribution: number | null = null;

    @column({ type: 'string', nullable: true })
    transferDescription: string | null = null;

    @column({ type: 'json', nullable: true, decoder: TransferSettings })
    transferSettings: TransferSettings | null = null;

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

    static async getGeneralStructure(payments: Payment[], includeSettlements = false): Promise<PaymentGeneral[]> {
        if (payments.length === 0) {
            return [];
        }

        const { balanceItemPayments, balanceItems } = await Payment.loadBalanceItems(payments);

        return this.getGeneralStructureFromRelations({
            payments,
            balanceItemPayments,
            balanceItems,
        }, includeSettlements);
    }

    static getGeneralStructureFromRelations({ payments, balanceItemPayments, balanceItems }: {
        payments: Payment[];
        balanceItemPayments: import('./BalanceItemPayment').BalanceItemPayment[];
        balanceItems: import('./BalanceItem').BalanceItem[];
    }, includeSettlements = false): PaymentGeneral[] {
        if (payments.length === 0) {
            return [];
        }

        return payments.map((payment) => {
            return PaymentGeneral.create({
                ...payment,
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
                ...(!includeSettlements) ? { settlement: null, transferFee: 0, stripeAccountId: null } : {},
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
        const { BalanceItemPayment } = await import('./BalanceItemPayment');
        const { BalanceItem } = await import('./BalanceItem');

        // Load all the related models from the database so we can build the structures
        const balanceItemPayments = await BalanceItemPayment.where({
            paymentId: {
                sign: 'IN',
                value: payments.map(p => p.id),
            },
        });
        const ids = Formatter.uniqueArray(balanceItemPayments.flatMap(p => p.balanceItemId));
        const balanceItems = await BalanceItem.getByIDs(...ids);

        return { balanceItemPayments, balanceItems };
    }

    static async loadBalanceItemRelations(balanceItems: import('./BalanceItem').BalanceItem[]) {
        const { Order } = await import('./Order');
        const { Member } = await import('./Member');

        // Load members and orders
        const registrationIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.registrationId ? [b.registrationId] : []));
        const orderIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.orderId ? [b.orderId] : []));

        const registrations = await Member.getRegistrationWithMembersByIDs(registrationIds);
        const orders = await Order.getByIDs(...orderIds);

        return { registrations, orders };
    }

    /**
     * Experimental: needs to move to library
     */
    static select() {
        const transformer = (row: SQLResultNamespacedRow): Payment => {
            const d = (this as typeof Payment & typeof Model).fromRow(row[this.table] as any) as Payment | undefined;

            if (!d) {
                throw new Error('EmailTemplate not found');
            }

            return d;
        };

        const select = new SQLSelect(transformer, SQL.wildcard(this.table));
        return select.from(SQL.table(this.table));
    }
}
