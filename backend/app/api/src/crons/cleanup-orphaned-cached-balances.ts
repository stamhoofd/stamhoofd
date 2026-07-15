/**
 * Cached balances are only recalculated for objects that still have balance items. When all the
 * balance items of an object are moved or removed (for example when a member is merged into
 * another member), its cached balance is left behind. This cron cleans up those orphaned rows.
 */

import { registerCron } from '@stamhoofd/crons';
import { CachedBalance } from '@stamhoofd/models';

let lastRunDate: number | null = null;

registerCron('cleanupOrphanedCachedBalances', cleanupOrphanedCachedBalances);

function shouldRun() {
    const now = new Date();

    if (now.getDate() === lastRunDate) {
        return false;
    }

    const hour = now.getHours();

    // between 3 and 4 AM - except in development
    if (hour !== 3 && STAMHOOFD.environment !== 'development') {
        return false;
    }

    return true;
}

/**
 * Delete cached balances that no longer have any balance item attached to them.
 * Runs once a day between 3 and 4 AM.
 */
async function cleanupOrphanedCachedBalances() {
    if (!shouldRun()) {
        return;
    }

    lastRunDate = new Date().getDate();

    const deleted = await CachedBalance.deleteOrphaned();
    console.log(`Deleted ${deleted} orphaned cached balances.`);
}
