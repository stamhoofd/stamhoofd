import { PaymentProvider } from '@stamhoofd/structures';

import { SettlementService } from '../services/SettlementService.js';
import { checkAllMollieTokenSettlements, checkMollieSettlementsFor } from './CheckSettlements.js';
import type { StripePaymentIdCache } from './resolveStripePaymentId.js';
import { StripeFeeSync } from './StripeFeeSync.js';
import { StripeInvoicer } from './StripeInvoicer.js';
import { StripePayoutSync } from './StripePayoutSync.js';

export type SettlementSyncSummary = {
    feeMonths: number;
    failedFeeMonths: number;
    synced: number;
    skipped: number;
    failed: number;
};

/**
 * Runs a full settlement sync over a period, month by month: fees first, then our platform
 * payouts (warming the shared payment id cache), then the connected accounts, and Mollie last.
 * Everything is an upsert, so re-running (the nightly cron and a manual backfill) is cheap.
 */
export class SettlementSyncRunner {
    /**
     * Called after every processed month phase, to report progress.
     */
    callback: ((summary: SettlementSyncSummary) => void) | null = null;

    async run({ start = new Date(2025, 0, 1), end, providers, accountIds, force = false }: {
        start?: Date;
        end?: Date | null;
        providers?: PaymentProvider[] | null;
        accountIds?: string[] | null;
        force?: boolean;
    } = {}): Promise<SettlementSyncSummary> {
        const summary: SettlementSyncSummary = { feeMonths: 0, failedFeeMonths: 0, synced: 0, skipped: 0, failed: 0 };
        const rangeEnd = end ?? new Date();

        const includeStripe = !providers || providers.includes(PaymentProvider.Stripe);
        const includeMollie = !providers || providers.includes(PaymentProvider.Mollie);

        if (includeStripe && STAMHOOFD.STRIPE_SECRET_KEY) {
            await this.runStripe({ start, end: rangeEnd, accountIds, force, secretKey: STAMHOOFD.STRIPE_SECRET_KEY, summary });
        }

        if (includeMollie) {
            const token = STAMHOOFD.MOLLIE_ORGANIZATION_TOKEN;
            if (token) {
                try {
                    // The platform's own Mollie account belongs to the membership organization
                    await checkMollieSettlementsFor(token, await SettlementService.getPlatformOrganizationId(), true);
                } catch (e) {
                    // A missing membership organization must not block the per-organization tokens
                    console.error(e);
                }
            }
            await checkAllMollieTokenSettlements(true);
            this.callback?.(summary);
        }

        return summary;
    }

    private async runStripe({ start, end, accountIds, force, secretKey, summary }: { start: Date; end: Date; accountIds?: string[] | null; force: boolean; secretKey: string; summary: SettlementSyncSummary }) {
        const cache: StripePaymentIdCache = new Map();
        const feeSync = new StripeFeeSync({ secretKey, cache });
        const platformSync = new StripePayoutSync({ secretKey, cache });

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

            const platformResult = await platformSync.syncPayouts({ start: windowStart, end: windowEnd, force });
            summary.synced += platformResult.synced;
            summary.skipped += platformResult.skipped;
            summary.failed += platformResult.failed;

            const connectedResult = await StripePayoutSync.syncConnectedPayouts({ secretKey, start: windowStart, end: windowEnd, force, cache, accountIds });
            summary.synced += connectedResult.synced;
            summary.skipped += connectedResult.skipped;
            summary.failed += connectedResult.failed;

            this.callback?.(summary);
            currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        }
    }
}
