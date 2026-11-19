import {
    DataRetentionPolicy,
    DataRetentionRun,
    OrganizationFactory,
    Platform,
} from '@stamhoofd/models';
import { DataRetentionCategory, DataRetentionTerms } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';

import { TenantContext } from '../helpers/TenantContext.js';
import { runDataRetention } from './data-retention.js';

/**
 * In Belgian time. Tests run with TZ=UTC, so the edges of the night fall on another hour or day in UTC.
 */
function todayAt(hour: number, { minute = 0, days = 0 } = {}) {
    return DateTime.now()
        .setZone(Formatter.timezone)
        .plus({ days })
        .set({ hour, minute, second: 0, millisecond: 0 })
        .toJSDate();
}

async function setFeatureFlag(enabled: boolean) {
    const platform = await Platform.getForEditing();
    platform.config.featureFlags = platform.config.featureFlags.filter(
        (f) => f !== 'data-retention',
    );
    if (enabled) {
        platform.config.featureFlags.push('data-retention');
    }
    await platform.save();
}

async function getRun() {
    return await DataRetentionRun.select()
        .where('tenantId', TenantContext.currentOrRoot.tenantId)
        .first(false);
}

describe('cron.data-retention', () => {
    beforeEach(async () => {
        // In development, the cron also runs during the day
        TestUtils.setEnvironment('environment', 'production');
        await DataRetentionRun.delete();
        await setFeatureFlag(true);
    });

    afterAll(async () => {
        await setFeatureFlag(false);
    });

    test('It runs from 1 AM in Belgian time', async () => {
        await runDataRetention(todayAt(1));

        expect((await getRun())?.finishedAt).toBeInstanceOf(Date);
    });

    test('It does not run from 6 AM in Belgian time', async () => {
        await runDataRetention(todayAt(6));

        expect(await getRun()).toBeNull();
    });

    test('It does not run during the day', async () => {
        await runDataRetention(todayAt(12));

        expect(await getRun()).toBeNull();
    });

    test('It applies pending changes that started to apply', async () => {
        const organization = await new OrganizationFactory({}).create();
        const policy = new DataRetentionPolicy();
        policy.tenantId = TenantContext.currentOrRoot.tenantId;
        policy.organizationId = organization.id;
        policy.category = DataRetentionCategory.Orders;
        policy.anonymizeAfterMonths = 60;
        policy.setPendingTerms({
            terms: DataRetentionTerms.create({ anonymizeAfterMonths: 24 }),
            from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
        await policy.save();

        await runDataRetention(todayAt(2));

        const reloaded = (await DataRetentionPolicy.getByID(policy.id))!;
        expect(reloaded.anonymizeAfterMonths).toBe(24);
        expect(reloaded.pendingFrom).toBeNull();
    });

    test('It does not run without the feature flag', async () => {
        await setFeatureFlag(false);

        await runDataRetention(todayAt(2));

        expect(await getRun()).toBeNull();
    });

    test('It does not start a new run on a day it already finished one', async () => {
        await runDataRetention(todayAt(2));
        const run = (await getRun())!;
        // Still the previous day in UTC
        run.finishedAt = todayAt(0, { minute: 30 });
        await run.save();

        await runDataRetention(todayAt(3));

        expect((await getRun())?.finishedAt).toEqual(todayAt(0, { minute: 30 }));
    });

    test('It starts a new run when the last one finished on an earlier day', async () => {
        await runDataRetention(todayAt(2));
        const run = (await getRun())!;
        run.finishedAt = todayAt(1, { days: -1 });
        await run.save();

        await runDataRetention(todayAt(3));

        expect((await getRun())?.finishedAt).not.toEqual(todayAt(1, { days: -1 }));
    });
});
