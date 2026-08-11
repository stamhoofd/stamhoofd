import { Email } from '@stamhoofd/email';
import { StripeAccount } from '@stamhoofd/models';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { PaymentProvider } from '@stamhoofd/structures';

import { SettlementService } from '../services/SettlementService.js';
import type { ProviderSettlementSyncRunner, ProviderSyncRunOptions } from './ProviderSettlementSyncRunner.js';
import type { StripePaymentIdCache } from './resolveStripePaymentId.js';
import { StripeFeeSync } from './StripeFeeSync.js';
import { StripeInvoicer } from './StripeInvoicer.js';
import { StripeSettlementSync } from './StripeSettlementSync.js';

/**
 * A settlement that keeps failing needs a human: stop retrying after this many attempts.
 */
const MAXIMUM_FAILURE_COUNT = 5;

/**
 * Stripe-specific knobs; owned here, opaque to the SettlementSyncRunner orchestrator (it forwards
 * them verbatim).
 */
export type StripeSyncOptions = {
    /**
     * Re-sync payouts that are already synced.
     */
    force?: boolean;

    /**
     * After the window walk, force-retry stuck settlements older than the window.
     */
    retryUnsynced?: boolean;
};

export class StripeSettlementSyncRunner implements ProviderSettlementSyncRunner {
    /**
     * Warmed by the window walk, reused by the retry pass.
     */
    readonly cache: StripePaymentIdCache;

    readonly #secretKey: string;
    readonly #force: boolean;
    readonly #retryUnsynced: boolean;

    constructor({ secretKey, cache, force = false, retryUnsynced = false }: { secretKey: string; cache?: StripePaymentIdCache } & StripeSyncOptions) {
        this.#secretKey = secretKey;
        this.cache = cache ?? new Map();
        this.#force = force;
        this.#retryUnsynced = retryUnsynced;
    }

    /**
     * Walks the window month by month: fees first, then our platform payouts (warming the shared
     * payment id cache), then the connected accounts.
     */
    async run({ start, end, summary, onProgress }: ProviderSyncRunOptions): Promise<void> {
        const feeSync = new StripeFeeSync({ secretKey: this.#secretKey, cache: this.cache });
        const platformSync = new StripeSettlementSync({ secretKey: this.#secretKey, cache: this.cache });

        let currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);

        while (true) {
            const { start: monthStartUnix, end: monthEndUnix } = StripeInvoicer.getMonthUnixStartEnd(currentMonth);
            if (monthStartUnix * 1000 > end.getTime()) {
                break;
            }

            const windowStart = new Date(Math.max(monthStartUnix * 1000, start.getTime()));
            const windowEnd = new Date(Math.min(monthEndUnix * 1000, end.getTime()));

            try {
                await feeSync.syncFees({ start: windowStart, end: windowEnd });
                summary.feeMonths += 1;
            } catch (e) {
                // syncFees already emailed nothing: it throws an aggregate, the month is retried by
                // the next run and the month is not invoiced until it completes
                console.error('Fee sync failed for month ' + currentMonth.toISOString(), e);
                summary.failedFeeMonths += 1;
            }

            const platformResult = await platformSync.syncPayouts({ start: windowStart, end: windowEnd, force: this.#force });
            summary.synced += platformResult.synced;
            summary.skipped += platformResult.skipped;
            summary.failed += platformResult.failed;

            const connectedResult = await this.syncConnectedPayouts({ start: windowStart, end: windowEnd });
            summary.synced += connectedResult.synced;
            summary.skipped += connectedResult.skipped;
            summary.failed += connectedResult.failed;

            onProgress?.();
            currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        }

        if (this.#retryUnsynced) {
            await this.retryUnsyncedSettlements({ windowStart: start });
        }
    }

    /**
     * Walks the payouts of every active connected account, after the platform walk warmed the
     * shared payment id cache.
     */
    async syncConnectedPayouts({ start, end }: { start: Date; end?: Date }): Promise<{ synced: number; skipped: number; failed: number }> {
        const totals = { synced: 0, skipped: 0, failed: 0 };

        const accounts = await StripeAccount.select().where('status', 'active').fetch();

        for (const account of accounts) {
            try {
                const sync = new StripeSettlementSync({ secretKey: this.#secretKey, stripeAccount: account, cache: this.cache });
                const result = await sync.syncPayouts({ start, end, force: this.#force });
                totals.synced += result.synced;
                totals.skipped += result.skipped;
                totals.failed += result.failed;
            } catch (e) {
                console.error('Failed to sync payouts of Stripe account ' + account.accountId, e);
                totals.failed += 1;

                Email.sendWebmaster({
                    subject: 'Synchroniseren Stripe uitbetalingen van account ' + account.accountId + ' mislukt',
                    html: 'Synchroniseren van de Stripe uitbetalingen van account ' + account.accountId + ' is mislukt. <br><br> ' + (e as Error).toString(),
                });
            }
        }

        return totals;
    }

    /**
     * Settlements outside the window that never completed a sync (syncedAt IS NULL is the whole
     * error queue). Every failed retry bumps syncFailureCount, so a broken payout stops retrying
     * after MAXIMUM_FAILURE_COUNT attempts and waits in the problem report instead. Always forced,
     * regardless of the force configuration.
     */
    async retryUnsyncedSettlements({ windowStart }: { windowStart: Date }): Promise<void> {
        const settlements = await Settlement.select()
            .where('provider', PaymentProvider.Stripe)
            .where('syncedAt', null)
            .where('syncFailureCount', '<', MAXIMUM_FAILURE_COUNT)
            // The window walk already attempted (and counted) recent payouts
            .where('settledAt', '<', windowStart)
            .limit(50)
            .fetch();

        for (const settlement of settlements) {
            const failureCountBefore = settlement.syncFailureCount;
            try {
                const stripeAccount = settlement.stripeAccountId ? await StripeAccount.getByID(settlement.stripeAccountId) : null;
                const sync = new StripeSettlementSync({ secretKey: this.#secretKey, stripeAccount: stripeAccount ?? null, cache: this.cache });
                await sync.syncPayoutById(settlement.externalId, { force: true });
            } catch (e) {
                console.error('Retry of settlement ' + settlement.externalId + ' failed', e);

                // Errors before the walk (e.g. the payout can't be retrieved anymore) don't pass
                // markSyncFailed: count them here or the retry cap never triggers
                const fresh = await Settlement.getByID(settlement.id);
                if (fresh && fresh.syncFailureCount === failureCountBefore) {
                    await SettlementService.markSyncFailed(fresh);
                }
            }
        }
    }
}
