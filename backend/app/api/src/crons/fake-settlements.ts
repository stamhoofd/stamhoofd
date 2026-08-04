/**
 * Development only: payment providers pay out on their own schedule and those payouts never reach a
 * local machine, so online payments stay 'not paid out yet' forever. This mimics a weekly payout per
 * provider account, so everything built on top of payouts has data to show.
 */

import { registerCron } from '@stamhoofd/crons';
import { Order, Payment } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { PaymentStatus, SettlementReference } from '@stamhoofd/structures';
import { SETTLING_PAYMENT_PROVIDERS } from '@stamhoofd/structures/PaymentSettlement.js';
import { Formatter } from '@stamhoofd/utility';
import type { DateTime } from 'luxon';

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

export async function createFakeSettlements() {
    if (STAMHOOFD.environment !== 'development') {
        return;
    }

    const now = new Date();

    // Pay out week per week, oldest first, until we reach a week that isn't paid out yet
    for (;;) {
        const oldest = await selectUnsettledPayments().orderBy('paidAt', 'ASC').first(false);
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
        const payments = await selectUnsettledPayments().where('paidAt', '<', weekEnd.toJSDate()).limit(BATCH_SIZE).fetch();
        await settleWeek(payments, weekStart, settledAt);
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

async function settleWeek(payments: Payment[], weekStart: DateTime, settledAt: Date) {
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
        const amount = group.reduce((total, payment) => total + payment.price, 0);

        for (const payment of group) {
            payment.settlement = SettlementReference.create({ id, reference, settledAt, amount });
            await payment.save();

            // Mark order as 'updated', or the frontend won't pull in the updates
            const order = await Order.getForPayment(null, payment.id);
            if (order) {
                order.updatedAt = new Date();
                order.forceSaveProperty('updatedAt');
                await order.save();
            }
        }

        console.log('Created settlement ' + reference + ' of ' + Formatter.price(amount) + ' for ' + group.length + ' payments');
    }
}
