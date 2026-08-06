import { registerCron } from '@stamhoofd/crons';
import { syncStatistics, syncStatisticsDeletes } from '@stamhoofd/statistics/sync';

registerCron('syncPlatformStatistics', syncPlatformStatistics);
registerCron('reconcilePlatformStatisticsDeletes', reconcilePlatformStatisticsDeletes);

/**
 * The platforms the statistics sync runs for while it is being rolled out. The reports it feeds are
 * about units, takken and leiding, which only exist on a platform: an organization-mode deployment
 * has nothing to report on.
 */
export const statisticsPlatforms = ['keeo', 'ravot'];

export function isStatisticsSyncEnabled(): boolean {
    return STAMHOOFD.userMode === 'platform'
        && statisticsPlatforms.includes(STAMHOOFD.platformName)
        && !!STAMHOOFD.DB_STATISTICS_DATABASE;
}

/**
 * Crons are scheduled every 5 minutes, which is the incremental cadence: the job reads what changed
 * since its own watermark, so a skipped or overlapping run costs nothing.
 */
async function syncPlatformStatistics() {
    if (!isStatisticsSyncEnabled()) {
        return;
    }

    await syncStatistics();
}

let lastReconciliation: Date | null = null;

/**
 * Deletes are reconciled once a night: it walks every statistics table against its source, which is
 * far more work than an incremental pass and does not need to be current to the minute.
 */
async function reconcilePlatformStatisticsDeletes() {
    if (!isStatisticsSyncEnabled()) {
        return;
    }

    const hour = new Date().getHours();
    if (hour < 3 || hour > 5) {
        return;
    }

    if (lastReconciliation && lastReconciliation > new Date(Date.now() - 12 * 60 * 60 * 1000)) {
        return;
    }

    await syncStatisticsDeletes();
    lastReconciliation = new Date();
}
