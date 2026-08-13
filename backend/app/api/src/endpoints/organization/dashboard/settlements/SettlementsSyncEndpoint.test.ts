import { Request } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import type { Organization, Token, User } from '@stamhoofd/models';
import { OrganizationFactory, Payment, Token as TokenModel, UserFactory } from '@stamhoofd/models';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import type { AbortSignal } from '@stamhoofd/queues';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import { vi } from 'vitest';

import { StripeMocker } from '../../../../../tests/helpers/StripeMocker.js';
import { SettlementSyncRunner } from '../../../../helpers/SettlementSyncRunner.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { initMembershipOrganization } from '../../../../../tests/init/initMembershipOrganization.js';
import { initPlatformAdmin } from '../../../../../tests/init/initPlatformAdmin.js';
import { GetSettlementsSyncStatusEndpoint } from './GetSettlementsSyncStatusEndpoint.js';
import { SettlementsSyncEndpoint } from './SettlementsSyncEndpoint.js';

describe('Endpoint.SettlementsSync', () => {
    const endpoint = new SettlementsSyncEndpoint();
    const statusEndpoint = new GetSettlementsSyncStatusEndpoint();
    const stripeMocker = new StripeMocker();

    let membershipOrganization: Organization;
    let admin: User;
    let adminToken: Token;

    beforeAll(async () => {
        membershipOrganization = await initMembershipOrganization();
        ({ admin, adminToken } = await initPlatformAdmin());
        stripeMocker.start();
    });

    afterAll(() => {
        stripeMocker.stop();
    });

    beforeEach(() => {
        stripeMocker.clear();
    });

    const post = async (organization: Organization, token: Token, body: Record<string, unknown> = {}) => {
        const request = Request.buildJson('POST', '/settlements/sync', organization.getApiHost(), {
            start: new Date(2026, 0, 1).getTime(),
            end: new Date(2026, 0, 31).getTime(),
            providers: [PaymentProvider.Stripe],
            ...body,
        });
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    const getStatus = async (organization: Organization, token: Token) => {
        const request = Request.buildJson('GET', '/settlements/sync/status', organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(statusEndpoint, request);
    };

    test('A platform admin can run the sync, which stores the payouts', async () => {
        // A payment on our own platform account: a connected organization's payment only passes
        // through our balance and is settled by its own payout
        const payment = new Payment();
        payment.organizationId = membershipOrganization.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 100_00_00;
        payment.paidAt = new Date(2026, 0, 15);
        await payment.save();

        const payout = stripeMocker.createPayout({ amount: 10000, arrivalDate: new Date(2026, 0, 20) });
        stripeMocker.createBalanceTransaction({
            type: 'charge',
            amount: 10000,
            created: new Date(2026, 0, 15),
            payout: payout.id,
            source: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }),
        });

        const response = await post(membershipOrganization, adminToken);
        expect(response.status).toBe(200);

        await QueueHandler.awaitAll();

        const settlement = await Settlement.select().where('externalId', payout.id).first(true);
        expect(settlement.syncedAt).not.toBeNull();
        expect(settlement.unexplainedAmount).toBe(0);

        // The queue is empty again
        const statusResponse = await getStatus(membershipOrganization, adminToken);
        expect(statusResponse.body).toEqual([]);
    });

    const shutdown = () => {
        QueueHandler.abortAll(new SimpleError({
            code: 'SHUTDOWN',
            message: 'Shutting down',
            statusCode: 503,
        }));
    };

    test('A sync that is canceled by a shutdown walks nothing and leaves no status behind', async () => {
        const payout = stripeMocker.createPayout({ amount: 10000, arrivalDate: new Date(2026, 0, 20) });
        stripeMocker.createBalanceTransaction({
            type: 'stripe_fee',
            amount: 10000,
            created: new Date(2026, 0, 15),
            payout: payout.id,
            source: null,
        });

        // Occupy the queue, so the sync is still waiting its turn when the shutdown aborts it
        let release = () => {};
        const occupied = QueueHandler.schedule('settlement-sync', async () => {
            await new Promise<void>((resolve) => {
                release = resolve;
            });
        });

        try {
            const response = await post(membershipOrganization, adminToken);
            expect(response.status).toBe(200);
            expect((await getStatus(membershipOrganization, adminToken)).body).toHaveLength(1);

            shutdown();
        } finally {
            release();
        }

        await occupied;
        await QueueHandler.awaitAll();

        expect(await Settlement.select().where('externalId', payout.id).count()).toBe(0);

        // The status list may not keep a sync that never ran
        expect((await getStatus(membershipOrganization, adminToken)).body).toEqual([]);
    });

    test('A shutdown interrupts a sync that is already walking', async () => {
        let running: AbortSignal | null = null;
        let stopWalking = () => {};

        const spy = vi.spyOn(SettlementSyncRunner.prototype, 'run').mockImplementation(async ({ abort } = {}) => {
            running = abort ?? null;

            // Walk until the shutdown asks us to stop
            await new Promise<void>((resolve) => {
                stopWalking = resolve;
                abort?.on('abort', () => resolve());
            });
            abort?.throwIfAborted();

            return { feeMonths: 0, failedFeeMonths: 0, synced: 0, skipped: 0, failed: 0 };
        });

        try {
            const response = await post(membershipOrganization, adminToken);
            expect(response.status).toBe(200);
            await vi.waitFor(() => expect(running).not.toBeNull());

            shutdown();
            await QueueHandler.awaitAll();
        } finally {
            // A failed assertion may not leave the walk (and the queue behind it) parked forever
            stopWalking();
            spy.mockRestore();
        }

        // The signal of the queue job reaches the runner, so the walk stops at its next safe point
        expect(running!.isAborted).toBe(true);
        expect((await getStatus(membershipOrganization, adminToken)).body).toEqual([]);
    });

    test('A user without platform full access cannot run the sync', async () => {
        const user = await new UserFactory({ organization: membershipOrganization }).create();
        const token = await TokenModel.createToken(user);

        await expect(post(membershipOrganization, token)).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
        await expect(getStatus(membershipOrganization, token)).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });

    test('The sync is not available for other organizations', async () => {
        const otherOrganization = await new OrganizationFactory({}).create();

        await expect(post(otherOrganization, adminToken)).rejects.toThrow(
            STExpect.simpleError({ code: 'not_available' }),
        );
    });
});
