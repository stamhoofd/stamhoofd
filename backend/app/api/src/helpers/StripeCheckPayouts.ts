import Stripe from "stripe";

export class StripeCheckPayouts {
    private stripe: Stripe;

    constructor({secretKey}: { secretKey: string}) {
        this.stripe = new Stripe(secretKey, {apiVersion: '2022-11-15', typescript: true, maxNetworkRetries: 1, timeout: 10000});
    }

    async checkSettlements(checkAll = false) {
        /*if (!checkAll && lastSettlementCheck && (lastSettlementCheck > new Date(new Date().getTime() - 24 * 60 * 60 * 1000))) {
            console.log("Skip settlement check")
            return
        }

        if (STAMHOOFD.environment !== "production") {
            console.log("Skip settlement check")
            return
        }

        console.log("Checking Stripe Payouts...")
        lastSettlementCheck = new Date()

        const token = STAMHOOFD.STRIPE_SECRET_KEY
        if (!token) {
            console.error("Missing STRIPE_SECRET_KEY")
        } else {
            await checkSettlementsFor(token, checkAll)
        }

        // Loop all payouts
        try {
            // Fetch all payouts that are paid out
            const params = {status: 'paid', expand: ['data.source']};
            for await (const payout of this.stripe.payouts.list(params)) {
                
            }

        } catch (e) {
            console.error(e)
        }*/
    }

    private async fetchBalanceItems(options: Stripe.BalanceTransactionListParams) {
        // For the given payout, fetch all balance items
        const params = {...options};

        for await (const balanceItem of this.stripe.balanceTransactions.list(params)) {
            // TODO
        }

        return;
    }

}