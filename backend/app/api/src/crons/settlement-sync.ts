// Nightly settlement sync for all providers. Everything is an upsert and synced payouts are
// skipped, so the windowed re-walk is cheap.
import { registerCron } from '@stamhoofd/crons';
import { Email } from '@stamhoofd/email';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentProvider } from '@stamhoofd/structures';
import { SettlementStatus } from '@stamhoofd/structures/settlements/SettlementStatus.js';
import { Formatter } from '@stamhoofd/utility';

import { SettlementSyncRunner } from '../helpers/SettlementSyncRunner.js';
import { isApplicationFeeInvoicingEnabled } from './stripe-invoices.js';

registerCron('settlement-sync', syncSettlements);

/**
 * How many days of settlements the nightly run re-walks.
 */
const SYNC_WINDOW_DAYS = 30;

/**
 * Fees received in a platform payout are billed by the monthly invoicer, so pendingFees taking a
 * while to reach 0 is normal. Older than this it means the invoicer failed or skipped something.
 */
const MAXIMUM_PENDING_FEES_AGE_MS = 31 * 24 * 60 * 60 * 1000;

let lastSettlementSync: Date | null = null;

/**
 * Exported for tests only.
 */
export async function syncSettlements() {
    if (STAMHOOFD.environment !== 'production') {
        return;
    }

    // Between 5 and 6 AM Brussels time.
    if (Formatter.luxon().hour !== 5) {
        return;
    }

    // Wait for the next day before doing a new sync
    const today = new Date();
    if (lastSettlementSync && Formatter.dateIso(lastSettlementSync) === Formatter.dateIso(today)) {
        console.log('Settlement sync done for this day');
        return;
    }

    console.log('Syncing settlements...');

    const start = new Date(today.getTime() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // The same queue as the manual backfill: the two never walk the same period at once, and a
    // shutdown aborts this run instead of waiting for the whole window. An aborted run throws, so
    // it is not remembered as the sync of this day: a later tick within the hour runs it again,
    // and otherwise the next day re-walks the same window anyway
    await QueueHandler.schedule('settlement-sync', async ({ abort }) => {
        const runner = new SettlementSyncRunner();
        await runner.run({
            start,
            providers: [PaymentProvider.Stripe, PaymentProvider.Mollie],
            stripe: { retryUnsynced: true },
            abort,
        });

        await reportProblemSettlements();
    });

    lastSettlementSync = new Date();
}

/**
 * Every unsynced settlement or non-zero delta is a real question to answer, not noise.
 *
 * Exported for tests only.
 */
export async function reportProblemSettlements() {
    // Only payouts that actually arrived: money that failed or was canceled holds no transactions
    // to reconcile
    const unexplained = await Settlement.select()
        .where('status', SettlementStatus.Paid)
        .where('unexplainedAmount', '!=', 0)
        .limit(50)
        .fetch();

    const unsynced = await Settlement.select()
        .where('status', SettlementStatus.Paid)
        .where('syncedAt', null)
        .limit(50)
        .fetch();

    // Fees only stop being pending once the invoicer bills them: while it is off, every platform
    // payout would be reported forever
    const stalePendingFees = isApplicationFeeInvoicingEnabled()
        ? await Settlement.select()
                .where('status', SettlementStatus.Paid)
                .where('pendingFees', '!=', 0)
                .where('settledAt', '<', new Date(Date.now() - MAXIMUM_PENDING_FEES_AGE_MS))
                .limit(50)
                .fetch()
        : [];

    if (unexplained.length === 0 && unsynced.length === 0 && stalePendingFees.length === 0) {
        return;
    }

    const total = new Set([...unexplained, ...unsynced, ...stalePendingFees].map(s => s.id)).size;

    const describe = (settlement: Settlement) => {
        return settlement.provider + ' ' + settlement.externalId + ' (' + Formatter.dateIso(settlement.settledAt) + ', ' + Formatter.price(settlement.unexplainedAmount) + ' onverklaard, ' + Formatter.price(settlement.pendingFees) + ' niet-gefactureerde kosten, ' + Formatter.price(settlement.uncollectibleFees) + ' niet-aanrekenbare kosten, ' + settlement.syncFailureCount + ' mislukte pogingen)';
    };

    Email.sendWebmaster({
        subject: 'Uitbetalingen met problemen: ' + total,
        html: 'Deze uitbetalingen kloppen niet of konden niet gesynchroniseerd worden: <br><br>'
            + 'Onverklaard verschil:<br>' + (unexplained.map(describe).join('<br>') || 'geen') + '<br><br>'
            + 'Niet gesynchroniseerd:<br>' + (unsynced.map(describe).join('<br>') || 'geen') + '<br><br>'
            + 'Kosten te lang niet gefactureerd:<br>' + (stalePendingFees.map(describe).join('<br>') || 'geen'),
    });
}
