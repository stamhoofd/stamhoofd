import { registerCron } from '@stamhoofd/crons';
import { runStatisticsCycle } from './sync.js';

registerCron('syncPlatformStatistics', syncPlatformStatistics);

/**
 * Both passes read the whole administration, which is far more than the five-minute cron cadence is
 * meant for and does not need to be current to the minute: the reports they feed are read by day.
 */
export function shouldRunStatisticsSync({ now, lastRun }: { now: Date; lastRun: Date | null }): boolean {
    if (STAMHOOFD.environment === 'development') {
        return true;
    }

    if (lastRun === null) {
        // Run right away
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

    await runStatisticsCycle();

    lastRun = new Date();
}

/**
 * How the cron loop is started for this service.
 *
 * `allowReadOnly` is on because the syncer runs on a replica, whose MySQL is `read_only`. That flag
 * guards the main database, and this service never writes to it: it reads the administration and
 * writes through the separate connection to the statistics database, whose watermarks live in
 * `stats_sync_state` there. Switching it off stops the sync from ever running where it is deployed.
 */
export const statisticsCronOptions = { allowReadOnly: true, allowBeforeSeeds: true };
