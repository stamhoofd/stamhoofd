/**
 * Every night: applies pending changes of the retention terms that started to apply, and counts what the terms would
 * anonymize or delete. It does not change any other data yet: processing comes later, behind the data-retention-execute feature flag.
 */

import { Email } from '@stamhoofd/email';
import { DataRetentionRun, Platform } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';

import { TenantContext } from '../helpers/TenantContext.js';
import { DataRetentionCounter } from '../services/data-retention/DataRetentionCounter.js';
import { DataRetentionPolicyService } from '../services/data-retention/DataRetentionPolicyService.js';
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

    const tenantId = TenantContext.currentOrRoot.tenantId;
    await DataRetentionPolicyService.applyDuePendingChanges(tenantId, now);

    const run = await DataRetentionRun.getOrCreate(tenantId);
    if (!run.phase && run.finishedAt && isSameDay(run.finishedAt, now)) {
        return;
    }

    if (run.phase && run.startedAt && !isSameDay(run.startedAt, now) && !run.delayReportedAt) {
        reportDelay(run, run.startedAt);
        run.delayReportedAt = now;
        await run.save();
    }

    await DataRetentionCounter.continueRun(run, { deadline: new Date(Date.now() + MAX_DURATION) });
}

/**
 * A run that keeps continuing would leave the overview on old numbers without anyone noticing, so the webmaster hears it once per run.
 */
function reportDelay(run: DataRetentionRun, startedAt: Date) {
    Email.sendWebmaster({
        subject: 'Telling bewaartermijnen niet afgerond in één nacht',
        text:
            'De telling van de bewaartermijnen (tenant ' +
            run.tenantId +
            ') startte op ' +
            Formatter.dateTime(startedAt) +
            ' en is nog niet klaar. Ze loopt nu verder bij ' +
            run.phase +
            ' (cursor ' +
            (run.cursor ?? 'begin') +
            ').\n\n' +
            'Het overzicht toont tot dan de laatste volledige telling. Blijft dit elke nacht gebeuren, dan past de telling niet meer in de nacht.',
    });
}
