import type Stripe from 'stripe';

/**
 * The service/transfer split of one or more application fees. `fromStripe` is the single source of
 * the split rule: the serviceFee metadata on the originating charge (in cents) is the service part,
 * the remainder of the fee is the transfer part.
 */
export class ApplicationFeeDetails {
    transferFee = 0;
    serviceFee = 0;
    count = 0;
    minimumDate: Date | null = null;
    maximumDate: Date | null = null;

    constructor(details: { count?: number; transferFee: number; serviceFee: number; minimumDate: Date | null; maximumDate: Date | null }) {
        this.count = details.count ?? 0;
        this.transferFee = details.transferFee;
        this.serviceFee = details.serviceFee;
        this.minimumDate = details.minimumDate;
        this.maximumDate = details.maximumDate;
    }

    get amount() {
        return this.transferFee + this.serviceFee;
    }

    static fromStripe(transaction: Pick<Stripe.BalanceTransaction, 'source' | 'amount' | 'created'>) {
        const source = transaction.source as Stripe.ApplicationFee;

        // Only a destination charge has an originating transaction on our own account. A direct
        // charge (Standard accounts) keeps it on the connected account, where this walk can't read
        // the metadata that splits the fee
        const originatingTransaction = source.originating_transaction;
        if (!originatingTransaction || typeof originatingTransaction === 'string') {
            throw new Error('Application fee ' + source.id + ' has no expanded originating transaction, which is not supported for direct charges');
        }

        const metadata = (originatingTransaction as Stripe.Charge).metadata;

        const serviceFeeStr = metadata.serviceFee as unknown;
        if (serviceFeeStr === undefined || typeof serviceFeeStr !== 'string') {
            throw new Error('Missing serviceFee metadata');
        }

        const parsed = parseInt(serviceFeeStr);
        if (isNaN(parsed) || !isFinite(parsed)) {
            throw new Error('Invalid serviceFee metadata');
        }
        const serviceFee = parsed * 100; // in cents
        const transferFee = transaction.amount * 100 - serviceFee;

        // Both parts are billed as their own balance item, so a negative one would invent a credit
        // out of wrong metadata instead of failing
        if (serviceFee < 0 || transferFee < 0) {
            throw new Error('Application fee of ' + transaction.amount * 100 + ' does not cover its serviceFee of ' + serviceFee);
        }

        return new ApplicationFeeDetails({
            count: 1,
            serviceFee,
            transferFee,
            minimumDate: new Date(transaction.created * 1000),
            maximumDate: new Date(transaction.created * 1000),
        });
    }
}
