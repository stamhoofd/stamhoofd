// Stripe only. The older 'checkSettlements' cron (crons.ts -> helpers/CheckSettlements.ts) stays
// the canonical Mollie walk: Mollie exposes no per-account payout listing to re-walk cheaply, so
// its daily walk writes the legacy blob and the new settlement rows in one pass. For Stripe that
// cron only writes the legacy blob (StripePayoutChecker); this cron writes the settlement tables.
// Both run during the rollout so old and new can be compared; the legacy Stripe checker disappears
// after the switch.
import { registerCron } from '@stamhoofd/crons';
import { Email } from '@stamhoofd/email';
import { StripeAccount } from '@stamhoofd/models';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { PaymentProvider } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { SettlementService } from '../services/SettlementService.js';
import { SettlementSyncRunner } from '../helpers/SettlementSyncRunner.js';
import type { StripePaymentIdCache } from '../helpers/resolveStripePaymentId.js';
import { StripePayoutSync } from '../helpers/StripePayoutSync.js';
import { checkSettlements } from '../helpers/CheckSettlements.js';

registerCron('stripe-settlement-sync', syncStripeSettlements);
registerCron('checkSettlements', checkSettlements);

/**
 * How many days of payouts the nightly run re-walks. Everything is an upsert and synced payouts
 * are skipped, so this window is cheap.
 */
const SYNC_WINDOW_DAYS = 30;

/**
 * A settlement that keeps failing needs a human: stop retrying after this many attempts.
 */
const MAXIMUM_FAILURE_COUNT = 5;

let lastSettlementSync: Date | null = null;

async function syncStripeSettlements() {
    if (STAMHOOFD.environment !== 'production') {
        return;
    }

    // Wait for the next day before doing a new sync
    const today = new Date();
    if (lastSettlementSync && Formatter.dateIso(lastSettlementSync) === Formatter.dateIso(today)) {
        console.log('Settlement sync done for this day');
        return;
    }

    if (!STAMHOOFD.STRIPE_SECRET_KEY) {
        console.log('No stripe key set');
        return;
    }
    const secretKey = STAMHOOFD.STRIPE_SECRET_KEY;

    console.log('Syncing settlements...');

    const start = new Date(today.getTime() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Mollie is not included here: the existing CheckSettlements walk already runs daily and
    // dual-writes the new rows
    const runner = new SettlementSyncRunner();
    await runner.run({ start, providers: [PaymentProvider.Stripe] });

    const cache: StripePaymentIdCache = new Map();
    await retryUnsyncedSettlements(secretKey, start, cache);
    await reportProblemSettlements();

    lastSettlementSync = new Date();
}

/**
 * Settlements outside the nightly window that never completed a sync (syncedAt IS NULL is the whole
 * error queue). Every failed retry bumps syncFailureCount, so a broken payout stops retrying after
 * MAXIMUM_FAILURE_COUNT attempts and waits in the problem report instead.
 *
 * Exported for tests only.
 */
export async function retryUnsyncedSettlements(secretKey: string, windowStart: Date, cache: StripePaymentIdCache = new Map()) {
    const settlements = await Settlement.select()
        .where('provider', PaymentProvider.Stripe)
        .where('syncedAt', null)
        .where('syncFailureCount', '<', MAXIMUM_FAILURE_COUNT)
        // The window walk already attempted (and counted) recent payouts tonight
        .where('settledAt', '<', windowStart)
        .limit(50)
        .fetch();

    for (const settlement of settlements) {
        const failureCountBefore = settlement.syncFailureCount;
        try {
            const stripeAccount = settlement.stripeAccountId ? await StripeAccount.getByID(settlement.stripeAccountId) : null;
            const sync = new StripePayoutSync({ secretKey, stripeAccount: stripeAccount ?? null, cache });
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

/**
 * Every unsynced settlement or non-zero delta is a real question to answer, not noise.
 *
 * Exported for tests only.
 */
export async function reportProblemSettlements() {
    const unexplained = await Settlement.select()
        .where('unexplainedAmount', '!=', 0)
        .limit(50)
        .fetch();

    const unsynced = await Settlement.select()
        .where('syncedAt', null)
        .limit(50)
        .fetch();

    if (unexplained.length === 0 && unsynced.length === 0) {
        return;
    }

    const total = new Set([...unexplained, ...unsynced].map(s => s.id)).size;

    const describe = (settlement: Settlement) => {
        return settlement.provider + ' ' + settlement.externalId + ' (' + Formatter.dateIso(settlement.settledAt) + ', ' + Formatter.price(settlement.unexplainedAmount) + ' onverklaard, ' + settlement.syncFailureCount + ' mislukte pogingen)';
    };

    Email.sendWebmaster({
        subject: 'Uitbetalingen met problemen: ' + total,
        html: 'Deze uitbetalingen kloppen niet of konden niet gesynchroniseerd worden: <br><br>'
            + 'Onverklaard verschil:<br>' + (unexplained.map(describe).join('<br>') || 'geen') + '<br><br>'
            + 'Niet gesynchroniseerd:<br>' + (unsynced.map(describe).join('<br>') || 'geen'),
    });
}
