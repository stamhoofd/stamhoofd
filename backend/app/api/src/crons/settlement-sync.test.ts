import { EmailMocker } from '@stamhoofd/email';
import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentProvider } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { vi } from 'vitest';

import { SettlementSyncRunner } from '../helpers/SettlementSyncRunner.js';
import { SettlementService } from '../services/SettlementService.js';
import { reportProblemSettlements, syncSettlements } from './settlement-sync.js';

describe('Cron.settlement-sync', () => {
    let organization: Organization;

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();
    });

    const createUnsyncedSettlement = async (failureCount: number) => {
        const settlement = await SettlementService.upsertSettlement({
            provider: PaymentProvider.Stripe,
            externalId: 'po_' + uuidv4(),
            organizationId: organization.id,
            amount: 100_00_00,
            settledAt: new Date(1990, 0, 5),
        });
        for (let i = 0; i < failureCount; i++) {
            await SettlementService.markSyncFailed(settlement);
        }
        return settlement;
    };

    test('problem settlements are reported to the webmaster', async () => {
        await createUnsyncedSettlement(5);

        await reportProblemSettlements();

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails.find(e => e.subject.startsWith('Uitbetalingen met problemen'))).toBeDefined();
    });

    describe('The nightly run', () => {
        /**
         * The run only starts between 5 and 6 AM Brussels time, and remembers the day it ran: every
         * test needs its own day.
         */
        const arriveAt5AM = (dayOfMarch: number) => {
            vi.setSystemTime(new Date(Date.UTC(2026, 2, dayOfMarch, 4, 30)));
        };

        beforeEach(() => {
            TestUtils.setEnvironment('environment', 'production');
            vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
        });

        afterEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        test('runs on the same queue as the manual sync, and only once a day', async () => {
            arriveAt5AM(10);

            const runs: string[][] = [];
            vi.spyOn(SettlementSyncRunner.prototype, 'run').mockImplementation(async () => {
                // Nested in the queue of the manual sync, so the two never walk at once
                runs.push(QueueHandler.asyncLocalStorage.getStore() ?? []);
                return { feeMonths: 0, failedFeeMonths: 0, synced: 0, skipped: 0, failed: 0 };
            });

            await syncSettlements();
            await syncSettlements();

            expect(runs).toEqual([['settlement-sync']]);
        });

        test('an interrupted run is not remembered as the sync of this day', async () => {
            arriveAt5AM(11);

            const spy = vi.spyOn(SettlementSyncRunner.prototype, 'run').mockImplementation(async ({ abort } = {}) => {
                abort?.abort();
                abort?.throwIfAborted();
                return { feeMonths: 0, failedFeeMonths: 0, synced: 0, skipped: 0, failed: 0 };
            });

            await expect(syncSettlements()).rejects.toThrow(STExpect.simpleError({ code: 'queue-aborted' }));

            // A restart may not skip the sync of this day: the next tick starts over
            spy.mockResolvedValue({ feeMonths: 0, failedFeeMonths: 0, synced: 0, skipped: 0, failed: 0 });
            await syncSettlements();

            expect(spy).toHaveBeenCalledTimes(2);
        });
    });
});
