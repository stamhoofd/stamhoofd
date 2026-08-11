// Nightly settlement sync for all providers. Everything is an upsert and synced payouts are
// skipped, so the windowed re-walk is cheap.
import { registerCron } from '@stamhoofd/crons';
import { Email } from '@stamhoofd/email';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { PaymentProvider } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { SettlementSyncRunner } from '../helpers/SettlementSyncRunner.js';

registerCron('settlement-sync', syncSettlements);

/**
 * How many days of settlements the nightly run re-walks.
 */
const SYNC_WINDOW_DAYS = 30;

let lastSettlementSync: Date | null = null;

async function syncSettlements() {
    if (STAMHOOFD.environment !== 'production') {
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

    const runner = new SettlementSyncRunner();
    await runner.run({
        start,
        providers: [PaymentProvider.Stripe, PaymentProvider.Mollie],
        stripe: { retryUnsynced: true },
    });

    await reportProblemSettlements();

    lastSettlementSync = new Date();
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
