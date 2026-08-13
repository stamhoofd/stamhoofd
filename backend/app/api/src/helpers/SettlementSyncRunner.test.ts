import type { Organization } from '@stamhoofd/models';
import { MolliePayment, OrganizationFactory, Payment } from '@stamhoofd/models';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { AbortSignal } from '@stamhoofd/queues';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { vi } from 'vitest';

import type { MollieMockPayment } from '../../tests/helpers/MollieMocker.js';
import { MollieMocker } from '../../tests/helpers/MollieMocker.js';
import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import { initMembershipOrganization } from '../../tests/init/initMembershipOrganization.js';
import { SettlementService } from '../services/SettlementService.js';
import { SettlementSyncRunner } from './SettlementSyncRunner.js';
import { StripeSettlementSyncRunner } from './StripeSettlementSyncRunner.js';

describe('Helper.SettlementSyncRunner', () => {
    const stripeMocker = new StripeMocker();
    const mollieMocker = new MollieMocker();

    beforeAll(async () => {
        await initMembershipOrganization();
        stripeMocker.start();
        mollieMocker.start();
    });

    afterAll(() => {
        // Both mockers are nock-based and stop() clears every interceptor, so stopping one is
        // stopping both
        stripeMocker.stop();
    });

    const createStripePayment = async (organization: Organization) => {
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 100_00_00;
        payment.paidAt = new Date(2026, 0, 15);
        await payment.save();
        return payment;
    };

    const createMolliePayment = async (organization: Organization) => {
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Mollie;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 50_0000;
        payment.paidAt = new Date(2026, 0, 15);
        await payment.save();

        const mockPayment: MollieMockPayment = {
            id: mollieMocker.createId('tr'),
            status: 'paid',
            amount: { currency: 'EUR', value: '50.00' },
            internalPaymentId: payment.id,
            redirectUrl: null,
            sequenceType: 'oneoff',
            customerId: null,
            mandateId: null,
            isCancelable: false,
            details: null,
        };
        mollieMocker.payments.push(mockPayment);

        const link = new MolliePayment();
        link.paymentId = payment.id;
        link.mollieId = mockPayment.id;
        await link.save();

        return { payment, mockPayment };
    };

    test('One run syncs the settlements of both providers', async () => {
        // Stripe: a payment settled in a platform payout
        const organization = await new OrganizationFactory({}).create();
        const stripePayment = await createStripePayment(organization);

        const payout = stripeMocker.createPayout({ amount: 10000, arrivalDate: new Date(2026, 0, 20) });
        stripeMocker.createBalanceTransaction({
            type: 'charge',
            amount: 10000,
            created: new Date(2026, 0, 15),
            payout: payout.id,
            source: stripeMocker.createChargeObject({ metadata: { payment: stripePayment.id } }),
        });

        // Mollie: a payment settled in a settlement of an organization token
        const mollieOrganization = await new OrganizationFactory({}).create();
        await mollieMocker.setupToken(mollieOrganization);
        const { mockPayment } = await createMolliePayment(mollieOrganization);
        const mollieSettlement = mollieMocker.createSettlement({
            payments: [mockPayment],
            value: '50.00',
            settledAt: new Date(2026, 0, 20),
        });

        const runner = new SettlementSyncRunner();
        const summary = await runner.run({
            start: new Date(2026, 0, 1),
            end: new Date(2026, 0, 31),
            providers: [PaymentProvider.Stripe, PaymentProvider.Mollie],
        });

        const stripeRow = await Settlement.select().where('externalId', payout.id).first(true);
        expect(stripeRow.syncedAt).not.toBeNull();

        const mollieRow = await Settlement.select().where('externalId', mollieSettlement.id).first(true);
        expect(mollieRow.syncedAt).not.toBeNull();

        expect(summary.synced).toBeGreaterThanOrEqual(2);
    });

    test('A hard Stripe failure does not block the Mollie walk', async () => {
        const mollieOrganization = await new OrganizationFactory({}).create();
        await mollieMocker.setupToken(mollieOrganization);
        const { mockPayment } = await createMolliePayment(mollieOrganization);
        const mollieSettlement = mollieMocker.createSettlement({
            payments: [mockPayment],
            value: '50.00',
            settledAt: new Date(2026, 0, 20),
        });

        const spy = vi.spyOn(StripeSettlementSyncRunner.prototype, 'run').mockRejectedValue(new Error('Stripe is down'));
        try {
            const summary = await new SettlementSyncRunner().run({
                start: new Date(2026, 0, 1),
                end: new Date(2026, 0, 31),
                providers: [PaymentProvider.Stripe, PaymentProvider.Mollie],
            });
            expect(spy).toHaveBeenCalled();
            expect(summary.failed).toBeGreaterThanOrEqual(1);
        } finally {
            spy.mockRestore();
        }

        const mollieRow = await Settlement.select().where('externalId', mollieSettlement.id).first(true);
        expect(mollieRow.syncedAt).not.toBeNull();
    });

    test('An aborted run walks nothing and does not report a failure', async () => {
        const organization = await new OrganizationFactory({}).create();
        const stripePayment = await createStripePayment(organization);

        const payout = stripeMocker.createPayout({ amount: 10000, arrivalDate: new Date(2026, 0, 20) });
        stripeMocker.createBalanceTransaction({
            type: 'charge',
            amount: 10000,
            created: new Date(2026, 0, 15),
            payout: payout.id,
            source: stripeMocker.createChargeObject({ metadata: { payment: stripePayment.id } }),
        });

        const abort = new AbortSignal();
        abort.abort();

        // Throwing instead of returning a summary: a caller may not read an interrupted run as a
        // completed one
        await expect(new SettlementSyncRunner().run({
            start: new Date(2026, 0, 1),
            end: new Date(2026, 0, 31),
            providers: [PaymentProvider.Stripe, PaymentProvider.Mollie],
            abort,
        })).rejects.toThrow(STExpect.simpleError({ code: 'queue-aborted' }));

        expect(await Settlement.select().where('externalId', payout.id).first(false)).toBeNull();
    });

    test('The stripe retryUnsynced option flows through the run', async () => {
        const organization = await new OrganizationFactory({}).create();
        const settlement = await SettlementService.upsertSettlement({
            provider: PaymentProvider.Stripe,
            externalId: 'po_' + uuidv4(),
            organizationId: organization.id,
            amount: 100_00_00,
            settledAt: new Date(1991, 0, 5),
        });

        await new SettlementSyncRunner().run({
            start: new Date(2026, 0, 1),
            end: new Date(2026, 0, 31),
            providers: [PaymentProvider.Stripe],
            stripe: { retryUnsynced: true },
        });

        // The mocker has no payout with this id: the failed retry is counted on the settlement
        const fresh = await Settlement.getByID(settlement.id);
        expect(fresh!.syncFailureCount).toBe(1);
        expect(fresh!.syncedAt).toBeNull();
    });
});
