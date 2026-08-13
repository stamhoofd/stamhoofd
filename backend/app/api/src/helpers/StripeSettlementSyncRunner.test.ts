import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory } from '@stamhoofd/models';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { AbortSignal } from '@stamhoofd/queues';
import { PaymentProvider } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';

import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import { SettlementService } from '../services/SettlementService.js';
import { StripeSettlementSyncRunner } from './StripeSettlementSyncRunner.js';

describe('Helper.StripeSettlementSyncRunner', () => {
    const stripeMocker = new StripeMocker();
    let organization: Organization;

    beforeAll(async () => {
        stripeMocker.start();
        organization = await new OrganizationFactory({}).create();
    });

    afterAll(() => {
        stripeMocker.stop();
    });

    // Old dates that no other test uses, so the settledAt window only selects this test's rows
    const settledAt = new Date(1990, 0, 5);
    const windowStart = new Date(1990, 1, 1);

    const createUnsyncedSettlement = async (failureCount: number) => {
        const settlement = await SettlementService.upsertSettlement({
            provider: PaymentProvider.Stripe,
            externalId: 'po_' + uuidv4(),
            organizationId: organization.id,
            amount: 100_00_00,
            settledAt,
        });
        for (let i = 0; i < failureCount; i++) {
            await SettlementService.markSyncFailed(settlement);
        }
        return settlement;
    };

    const retry = async () => {
        const runner = new StripeSettlementSyncRunner({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });
        await runner.retryUnsyncedSettlements({ windowStart });
    };

    test('a retry that cannot retrieve the payout anymore still counts towards the cap', async () => {
        const settlement = await createUnsyncedSettlement(1);

        // The mocker has no payout with this id: the retrieve fails with a 404
        await retry();

        const fresh = await Settlement.getByID(settlement.id);
        expect(fresh!.syncFailureCount).toBe(2);
        expect(fresh!.syncedAt).toBeNull();
    });

    test('a settlement at the failure cap is not retried anymore', async () => {
        const settlement = await createUnsyncedSettlement(5);

        await retry();

        const fresh = await Settlement.getByID(settlement.id);
        expect(fresh!.syncFailureCount).toBe(5);
    });

    test('an interrupted retry does not count towards the cap', async () => {
        const settlement = await createUnsyncedSettlement(1);

        const abort = new AbortSignal();
        abort.abort();

        const runner = new StripeSettlementSyncRunner({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });
        await expect(runner.retryUnsyncedSettlements({ windowStart, abort })).rejects.toThrow(
            STExpect.simpleError({ code: 'queue-aborted' }),
        );

        // A restart is not an attempt: the payout is still waiting for a real one
        const fresh = await Settlement.getByID(settlement.id);
        expect(fresh!.syncFailureCount).toBe(1);
    });
});
