import { BalanceItemDetailed, BalanceItemPaymentDetailed, BaseOrganization, PaymentGeneral, PaymentProvider } from '@stamhoofd/structures';
import { PaymentSettlementDetailed } from '@stamhoofd/structures/settlements/PaymentSettlement.js';
import { Settlement as SettlementStruct } from '@stamhoofd/structures/settlements/Settlement.js';
import { Formatter } from '@stamhoofd/utility';
import { BalanceItem } from '../models/BalanceItem.js';
import { BalanceItemPayment } from '../models/BalanceItemPayment.js';
import { Member } from '../models/Member.js';
import { Order } from '../models/Order.js';
import { Organization } from '../models/Organization.js';
import type { Payment } from '../models/Payment.js';
import { PaymentSettlement } from '../models/PaymentSettlement.js';
import { Settlement } from '../models/Settlement.js';

export class PaymentRelationsService {
    static async getGeneralStructure(payments: Payment[], includeSettlements = false): Promise<PaymentGeneral[]> {
        if (payments.length === 0) {
            return [];
        }

        const { balanceItemPayments, balanceItems } = await this.loadBalanceItems(payments);
        const { payingOrganizations } = await this.loadPayingOrganizations(payments);
        const { paymentSettlements, settlements } = includeSettlements ? await this.loadSettlements(payments) : { paymentSettlements: [], settlements: [] };

        return this.getGeneralStructureFromRelations({
            payments,
            balanceItemPayments,
            balanceItems,
            payingOrganizations,
            paymentSettlements,
            settlements,
        }, includeSettlements);
    }

    static getGeneralStructureFromRelations({ payments, balanceItemPayments, balanceItems, payingOrganizations, paymentSettlements, settlements }: {
        payments: Payment[];
        balanceItemPayments: BalanceItemPayment[];
        balanceItems: BalanceItem[];
        payingOrganizations: Organization[];
        paymentSettlements?: PaymentSettlement[];
        settlements?: Settlement[];
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
                ...(includeSettlements
                    ? {
                            settlements: (paymentSettlements ?? []).filter((line) => {
                                if (line.paymentId !== payment.id) {
                                    return false;
                                }
                                // A payment is only settled by the payouts of its own organization
                                const settlement = (settlements ?? []).find(s => s.id === line.settlementId);
                                return settlement !== undefined && settlement.organizationId === payment.organizationId;
                            }).map((line) => {
                                const settlement = (settlements ?? []).find(s => s.id === line.settlementId);
                                return PaymentSettlementDetailed.create({
                                    ...line,
                                    settlement: SettlementStruct.create({ ...settlement }),
                                });
                            }),
                        }
                    : { settlement: null, settlements: [], transferFee: 0, stripeAccountId: null, serviceFeeManual: 0, serviceFeeManualCharged: 0, serviceFeePayout: 0 }),
            });
        });
    }

    static async loadBalanceItems(payments: Payment[]) {
        if (payments.length === 0) {
            return { balanceItemPayments: [], balanceItems: [] };
        }

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

    static async loadSettlements(payments: Payment[]) {
        if (payments.length === 0) {
            return { paymentSettlements: [], settlements: [] };
        }

        const paymentSettlements = await PaymentSettlement.select()
            .where('paymentId', payments.map(p => p.id))
            .fetch();

        const ids = Formatter.uniqueArray(paymentSettlements.map(line => line.settlementId));
        const organizationIds = Formatter.uniqueArray(payments.map(p => p.organizationId));
        const settlements = ids.length > 0
            ? await Settlement.select().where('id', ids).where('organizationId', organizationIds).fetch()
            : [];

        return { paymentSettlements, settlements };
    }

    static async loadPayingOrganizations(payments: Payment[]) {
        const ids = Formatter.uniqueArray(payments.map(p => p.payingOrganizationId).filter(p => p !== null));
        if (ids.length === 0) {
            return { payingOrganizations: [] };
        }

        const payingOrganizations = await Organization.getByIDs(...ids);

        return { payingOrganizations };
    }

    static async loadBalanceItemRelations(balanceItems: BalanceItem[]) {
        const registrationIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.registrationId ? [b.registrationId] : []));
        const orderIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.orderId ? [b.orderId] : []));

        const registrations = await Member.getRegistrationWithMembersByIDs(registrationIds);
        const orders = await Order.getByIDs(...orderIds);

        return { registrations, orders };
    }
}
