/**
 * Counts every night what the retention terms would anonymize or delete. It does not change any data yet:
 * processing comes later, behind the data-retention-execute feature flag.
 */

import { DataRetentionRun, Platform } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';

import { TenantContext } from '../helpers/TenantContext.js';
import { DataRetentionCounter } from '../services/data-retention/DataRetentionCounter.js';
import { registerTenantCron } from './helpers/registerTenantCron.js';

/**
 * Each call only works for a short while, so other crons keep running. The run continues on the next call,
 * and on the next night when it does not finish before the window ends.
 */
const MAX_DURATION = 20 * 1000;

registerTenantCron('data-retention', () => runDataRetention());

function isInWindow(now: Date) {
    // Between 1 and 6 AM in Belgian time - except in development
    const hour = DateTime.fromJSDate(now, { zone: Formatter.timezone }).hour;
    return STAMHOOFD.environment === 'development' || (hour >= 1 && hour < 6);
}

function isSameDay(a: Date, b: Date) {
    return DateTime.fromJSDate(a, { zone: Formatter.timezone }).hasSame(
        DateTime.fromJSDate(b, { zone: Formatter.timezone }),
        'day',
    );
}

export async function runDataRetention(now = new Date()) {
    if (!isInWindow(now)) {
        return;
    }

    const platform = await Platform.getSharedStruct();
    if (!platform.config.featureFlags.includes('data-retention')) {
        return;
    }

    const run = await DataRetentionRun.getOrCreate(TenantContext.currentOrRoot.tenantId);
    if (!run.phase && run.finishedAt && isSameDay(run.finishedAt, now)) {
        return;
    }

    await DataRetentionCounter.continueRun(run, { deadline: new Date(Date.now() + MAX_DURATION) });
}
