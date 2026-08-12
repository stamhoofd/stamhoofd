/**
 * Development only: payment providers pay out on their own schedule and those payouts never reach a
 * local machine, so online payments stay 'not paid out yet' forever. This mimics a weekly payout per
 * provider account, so everything built on top of payouts has data to show.
 */

import { registerCron } from '@stamhoofd/crons';
import { Order, Payment, Platform } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { SQL } from '@stamhoofd/sql';
import { PaymentProvider, PaymentStatus, SettlementReference } from '@stamhoofd/structures';
import { SETTLING_PAYMENT_PROVIDERS } from '@stamhoofd/structures/PaymentSettlement.js';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { Formatter } from '@stamhoofd/utility';
import type { DateTime } from 'luxon';
import { ApplicationFeeService } from '../services/ApplicationFeeService.js';
import { SettlementService } from '../services/SettlementService.js';

registerCron('fake-settlements', createFakeSettlements);

/**
 * Days between the end of a week and the payout of the payments of that week.
 */
const PAYOUT_DELAY_DAYS = 2;

/**
 * Maximum number of payments that are settled in one go: a development database can be a copy of a
 * production one, so a week can hold a lot of payments.
 */
const BATCH_SIZE = 1000;

/**
 * Fake Mollie transaction fee per settled payment, excluding VAT.
 */
const MOLLIE_FEE_PER_PAYMENT = 30_00;
const MOLLIE_FEE_VAT_PERCENTAGE = 21;

export async function createFakeSettlements() {
    if (STAMHOOFD.environment !== 'development') {
        return;
    }

    const now = new Date();

    // The platform's own accounts belong to the membership organization; without one, their
    // payouts can't be attributed and are skipped
    const platformOrganizationId = (await Platform.getShared()).membershipOrganizationId;

    // Payments that couldn't be attributed to an organization are scanned past instead of
    // reselected forever, so they can't stall the payout of later weeks
    let scanAfter: Date | null = null;

    // Pay out week per week, oldest first, until we reach a week that isn't paid out yet
    for (;;) {
        let oldestQuery = selectUnsettledPayments();
        if (scanAfter) {
            oldestQuery = oldestQuery.where('paidAt', '>', scanAfter);
        }
        const oldest = await oldestQuery.orderBy('paidAt', 'ASC').first(false);
        if (!oldest?.paidAt) {
            break;
        }

        const weekStart = Formatter.luxon(oldest.paidAt).startOf('week');
        const weekEnd = weekStart.plus({ weeks: 1 });
        const settledAt = weekEnd.plus({ days: PAYOUT_DELAY_DAYS }).toJSDate();

        if (settledAt > now) {
            // Every remaining payment is in this week or a later one, so all of them still have to
            // be paid out
            break;
        }

        // Nothing is left before this week, so this selects exactly the payments of this week. What
        // doesn't fit in one batch is picked up by the next round, in the same payout
        let batchQuery = selectUnsettledPayments().where('paidAt', '<', weekEnd.toJSDate());
        if (scanAfter) {
            batchQuery = batchQuery.where('paidAt', '>', scanAfter);
        }
        const payments = await batchQuery.limit(BATCH_SIZE).fetch();
        const settledCount = await settleWeek(payments, weekStart, settledAt, platformOrganizationId);

        if (settledCount === 0) {
            // Everything in this batch was skipped: continue behind it
            scanAfter = new Date(Math.max(...payments.map(p => p.paidAt!.getTime())));
        }
    }
}

/**
 * Succeeded payments of a provider that pays out, that weren't paid out yet.
 */
function selectUnsettledPayments() {
    return Payment.select().where(
        SQL.where('status', PaymentStatus.Succeeded)
            .and('provider', SETTLING_PAYMENT_PROVIDERS)
            .and('settlement', null)
            .and('paidAt', '>', null),
    );
}

/**
 * A provider pays out per account it holds the money on: a Stripe account, or the Mollie account of
 * the organization that received the payment.
 */
function getPayoutAccount(payment: Payment): string {
    return payment.provider + '-' + (payment.stripeAccountId ?? payment.organizationId ?? 'platform');
}

function getStripeFakeFees(payment: Payment) {
    return { serviceFee: payment.serviceFeePayout, transferFee: payment.transferFee };
}

/**
 * Upsert a settlement while accumulating the amount: a week larger than one batch settles in
 * multiple rounds, all in the same payout.
 */
async function upsertFakeSettlement(data: { provider: PaymentProvider; externalId: string; stripeAccountId: string | null; organizationId: string; reference: string; settledAt: Date; addedAmount: number }) {
    const existing = await Settlement.select()
        .where('provider', data.provider)
        .where('externalId', data.externalId)
        .first(false);

    return await SettlementService.upsertSettlement({
        provider: data.provider,
        externalId: data.externalId,
        stripeAccountId: data.stripeAccountId,
        organizationId: data.organizationId,
        reference: data.reference,
        amount: (existing?.amount ?? 0) + data.addedAmount,
        settledAt: data.settledAt,
    });
}

async function finishFakeSync(settlement: Settlement) {
    const lineCount = await PaymentSettlement.select().where('settlementId', settlement.id).count();
    const chargeCount = await SettlementCharge.select().where('settlementId', settlement.id).count();
    const feeCount = await ApplicationFee.select().where('settlementId', settlement.id).count();
    await SettlementService.finishSync(settlement, { transactionCount: lineCount + chargeCount + feeCount });
}

async function settleWeek(payments: Payment[], weekStart: DateTime, settledAt: Date, platformOrganizationId: string | null): Promise<number> {
    let settledCount = 0;
    const groups = new Map<string, Payment[]>();

    for (const payment of payments) {
        const account = getPayoutAccount(payment);
        const group = groups.get(account);

        if (group) {
            group.push(payment);
        } else {
            groups.set(account, [payment]);
        }
    }

    const week = weekStart.weekYear + '-W' + weekStart.weekNumber.toString().padStart(2, '0');

    for (const [account, group] of groups) {
        const id = 'fake-settlement-' + account + '-' + week;

        // Every account gets its own payout, so the reference has to tell them apart
        const reference = 'DEV ' + week + ' (' + account.slice(-8) + ')';
        const provider = group[0].provider!;

        // Payments without an organization arrived on the platform's own account
        const organizationId = group[0].organizationId ?? platformOrganizationId;
        if (!organizationId) {
            console.log('Skipped fake settlement ' + reference + ': no platform membership organization configured');
            continue;
        }

        // Fees are deducted from the payout, so the identity
        // amount = sum of payment lines + sum of charges closes
        let fees = 0;
        if (provider === PaymentProvider.Stripe) {
            fees = group.reduce((total, payment) => {
                const { serviceFee, transferFee } = getStripeFakeFees(payment);
                return total + serviceFee + transferFee;
            }, 0);
        } else if (provider === PaymentProvider.Mollie) {
            const net = MOLLIE_FEE_PER_PAYMENT * group.length;
            fees = net + Math.round(net * MOLLIE_FEE_VAT_PERCENTAGE / 100);
        }

        const grossAmount = group.reduce((total, payment) => total + payment.price, 0);
        const amount = grossAmount - fees;

        const settlement = await upsertFakeSettlement({
            provider,
            externalId: id,
            stripeAccountId: group[0].stripeAccountId,
            organizationId,
            reference,
            settledAt,
            addedAmount: amount,
        });

        for (const payment of group) {
            await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id,
                amount: payment.price,
                externalId: 'fake-txn-' + payment.id,
                occurredAt: payment.paidAt!,
            });

            payment.settlement = SettlementReference.create({ id, reference, settledAt, amount: settlement.amount });
            await payment.save();

            // Mark order as 'updated', or the frontend won't pull in the updates
            const order = await Order.getForPayment(null, payment.id);
            if (order) {
                order.updatedAt = new Date();
                order.forceSaveProperty('updatedAt');
                await order.save();
            }
        }

        if (provider === PaymentProvider.Stripe) {
            await createStripeFeeRows(settlement, group, settledAt, platformOrganizationId);
        } else if (provider === PaymentProvider.Mollie) {
            await createMollieCostRows(settlement, group, settledAt);
        }

        await finishFakeSync(settlement);
        settledCount += group.length;

        console.log('Created settlement ' + reference + ' of ' + Formatter.price(settlement.amount) + ' for ' + group.length + ' payments');
    }

    return settledCount;
}

/**
 * The application fee of a Stripe payment is mirrored, like Stripe mirrors it: two negative
 * deduction rows on the organization payout, and two application fee rows received in a fake
 * monthly platform payout.
 */
async function createStripeFeeRows(settlement: Settlement, group: Payment[], settledAt: Date, platformOrganizationId: string | null) {
    const month = SettlementService.getPeriodKey(settledAt);
    let addedFees = 0;
    const feeRows: { payment: Payment; applicationFeeId: string; parts: { type: ApplicationFeeType; amount: number; charge: SettlementCharge }[] }[] = [];

    for (const payment of group) {
        const { serviceFee, transferFee } = getStripeFakeFees(payment);
        if ((serviceFee === 0 && transferFee === 0) || !payment.organizationId || !payment.stripeAccountId) {
            continue;
        }

        const applicationFeeId = 'fake-fee-' + payment.id;
        const parts: { type: ApplicationFeeType; amount: number; charge: SettlementCharge }[] = [];
        addedFees += serviceFee + transferFee;

        for (const [chargeType, feeType, feeAmount] of [
            [SettlementChargeType.ApplicationFeeService, ApplicationFeeType.Service, serviceFee],
            [SettlementChargeType.ApplicationFeeTransfer, ApplicationFeeType.Transfer, transferFee],
        ] as const) {
            if (feeAmount === 0) {
                continue;
            }
            const charge = await SettlementService.upsertCharge({
                type: chargeType,
                externalId: applicationFeeId + ':' + chargeType,
                amount: -feeAmount,
                settlementId: settlement.id,
                applicationFeeId,
                paymentId: payment.id,
                organizationId: payment.organizationId,
                stripeAccountId: payment.stripeAccountId,
                occurredAt: payment.paidAt!,
            });
            parts.push({ type: feeType, amount: feeAmount, charge });
        }

        feeRows.push({ payment, applicationFeeId, parts });
    }

    if (feeRows.length === 0) {
        return;
    }

    if (!platformOrganizationId) {
        console.log('Skipped the fake platform fee payout: no platform membership organization configured');
        return;
    }

    // One fake platform payout per month receives all fees of that month
    const platformSettlement = await upsertFakeSettlement({
        provider: PaymentProvider.Stripe,
        externalId: 'fake-settlement-Stripe-platform-' + month,
        stripeAccountId: null,
        organizationId: platformOrganizationId,
        reference: 'DEV STRIPE FEES ' + month,
        settledAt,
        addedAmount: addedFees,
    });

    const invoicedFeeBalanceItemIds = new Set<string>();
    for (const { payment, applicationFeeId, parts } of feeRows) {
        for (const { type, amount, charge } of parts) {
            const fee = await ApplicationFeeService.upsertFee({
                externalId: applicationFeeId,
                type,
                amount,
                organizationId: platformOrganizationId,
                payingOrganizationId: payment.organizationId!,
                payingStripeAccountId: payment.stripeAccountId!,
                payingPaymentId: payment.id,
                settlementChargeId: charge.id,
                settlementId: platformSettlement.id,
                occurredAt: payment.paidAt!,
            });
            if (fee.balanceItemId) {
                invoicedFeeBalanceItemIds.add(fee.balanceItemId);
            }
        }
    }

    // A dev database can contain fee payments (e.g. copied history): keep their derived lines
    // in sync like a real payout walk does
    await SettlementService.updatePaymentSettlementsForAccountDeductionBalanceItems([...invoicedFeeBalanceItemIds]);

    await finishFakeSync(platformSettlement);
}

/**
 * Mollie deducts its own costs from the settlement: one fake transaction fee line plus its VAT, so
 * the settlement reconciles to 0 like a real one.
 */
async function createMollieCostRows(settlement: Settlement, group: Payment[], settledAt: Date) {
    const externalId = settlement.externalId + ':cost:0';
    const existing = await SettlementCharge.select().where('externalId', externalId).first(false);

    const addedNet = MOLLIE_FEE_PER_PAYMENT * group.length;
    const net = (existing ? -existing.amount : 0) + addedNet;
    const vat = Math.round(net * MOLLIE_FEE_VAT_PERCENTAGE / 100);
    const providerInvoiceId = 'fake-invoice-mollie-' + SettlementService.getPeriodKey(settledAt);

    await SettlementService.upsertCharge({
        type: SettlementChargeType.ProviderTransactionFee,
        externalId,
        amount: -net,
        settlementId: settlement.id,
        organizationId: settlement.organizationId,
        providerInvoiceId,
        description: 'DEV Mollie transactiekosten',
        occurredAt: settledAt,
    });

    await SettlementService.upsertCharge({
        type: SettlementChargeType.Tax,
        externalId: externalId + ':tax',
        amount: -vat,
        settlementId: settlement.id,
        organizationId: settlement.organizationId,
        providerInvoiceId,
        description: 'DEV BTW op Mollie transactiekosten',
        occurredAt: settledAt,
    });
}
