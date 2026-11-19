/**
 * Counts every night what the retention terms would anonymize or delete. It does not change any data yet:
 * processing comes later, behind the data-retention-execute feature flag.
 */

import { DataRetentionRun, Platform } from '@stamhoofd/models';

import { TenantContext } from '../helpers/TenantContext.js';
import { DataRetentionCounter } from '../services/data-retention/DataRetentionCounter.js';
import { registerTenantCron } from './helpers/registerTenantCron.js';

/**
 * Each call only works for a short while, so other crons keep running. The run continues on the next call,
 * and on the next night when it does not finish before the window ends.
 */
const MAX_DURATION = 20 * 1000;

registerTenantCron('data-retention', runDataRetention);

function isInWindow(now: Date) {
    // Between 1 and 6 AM - except in development
    const hour = now.getHours();
    return STAMHOOFD.environment === 'development' || (hour >= 1 && hour < 6);
}

export async function runDataRetention() {
    const now = new Date();
    if (!isInWindow(now)) {
        return;
    }

    const platform = await Platform.getSharedStruct();
    if (!platform.config.featureFlags.includes('data-retention')) {
        return;
    }

    const run = await DataRetentionRun.getOrCreate(TenantContext.currentOrRoot.tenantId);
    if (!run.phase && run.finishedAt && run.finishedAt.toDateString() === now.toDateString()) {
        return;
    }

    await DataRetentionCounter.continueRun(run, new Date(now.getTime() + MAX_DURATION));
}
