import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Token, User } from '@stamhoofd/models';
import { OrganizationFactory, Payment, Token as TokenModel, UserFactory } from '@stamhoofd/models';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';

import { StripeMocker } from '../../../../../tests/helpers/StripeMocker.js';
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
        const organization = await new OrganizationFactory({}).create();
        const payment = new Payment();
        payment.organizationId = organization.id;
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
