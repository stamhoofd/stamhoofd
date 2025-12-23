import { registerCron } from '@stamhoofd/crons';
import { DocumentTemplate } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';

const lastRunDate: number | null = null;

registerCron('disableAutoUpdateDocuments', disableAutoUpdateDocuments);

function shouldRun() {
    const now = new Date();

    if (now.getDate() === lastRunDate) {
        return false;
    }

    const hour = now.getHours();

    // between 5 and 6 AM
    if (hour !== 5 && STAMHOOFD.environment !== 'development') {
        return false;
    }

    return true;
}

async function disableAutoUpdateDocuments() {
    if (!shouldRun()) {
        return;
    }

    const now = new Date();
    await disableAutoUpdateForFiscalDocuments(now);
    await disableAutoUpdateForOtherDocuments(now);
}

/**
 * Disable auto-update for fiscal documents on the 1st of March.
 * @returns if query was run
 */
export async function disableAutoUpdateForFiscalDocuments(now: Date): Promise<boolean> {
    // only run on 1st of march
    const isFirstOfMarch = now.getMonth() === 2 && now.getDate() === 1;
    if (!isFirstOfMarch) {
        return false;
    }

    // set updates enabled to false
    await SQL.update(DocumentTemplate.table).set('updatesEnabled', false)
        // where previous year
        .where('year', now.getFullYear() - 1)
        // where updates enabled
        .andWhere('updatesEnabled', true)
        // where type is fiscal
        .andWhere(SQL.jsonExtract(SQL.column('privateSettings'), '$.value.templateDefinition.type'), 'fiscal')
        .update();

    return true;
}

/**
 * Disable auto-update for documents, other then fiscal, that have been published 90 days ago.
 */
export async function disableAutoUpdateForOtherDocuments(now: Date) {
    const min = new Date(now);
    min.setDate(min.getDate() - 90);

    const max = new Date(now);
    max.setDate(max.getDate() - 89);

    // set updates enabled to false
    await SQL.update(DocumentTemplate.table).set('updatesEnabled', false)
        // where updates enabled
        .where('updatesEnabled', true)
        // where published 90 days ago
        .andWhere('publishedAt', '>=', min)
        .andWhere('publishedAt', '<', max)
        // where type is not fiscal
        .whereNot(SQL.jsonExtract(SQL.column('privateSettings'), '$.value.templateDefinition.type'), 'fiscal')
        .update();
}
