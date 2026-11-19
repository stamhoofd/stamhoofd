import { registerCron } from '@stamhoofd/crons';
import { BelcotaxApiLog } from '@stamhoofd/models';

let lastRunDate: number | null = null;

registerCron('deleteOldBelcotaxApiLogs', deleteOldBelcotaxApiLogs);

/**
 * The user agreement with FOD Financiën asks to keep the log of authentications and API calls
 * for 12 months. The log names legal representatives, so it is not kept longer. Runs every night
 * between 4 and 5 AM.
 */
export async function deleteOldBelcotaxApiLogs() {
    const now = new Date();

    if (now.getDate() === lastRunDate) {
        return;
    }

    if (now.getHours() !== 4 && STAMHOOFD.environment !== 'development') {
        return;
    }

    const before = new Date(now);
    before.setFullYear(before.getFullYear() - 1);

    await BelcotaxApiLog.delete().where('createdAt', '<', before);

    lastRunDate = now.getDate();
}
