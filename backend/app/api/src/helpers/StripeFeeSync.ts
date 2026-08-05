import { SimpleError } from '@simonbackx/simple-errors';
import { StripeAccount } from '@stamhoofd/models';
import type { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import Stripe from 'stripe';

import { SettlementService } from '../services/SettlementService.js';
import { passthroughFetch } from './passthroughFetch.js';
import type { StripePaymentIdCache } from './resolveStripePaymentId.js';
import { resolveStripePaymentId } from './resolveStripePaymentId.js';
import { ApplicationFeeDetails } from './StripeInvoicer.js';

/**
 * Stores the platform side of every application fee: the two Received rows that the monthly
 * invoicing will be built on. The settlement link is left alone here — our payout usually arrives
 * later, and the platform payout sync fills it in.
 */
export class StripeFeeSync {
    private stripe: Stripe;

    /**
     * Shared with the payout syncs of the same run, so most charges resolve without extra lookups.
     */
    readonly cache: StripePaymentIdCache;

    constructor({ secretKey, cache }: { secretKey: string; cache?: StripePaymentIdCache }) {
        this.cache = cache ?? new Map();
        this.stripe = new Stripe(secretKey, {
            apiVersion: '2024-06-20',
            typescript: true,
            maxNetworkRetries: 1,
            timeout: 10000,
            httpClient: STAMHOOFD.environment === 'test'
                ? Stripe.createFetchHttpClient(passthroughFetch)
                : undefined,
        });
    }

    /**
     * Walks all application_fee balance transactions in the window. A broken fee doesn't block
     * storing the others, but the walk still fails loudly at the end: a month is only invoiced
     * after a run without errors.
     */
    async syncFees({ start, end }: { start: Date; end: Date }) {
        const errors: unknown[] = [];

        for await (const transaction of this.stripe.balanceTransactions.list({
            type: 'application_fee',
            created: {
                gte: Math.floor(start.getTime() / 1000),
                lte: Math.floor(end.getTime() / 1000),
            },
            expand: ['data.source', 'data.source.originating_transaction'],
            limit: 100,
        })) {
            try {
                await this.syncFeeTransaction(transaction);
            } catch (e) {
                console.error('Failed to sync application fee transaction ' + transaction.id, e);
                errors.push(e);
            }
        }

        if (errors.length > 0) {
            throw new SimpleError({
                code: 'stripe_fee_sync_failed',
                message: 'Fee sync failed for ' + errors.length + ' transaction(s): ' + errors.map(e => e instanceof Error ? e.message : String(e)).join('; '),
            });
        }
    }

    /**
     * Upserts the Received rows of one application_fee balance transaction. Throws instead of
     * writing a guessed row: missing serviceFee metadata, an unknown Stripe account or an
     * unresolvable payment all mean someone has to look at it first.
     *
     * The platform payout sync passes `settlementId` to link the rows to the payout containing
     * them.
     */
    async syncFeeTransaction(transaction: Stripe.BalanceTransaction, options: { settlementId?: string } = {}): Promise<SettlementCharge[]> {
        const fee = transaction.source as Stripe.ApplicationFee;
        const accountId = typeof fee.account === 'string' ? fee.account : fee.account.id;

        const stripeAccount = await StripeAccount.select().where('accountId', accountId).first(false);
        if (!stripeAccount) {
            throw new SimpleError({
                code: 'stripe_account_not_found',
                message: 'No Stripe account found for ' + accountId,
            });
        }

        const originatingTransaction = fee.originating_transaction;
        if (!originatingTransaction || typeof originatingTransaction === 'string') {
            throw new SimpleError({
                code: 'missing_originating_transaction',
                message: 'Application fee ' + fee.id + ' has no expanded originating transaction',
            });
        }

        const details = ApplicationFeeDetails.fromStripe(transaction);

        const paymentId = await resolveStripePaymentId(originatingTransaction as Stripe.Charge, {
            stripePlatform: this.stripe,
            cache: this.cache,
        });

        if (!paymentId) {
            throw new SimpleError({
                code: 'payment_not_found',
                message: 'No payment found for application fee ' + fee.id,
            });
        }

        const occurredAt = new Date(transaction.created * 1000);

        const rows: SettlementCharge[] = [];

        for (const [type, amount] of [
            [SettlementChargeType.ReceivedApplicationFeeService, details.serviceFee],
            [SettlementChargeType.ReceivedApplicationFeeTransfer, details.transferFee],
        ] as const) {
            if (amount === 0) {
                continue;
            }

            rows.push(await SettlementService.upsertCharge({
                type,
                externalId: fee.id + ':' + type,
                amount,
                ...(options.settlementId !== undefined ? { settlementId: options.settlementId } : {}),
                applicationFeeId: fee.id,
                paymentId,
                organizationId: stripeAccount.organizationId,
                stripeAccountId: stripeAccount.id,
                occurredAt,
            }));
        }

        return rows;
    }
}
