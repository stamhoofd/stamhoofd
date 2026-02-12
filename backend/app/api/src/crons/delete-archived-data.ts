/**
 * We cannot keep deletedAt data forever. We only keep it that way to debug things or be able to easily restore data.
 * After 1 month of deletion, we should delete it permanently.
 */

import { registerCron } from '@stamhoofd/crons';
import { Group } from '@stamhoofd/models';

let lastRunDate: number | null = null;
const keepDeletedDataForDays = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

registerCron('delete-archived-data', deleteArchivedData);

function shouldRun() {
    const now = new Date();

    if (now.getDate() === lastRunDate) {
        return false;
    }

    const hour = now.getHours();

    // between 4 and 5 AM - except in development
    if (hour !== 4 && STAMHOOFD.environment !== 'development') {
        return false;
    }

    return true;
}

async function deleteArchivedData() {
    if (!shouldRun()) {
        return;
    }

    const now = new Date();
    lastRunDate = now.getDate();

    console.log('Deleting archived data...');

    const result = await Group.delete()
        .where('deletedAt', '<', new Date(now.getTime() - keepDeletedDataForDays))
        .delete();
    console.log('Deleted groups:', result.affectedRows);

    // For now, we don't delete orders yet (can 'fuck' up pagination because deleted orders are still used in the frontend to remove cached orders)
}
