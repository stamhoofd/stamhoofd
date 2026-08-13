import { StripeAccount } from '@stamhoofd/models';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { AbortSignal } from '@stamhoofd/queues';
import { PaymentProvider } from '@stamhoofd/structures';
import { SettlementStatus } from '@stamhoofd/structures/settlements/SettlementStatus.js';

import { SettlementService } from '../services/SettlementService.js';
import type { ProviderSettlementSyncRunner, ProviderSyncRunOptions } from './ProviderSettlementSyncRunner.js';
import { StripeSettlementSync } from './StripeSettlementSync.js';
import { WebmasterReport } from './WebmasterReport.js';

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
    readonly #secretKey: string;
    readonly #force: boolean;
    readonly #retryUnsynced: boolean;

    constructor({ secretKey, force = false, retryUnsynced = false }: { secretKey: string } & StripeSyncOptions) {
        this.#secretKey = secretKey;
        this.#force = force;
        this.#retryUnsynced = retryUnsynced;
    }

    /**
     * Walks the window month by month: fees first, then our platform payouts, then the connected
     * accounts.
     */
    async run({ start, end, summary, onProgress, abort }: ProviderSyncRunOptions): Promise<void> {
        const platformSync = new StripeSettlementSync({ secretKey: this.#secretKey });

        let currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);

        while (true) {
            abort.throwIfAborted();

            const { start: monthStartUnix, end: monthEndUnix } = SettlementService.getMonthUnixStartEnd(currentMonth);
            if (monthStartUnix * 1000 > end.getTime()) {
                break;
            }

            const windowStart = new Date(Math.max(monthStartUnix * 1000, start.getTime()));
            const windowEnd = new Date(Math.min(monthEndUnix * 1000, end.getTime()));

            try {
                await platformSync.syncFees({ start: windowStart, end: windowEnd, abort });
                summary.feeMonths += 1;
            } catch (e) {
                abort.throwIfAborted();

                // syncFees already emailed nothing: it throws an aggregate, the month is retried by
                // the next run and the month is not invoiced until it completes
                console.error('Fee sync failed for month ' + currentMonth.toISOString(), e);
                summary.failedFeeMonths += 1;
            }

            const platformResult = await platformSync.syncPayouts({ start: windowStart, end: windowEnd, force: this.#force, abort });
            summary.synced += platformResult.synced;
            summary.skipped += platformResult.skipped;
            summary.failed += platformResult.failed;

            const connectedResult = await this.syncConnectedPayouts({ start: windowStart, end: windowEnd, abort });
            summary.synced += connectedResult.synced;
            summary.skipped += connectedResult.skipped;
            summary.failed += connectedResult.failed;

            onProgress?.();
            currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        }

        if (this.#retryUnsynced) {
            await this.retryUnsyncedSettlements({ windowStart: start, abort });
        }
    }

    /**
     * Walks the payouts of every active connected account.
     */
    async syncConnectedPayouts({ start, end, abort = new AbortSignal() }: { start: Date; end?: Date; abort?: AbortSignal }): Promise<{ synced: number; skipped: number; failed: number }> {
        const totals = { synced: 0, skipped: 0, failed: 0 };

        const accounts = await StripeAccount.select().where('status', 'active').fetch();

        for (const account of accounts) {
            abort.throwIfAborted();

            try {
                const sync = new StripeSettlementSync({ secretKey: this.#secretKey, stripeAccount: account });
                const result = await sync.syncPayouts({ start, end, force: this.#force, abort });
                totals.synced += result.synced;
                totals.skipped += result.skipped;
                totals.failed += result.failed;
            } catch (e) {
                // An interrupted account is not an account with a problem: it may not be marked
                // inaccessible, counted or reported
                abort.throwIfAborted();

                if (e !== null && typeof e === 'object' && 'type' in e && e.type === 'StripePermissionError' && e.message.includes(account.accountId) && e.message.includes('does not have access to account')) {
                    // Stripe account no longer in active use
                    console.error(e, 'marking stripe account', account.id, account.accountId, 'as inaccessible because we do not seem to have access to it any longer');
                    account.status = 'inaccessible';
                    await account.save();
                    totals.skipped += 1;
                    continue;
                }
                console.error('Failed to sync payouts of Stripe account ' + account.accountId, e);
                totals.failed += 1;

                WebmasterReport.report('Synchroniseren Stripe uitbetalingen van account ' + account.accountId + ' mislukt', e);
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
    async retryUnsyncedSettlements({ windowStart, abort = new AbortSignal() }: { windowStart: Date; abort?: AbortSignal }): Promise<void> {
        const settlements = await Settlement.select()
            .where('provider', PaymentProvider.Stripe)
            .where('syncedAt', null)
            // Only money that actually arrived holds transactions to walk
            .where('status', SettlementStatus.Paid)
            .where('syncFailureCount', '<', MAXIMUM_FAILURE_COUNT)
            // The window walk already attempted (and counted) recent payouts
            .where('settledAt', '<', windowStart)
            .limit(50)
            .fetch();

        for (const settlement of settlements) {
            abort.throwIfAborted();

            const failureCountBefore = settlement.syncFailureCount;
            try {
                const stripeAccount = settlement.stripeAccountId ? await StripeAccount.getByID(settlement.stripeAccountId) : null;
                const sync = new StripeSettlementSync({ secretKey: this.#secretKey, stripeAccount: stripeAccount ?? null });
                await sync.syncPayoutById(settlement.externalId, { force: true, abort });
            } catch (e) {
                // An interrupted retry may not count towards the cap: the payout is still waiting
                // for a real attempt
                abort.throwIfAborted();

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
