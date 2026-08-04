import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, Payment } from '@stamhoofd/models';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { v4 as uuidv4 } from 'uuid';

import { initMembershipOrganization } from '../../tests/init/initMembershipOrganization.js';
import { SettlementService } from '../services/SettlementService.js';
import { SettlementExporter } from './SettlementExporter.js';

describe('SettlementExporter', () => {
    let membershipOrganization: Organization;

    beforeAll(async () => {
        membershipOrganization = await initMembershipOrganization();
    });

    /**
     * A fresh organization with one settled Mollie payment: a payout of 49,63 explained by a 50,00
     * payment line and Mollie's 0,30 + 0,063 VAT cost rows (invoice inv_123).
     */
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
            providerInvoiceId: 'inv_123',
            description: 'Transactiekosten',
            occurredAt: new Date(2026, 0, 15),
        });
        await SettlementService.upsertCharge({
            type: SettlementChargeType.Tax,
            externalId: settlement.externalId + ':cost:0:tax',
            amount: -6_30,
            settlementId: settlement.id,
            providerInvoiceId: 'inv_123',
            description: 'BTW op transactiekosten',
            occurredAt: new Date(2026, 0, 15),
        });
        await SettlementService.finishSync(settlement, { transactionCount: 3 });

        return { organization, payment, settlement };
    };

    const createExporter = (organization: Organization) => {
        return new SettlementExporter({
            start: new Date(2026, 0, 1),
            end: new Date(2026, 1, 1),
            organizationId: organization.id,
            sellingOrganization: membershipOrganization,
        });
    };

    test('only walks the settlements of the exported organization', async () => {
        const { organization } = await createSettledPayment();
        await createSettledPayment();

        const exporter = createExporter(organization);
        let count = 0;
        exporter.callback = () => count++;
        await exporter.build();

        expect(count).toBe(1);
    });

    test('a platform payout is included in its owning organization\'s export', async () => {
        // The platform's own payouts belong to the membership organization: there is no separate
        // platform-only mode, scoping to that organization is the platform export
        const owner = await new OrganizationFactory({}).create();
        const platformSettlement = await SettlementService.upsertSettlement({
            provider: PaymentProvider.Stripe,
            externalId: 'po_platform_' + uuidv4(),
            stripeAccountId: null,
            organizationId: owner.id,
            amount: 12_34_00,
            settledAt: new Date(2026, 0, 20),
        });
        await SettlementService.finishSync(platformSettlement, { transactionCount: 0 });
        await createSettledPayment();

        const exporter = createExporter(owner);
        let count = 0;
        exporter.callback = () => count++;
        await exporter.build();

        expect(count).toBe(1);
    });

    test('charges group into the invoice of the party that bills them', async () => {
        const { organization, payment, settlement } = await createSettledPayment();

        // Application fees the platform deducted: billed by the membership organization's monthly
        // fee invoice
        await SettlementService.upsertCharge({
            type: SettlementChargeType.ApplicationFeeService,
            externalId: 'fee_' + uuidv4() + ':ApplicationFeeService',
            amount: -1_00_00,
            settlementId: settlement.id,
            paymentId: payment.id,
            organizationId: organization.id,
            occurredAt: new Date(2026, 0, 15),
        });
        await SettlementService.upsertCharge({
            type: SettlementChargeType.ApplicationFeeTransfer,
            externalId: 'fee_' + uuidv4() + ':ApplicationFeeTransfer',
            amount: -50_00,
            settlementId: settlement.id,
            paymentId: payment.id,
            organizationId: organization.id,
            occurredAt: new Date(2026, 0, 15),
        });

        // Money movement: part of no invoice
        await SettlementService.upsertCharge({
            type: SettlementChargeType.Transfer,
            externalId: 'trf_' + uuidv4(),
            amount: -10_00_00,
            settlementId: settlement.id,
            occurredAt: new Date(2026, 0, 15),
        });

        const exporter = createExporter(organization);
        await exporter.build();

        const totals = exporter.getProviderInvoiceTotals();
        expect(totals).toHaveLength(2);

        // Mollie's own costs on its invoice document, with the VAT split out
        expect(totals).toContainEqual({
            invoicedBy: PaymentProvider.Mollie,
            invoiceId: 'inv_123',
            transactionFees: 30_00,
            serviceFees: 0,
            accountFees: 0,
            vat: 6_30,
        });

        // The deducted application fees on the platform's monthly fee invoice, as billed
        // (positive) amounts
        expect(totals).toContainEqual({
            invoicedBy: membershipOrganization.name,
            invoiceId: '2026-01',
            transactionFees: 50_00,
            serviceFees: 1_00_00,
            accountFees: 0,
            vat: 0,
        });
    });
});
