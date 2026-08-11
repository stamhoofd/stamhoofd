import { EmailMocker } from '@stamhoofd/email';
import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory } from '@stamhoofd/models';
import { PaymentProvider } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { SettlementService } from '../services/SettlementService.js';
import { reportProblemSettlements } from './settlement-sync.js';

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
});
