import {Order, Payment} from "@stamhoofd/models";
import { Settlement } from "@stamhoofd/structures";
import Stripe from "stripe";

export class StripePayoutChecker {
    private stripe: Stripe;

    constructor({secretKey, stripeAccount}: { secretKey: string, stripeAccount?: string}) {
        this.stripe = new Stripe(
            secretKey, {
                apiVersion: '2022-11-15', 
                typescript: true, 
                maxNetworkRetries: 1, 
                timeout: 10000,
                stripeAccount
        });
    }

    async checkSettlements(checkAll = false) {
         // Check last 2 weeks + 3 day margin, unless we check them all
        const d = new Date()
        d.setDate(d.getDate() - 17)

        if (checkAll) {
            d.setFullYear(2022, 11, 1)
        }

        // Loop all payouts
        try {
            // Fetch all payouts that are paid out
            for await (const payout of this.stripe.payouts.list({
                status: 'paid',
                arrival_date: {
                    gte: Math.floor(d.getTime() / 1000)
                }
            })) {
                // Get all payments for this payout
                await this.fetchBalanceItems(payout);
            }

        } catch (e) {
            console.error(e)
        }
    }

    private async fetchBalanceItems(payout: Stripe.Payout) {
        // For the given payout, fetch all balance items
        const params = {
            payout: payout.id, 
            // Via the Application Fee object, we can get the original payment metadata
            expand: ['data.source', 'data.source.application_fee', 'data.source.application_fee.originating_transaction'],
            // TODO: ALSO DO CARDS! (type: 'charge')
            //type: 'payment'
        };

        for await (const balanceItem of this.stripe.balanceTransactions.list(params)) {
            // TODO

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
            console.log("No payment id set for charge " + balanceItem.source.id)
            return;
        }

        let paymentId = balanceItem.source.metadata.payment;

        if (!paymentId) {
            // Search in the metadata of the application fee, originating transaction
            if (typeof balanceItem.source.application_fee !== 'string' && balanceItem.source.application_fee) {
                const applicationFee = balanceItem.source.application_fee;

                if (applicationFee.originating_transaction !== 'string' && applicationFee.originating_transaction) {
                    const originatingTransaction = applicationFee.originating_transaction as Stripe.Charge;
                    paymentId = originatingTransaction.metadata.payment;
                }
            }
        }

        if (!paymentId) {
            console.log(balanceItem)
            console.log("No payment id set for charge " + balanceItem.source.id)
            return;
        }

        const applicationFee = balanceItem.source.application_fee_amount;

        // Cool, we can store this in the database now.

        const payment = await Payment.getByID(paymentId);
        if (!payment) {
            console.log("Invalid payment id set for charge " + balanceItem.source.id+': '+paymentId)
            return;
        }

        if (payment.price !== balanceItem.amount) {
            console.log("Amount mismatch for payment " + payment.id+': '+payment.price+' !== '+balanceItem.amount)
            return;
        }

        const settlement = Settlement.create({
            id: payout.id,
            reference: payout.statement_descriptor ?? '',
            settledAt: new Date(payout.arrival_date * 1000),
            amount: payout.amount,
            // Set only if application fee is witheld
            fee: applicationFee ?? 0
        });

        payment.settlement = settlement;
        payment.transferFee = applicationFee ?? 0;

        // Force an updatedAt timestamp of the related order
        // Mark order as 'updated', or the frontend won't pull in the updates
        const order = await Order.getForPayment(null, payment.id)
        if (order) {
            order.updatedAt = new Date();
            order.forceSaveProperty('updatedAt');
            await order.save();
        }

        await payment.save();
    }

}