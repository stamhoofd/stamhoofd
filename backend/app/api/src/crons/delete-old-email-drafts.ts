import { registerCron } from '@stamhoofd/crons';
import { Email } from '@stamhoofd/models';
import { EmailStatus } from '@stamhoofd/structures';

let lastRunDate: number | null = null;

registerCron('deleteOldEmailDrafts', deleteOldEmailDrafts);

/**
 * Run every night at 5 AM.
 */
export async function deleteOldEmailDrafts() {
    const now = new Date();

    if (now.getDate() === lastRunDate) {
        return;
    }

    const hour = now.getHours();

    // between 5 and 6 AM
    if (hour !== 5 && STAMHOOFD.environment !== 'development') {
        return;
    }

    // Clear old email drafts older than 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const result = await Email.delete()
        .where('status', EmailStatus.Draft)
        .where('createdAt', '<', sevenDaysAgo)
        .where('updatedAt', '<', sevenDaysAgo)
        .where('sentAt', null);

    console.log(`Deleted ${result.affectedRows} old email drafts.`);

    lastRunDate = now.getDate();
}
