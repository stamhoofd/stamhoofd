import { Order, Payment } from '@stamhoofd/models';
import { SettlementReference } from '@stamhoofd/structures';
import Stripe from 'stripe';
import { passthroughFetch } from './passthroughFetch.js';
import type { StripePaymentIdCache } from './resolveStripePaymentId.js';
import { resolveStripePaymentId } from './resolveStripePaymentId.js';

export class StripePayoutChecker {
    private stripe: Stripe;
    private stripePlatform: Stripe;
    private paymentIdCache: StripePaymentIdCache = new Map();

    constructor({ secretKey, stripeAccount }: { secretKey: string; stripeAccount?: string }) {
        this.stripe = new Stripe(
            secretKey, {
                apiVersion: '2024-06-20',
                typescript: true,
                maxNetworkRetries: 1,
                timeout: 10000,
                stripeAccount,
                httpClient: STAMHOOFD.environment === 'test'
                    ? Stripe.createFetchHttpClient(passthroughFetch)
                    : undefined,
            });

        this.stripePlatform = new Stripe(
            secretKey, {
                apiVersion: '2024-06-20',
                typescript: true,
                maxNetworkRetries: 1,
                timeout: 10000,
                httpClient: STAMHOOFD.environment === 'test'
                    ? Stripe.createFetchHttpClient(passthroughFetch)
                    : undefined,
            });
    }

    async checkSettlements(checkAll = false) {
        // Check last 2 weeks + 3 day margin, unless we check them all
        const d = new Date();
        d.setDate(d.getDate() - 20);

        if (checkAll) {
            d.setFullYear(2022, 11, 1);
        }

        // Loop all payouts
        try {
            // Fetch all payouts that are paid out
            for await (const payout of this.stripe.payouts.list({
                status: 'paid',
                arrival_date: {
                    gte: Math.floor(d.getTime() / 1000),
                },
            })) {
                // Get all payments for this payout
                try {
                    await this.fetchBalanceItems(payout);
                } catch (e) {
                    console.error('Error for payout ' + payout.id);
                    console.error(e);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    private async fetchBalanceItems(payout: Stripe.Payout) {
        // For the given payout, fetch all balance items
        const params = {
            payout: payout.id,
            // Via the Application Fee object, we can get the original payment metadata
            expand: ['data.source', 'data.source.application_fee', 'data.source.application_fee.originating_transaction'],
        };

        for await (const balanceItem of this.stripe.balanceTransactions.list(params)) {
            if (balanceItem.type === 'charge' || balanceItem.type === 'payment') {
                await this.handleBalanceItem(payout, balanceItem);
            }
        }

        return;
    }

    private async handleBalanceItem(payout: Stripe.Payout, balanceItem: Stripe.BalanceTransaction) {
        if (!balanceItem.source || typeof balanceItem.source === 'string') {
            return;
        }
        if (balanceItem.source.object !== 'charge') {
            console.log('No payment id set for charge ' + balanceItem.source.id);
            return;
        }

        const paymentId = await resolveStripePaymentId(balanceItem.source, {
            stripePlatform: this.stripePlatform,
            cache: this.paymentIdCache,
        });

        if (!paymentId) {
            console.log(balanceItem);
            console.log('No payment id set for charge ' + balanceItem.source.id);
            return;
        }

        const applicationFee = balanceItem.source.application_fee_amount;
        const otherFees = balanceItem.fee;
        const totalFees = Math.max(otherFees, (applicationFee ?? 0));

        // Cool, we can store this in the database now.

        const payment = await Payment.getByID(paymentId);
        if (!payment) {
            console.log('Invalid payment id set for charge ' + balanceItem.source.id + ': ' + paymentId);
            return;
        }

        if (payment.price !== balanceItem.amount * 100) {
            console.log('Amount mismatch for payment ' + payment.id + ': ' + payment.price + ' !== ' + (balanceItem.amount * 100));
            return;
        }

        const settlement = SettlementReference.create({
            id: payout.id,
            reference: payout.statement_descriptor ?? '',
            settledAt: new Date(payout.arrival_date * 1000),
            amount: payout.amount * 100,
            // Set only if application fee is witheld
            fee: totalFees * 100,
        });

        payment.settlement = settlement;
        payment.transferFee = totalFees * 100 - payment.serviceFeePayout;

        // Force an updatedAt timestamp of the related order
        // Mark order as 'updated', or the frontend won't pull in the updates
        const order = await Order.getForPayment(null, payment.id);
        if (order) {
            order.updatedAt = new Date();
            order.forceSaveProperty('updatedAt');
            await order.save();
        }

        await payment.save();
    }
}
