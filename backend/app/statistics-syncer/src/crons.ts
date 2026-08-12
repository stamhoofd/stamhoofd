import { registerCron } from '@stamhoofd/crons';
import { syncStatistics, syncStatisticsDeletes } from './sync.js';

registerCron('syncPlatformStatistics', syncPlatformStatistics);

/**
 * Both passes read the whole administration, which is far more than the five-minute cron cadence is
 * meant for and does not need to be current to the minute: the reports they feed are read by day.
 */
export function shouldRunStatisticsSync({ now, lastRun }: { now: Date; lastRun: Date | null }): boolean {
    if (STAMHOOFD.environment === 'development') {
        return true;
    }

    const hour = now.getHours();
    if (hour < 3 || hour > 5) {
        return false;
    }

    return lastRun === null || lastRun.getTime() <= now.getTime() - 12 * 60 * 60 * 1000;
}

let lastRun: Date | null = null;

async function syncPlatformStatistics() {
    if (!shouldRunStatisticsSync({ now: new Date(), lastRun })) {
        return;
    }

    await syncStatistics();

    // After the incremental pass, never next to it: reconciling first would see a row the sync is
    // about to write back and one that was deleted since the sync read it as equally present,
    // leaving the deleted one behind for a full day.
    await syncStatisticsDeletes();

    lastRun = new Date();
}
