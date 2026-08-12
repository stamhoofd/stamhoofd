import { PaymentProvider } from '@stamhoofd/structures';

import { MollieSettlementSyncRunner } from './MollieSettlementSyncRunner.js';
import type { SettlementSyncSummary } from './ProviderSettlementSyncRunner.js';
import type { StripeSyncOptions } from './StripeSettlementSyncRunner.js';
import { StripeSettlementSyncRunner } from './StripeSettlementSyncRunner.js';
import { WebmasterReport } from './WebmasterReport.js';

/**
 * Runs a full settlement sync over a period by wiring up one runner per provider, all sharing one
 * summary, one progress callback and one problem report. Provider-specific configuration is opaque
 * here: the `stripe` options go to the StripeSettlementSyncRunner constructor verbatim; Mollie
 * needs none. Everything is an upsert, so re-running (the nightly cron and a manual backfill) is
 * cheap.
 */
export class SettlementSyncRunner {
    /**
     * Called after every processed unit of work, to report progress.
     */
    callback: ((summary: SettlementSyncSummary) => void) | null = null;

    async run({ start = new Date(2025, 0, 1), end, providers, stripe }: {
        start?: Date;
        end?: Date | null;
        providers?: PaymentProvider[] | null;
        stripe?: StripeSyncOptions;
    } = {}): Promise<SettlementSyncSummary> {
        const summary: SettlementSyncSummary = { feeMonths: 0, failedFeeMonths: 0, synced: 0, skipped: 0, failed: 0 };
        const rangeEnd = end ?? new Date();
        const onProgress = () => this.callback?.(summary);

        const includeStripe = !providers || providers.includes(PaymentProvider.Stripe);
        const includeMollie = !providers || providers.includes(PaymentProvider.Mollie);

        // A single cause (a first sync, a bug) fails every payout it touches: report all of them in
        // one email instead of one per payout
        return await WebmasterReport.group('Synchroniseren uitbetalingen', async () => {
            // One provider's outage must not starve the others (or the caller's follow-up
            // reporting): unsynced settlements stay behind with syncedAt null, so the next run picks
            // them up
            if (includeStripe && STAMHOOFD.STRIPE_SECRET_KEY) {
                const runner = new StripeSettlementSyncRunner({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY, ...stripe });
                try {
                    await runner.run({ start, end: rangeEnd, summary, onProgress });
                } catch (e) {
                    console.error('Stripe settlement sync failed', e);
                    summary.failed += 1;
                }
            }

            if (includeMollie) {
                const runner = new MollieSettlementSyncRunner();
                try {
                    await runner.run({ start, end: rangeEnd, summary, onProgress });
                } catch (e) {
                    console.error('Mollie settlement sync failed', e);
                    summary.failed += 1;
                }
            }

            return summary;
        });
    }
}
