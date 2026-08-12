import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import type { Organization, Token, User } from '@stamhoofd/models';
import { OrganizationFactory, Payment, Token as TokenModel, UserFactory } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentMethod, PaymentProvider, PaymentStatus, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { STExpect } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { initMembershipOrganization } from '../../../../../tests/init/initMembershipOrganization.js';
import { initPlatformAdmin } from '../../../../../tests/init/initPlatformAdmin.js';
import { SettlementService } from '../../../../services/SettlementService.js';
import { SettlementsExportEndpoint } from './SettlementsExportEndpoint.js';

describe('Endpoint.SettlementsExport', () => {
    const endpoint = new SettlementsExportEndpoint();

    let membershipOrganization: Organization;
    let admin: User;
    let adminToken: Token;

    beforeAll(async () => {
        membershipOrganization = await initMembershipOrganization();
        membershipOrganization.privateMeta.featureFlags = ['settlements'];
        await membershipOrganization.save();

        ({ admin, adminToken } = await initPlatformAdmin());
    });

    const createFinanceAdmin = async (organization: Organization) => {
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        return { user, token: await TokenModel.createToken(user) };
    };

    const post = async (organization: Organization, token: Token, { start = new Date(2026, 0, 1), end = new Date(2026, 1, 1) } = {}) => {
        const request = Request.buildJson('POST', '/settlements/export', organization.getApiHost(), {
            start: start.getTime(),
            end: end.getTime(),
        });
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    const createSettledPayment = async () => {
        const organization = await new OrganizationFactory({}).create();

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Mollie;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 50_00_00;
        payment.paidAt = new Date(2026, 0, 10);
        await payment.save();

        const settlement = await SettlementService.upsertSettlement({
            provider: PaymentProvider.Mollie,
            externalId: 'stl_' + uuidv4(),
            organizationId: organization.id,
            reference: '1234567.2601.01',
            amount: 49_63_70,
            settledAt: new Date(2026, 0, 15),
        });
        await SettlementService.upsertPaymentLine(settlement, {
            paymentId: payment.id,
            amount: 50_00_00,
            externalId: 'tr_' + uuidv4(),
            occurredAt: new Date(2026, 0, 15),
        });
        await SettlementService.upsertCharge({
            type: SettlementChargeType.ProviderTransactionFee,
            externalId: settlement.externalId + ':cost:0',
            amount: -30_00,
            settlementId: settlement.id,
            organizationId: settlement.organizationId,
            providerInvoiceId: 'inv_123',
            description: 'Transactiekosten',
            occurredAt: new Date(2026, 0, 15),
        });
        await SettlementService.upsertCharge({
            type: SettlementChargeType.Tax,
            externalId: settlement.externalId + ':cost:0:tax',
            amount: -6_30,
            settlementId: settlement.id,
            organizationId: settlement.organizationId,
            providerInvoiceId: 'inv_123',
            description: 'BTW op transactiekosten',
            occurredAt: new Date(2026, 0, 15),
        });
        await SettlementService.finishSync(settlement, { transactionCount: 3 });

        return { organization, payment, settlement };
    };

    test('A platform admin receives the report by email', async () => {
        await createSettledPayment();

        const response = await post(membershipOrganization, adminToken);
        expect(response.status).toBe(200);

        await QueueHandler.awaitAll();

        const emails = await EmailMocker.transactional.getSucceededEmails();
        const reportEmail = emails.find(e => e.subject.startsWith('Uitbetalingen export'));
        expect(reportEmail).toBeDefined();
        expect(reportEmail!.attachments).toHaveLength(1);
        expect(reportEmail!.attachments![0].filename).toContain('.xlsx');
        expect(reportEmail!.to).toContain(admin.email);
    });

    test('A user without finance access cannot export settlements', async () => {
        const user = await new UserFactory({ organization: membershipOrganization }).create();
        const token = await TokenModel.createToken(user);

        await expect(post(membershipOrganization, token)).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });

    test('A finance admin exports the settlements of their own organization', async () => {
        const { organization } = await createSettledPayment();
        organization.privateMeta.featureFlags = ['settlements'];
        await organization.save();

        const { user, token } = await createFinanceAdmin(organization);

        const response = await post(organization, token);
        expect(response.status).toBe(200);

        await QueueHandler.awaitAll();

        const emails = await EmailMocker.transactional.getSucceededEmails();
        const reportEmail = emails.filter(e => e.subject.startsWith('Uitbetalingen export')).at(-1);
        expect(reportEmail).toBeDefined();
        expect(reportEmail!.to).toContain(user.email);
    });

    test('Without the feature flag the export is not available', async () => {
        const organization = await new OrganizationFactory({}).create();
        const { token } = await createFinanceAdmin(organization);

        await expect(post(organization, token)).rejects.toThrow(
            STExpect.simpleError({ code: 'not_available' }),
        );
    });

    test('An unbounded range is rejected', async () => {
        await expect(post(membershipOrganization, adminToken, { start: new Date(2020, 0, 1), end: new Date(2026, 0, 1) })).rejects.toThrow(
            STExpect.simpleError({ code: 'range_too_large' }),
        );
    });
});
