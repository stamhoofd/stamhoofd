import type { Organization } from '@stamhoofd/models';
import { BalanceItem, BalanceItemPayment, Invoice, OrganizationFactory, Payment } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import type { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { BalanceItemStatus, BalanceItemType, PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
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

    const createExporter = (organization: Organization) => {
        return new SettlementExporter({
            start: new Date(2026, 0, 1),
            end: new Date(2026, 1, 1),
            organization,
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
            type: SettlementChargeType.Reserve,
            externalId: 'rsv_' + uuidv4(),
            amount: -10_00_00,
            settlementId: settlement.id,
            organizationId: settlement.organizationId,
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
            stamped: true,
            isSellingOrganization: false,
            transactionFees: 30_00,
            serviceFees: 0,
            accountFees: 0,
            vat: 6_30,
        });

        // The deducted application fees, still waiting for the invoice that bills them: grouped
        // per month until its number is stamped on them
        expect(totals).toContainEqual({
            invoicedBy: membershipOrganization.name,
            invoiceId: '2026-01',
            stamped: false,
            isSellingOrganization: true,
            transactionFees: 50_00,
            serviceFees: 1_00_00,
            accountFees: 0,
            vat: 0,
        });
    });

    test('application fees group per invoice once its number is stamped on them', async () => {
        const { organization, payment, settlement } = await createSettledPayment();

        await SettlementService.upsertCharge({
            type: SettlementChargeType.ApplicationFeeService,
            externalId: 'fee_' + uuidv4() + ':ApplicationFeeService',
            amount: -1_00_00,
            settlementId: settlement.id,
            paymentId: payment.id,
            organizationId: organization.id,
            providerInvoiceId: '2026042',
            occurredAt: new Date(2026, 0, 15),
        });

        const exporter = createExporter(organization);
        await exporter.build();

        expect(exporter.getProviderInvoiceTotals()).toContainEqual({
            invoicedBy: membershipOrganization.name,
            invoiceId: '2026042',
            stamped: true,
            isSellingOrganization: true,
            transactionFees: 0,
            serviceFees: 1_00_00,
            accountFees: 0,
            vat: 0,
        });
    });

    describe('the platform invoice check', () => {
        /**
         * The fee as the sync stores it: a deduction charge on the payer's payout with the
         * application fee row that says what we received for it.
         */
        const addFeeCharge = async (organization: Organization, settlement: Settlement | null, payment: Payment | null, providerInvoiceId: string | null, { amount = 1_00_00, occurredAt = new Date(2026, 0, 15) } = {}) => {
            const externalId = 'fee_' + uuidv4();
            const charge = await SettlementService.upsertCharge({
                type: SettlementChargeType.ApplicationFeeService,
                externalId: externalId + ':ApplicationFeeService',
                amount: -amount,
                applicationFeeId: externalId,
                ...(settlement ? { settlementId: settlement.id } : {}),
                ...(payment ? { paymentId: payment.id } : {}),
                organizationId: organization.id,
                ...(providerInvoiceId ? { providerInvoiceId } : {}),
                occurredAt,
            });

            const fee = new ApplicationFee();
            fee.externalId = externalId;
            fee.type = ApplicationFeeType.Service;
            fee.amount = amount;
            fee.organizationId = membershipOrganization.id;
            fee.payingOrganizationId = organization.id;
            fee.settlementChargeId = charge.id;
            fee.occurredAt = occurredAt;
            await fee.save();

            return fee;
        };

        /**
         * The invoice that bills those fees: one balance item for them, paid by one deduction
         * payment, invoiced next to whatever else the organization owed.
         */
        const billFees = async (organization: Organization, fees: ApplicationFee[], number: string, { billed, otherTotal = 0 }: { billed?: number; otherTotal?: number } = {}) => {
            const total = billed ?? fees.reduce((sum, fee) => sum + fee.amount, 0);

            const balanceItem = new BalanceItem();
            balanceItem.type = BalanceItemType.ServiceFee;
            balanceItem.organizationId = membershipOrganization.id;
            balanceItem.payingOrganizationId = organization.id;
            balanceItem.unitPrice = total;
            balanceItem.quantity = 1;
            balanceItem.status = BalanceItemStatus.Hidden;
            await balanceItem.save();

            for (const fee of fees) {
                fee.balanceItemId = balanceItem.id;
                await fee.save();
            }

            const invoice = new Invoice();
            invoice.organizationId = membershipOrganization.id;
            invoice.payingOrganizationId = organization.id;
            invoice.number = number;
            invoice.totalWithVAT = total + otherTotal;
            await invoice.save();

            const feePayment = new Payment();
            feePayment.organizationId = membershipOrganization.id;
            feePayment.payingOrganizationId = organization.id;
            feePayment.method = PaymentMethod.AccountDeductions;
            feePayment.provider = PaymentProvider.Stripe;
            feePayment.status = PaymentStatus.Succeeded;
            feePayment.price = total;
            feePayment.invoiceId = invoice.id;
            await feePayment.save();

            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = feePayment.id;
            balanceItemPayment.organizationId = membershipOrganization.id;
            balanceItemPayment.price = total;
            await balanceItemPayment.save();

            if (otherTotal !== 0) {
                const other = new Payment();
                other.organizationId = membershipOrganization.id;
                other.payingOrganizationId = organization.id;
                other.method = PaymentMethod.Transfer;
                other.status = PaymentStatus.Succeeded;
                other.price = otherTotal;
                other.invoiceId = invoice.id;
                await other.save();
            }

            return invoice;
        };

        const buildStatus = async (organization: Organization, invoiceNumber: string) => {
            const exporter = createExporter(organization);
            await exporter.build();
            const totals = exporter.getProviderInvoiceTotals().find(t => t.invoiceId === invoiceNumber)!;
            return await exporter.getProviderInvoiceStatus(totals);
        };

        test('an invoice that also bills something else still matches its fees', async () => {
            const { organization, payment, settlement } = await createSettledPayment();
            const number = uuidv4();
            const fee = await addFeeCharge(organization, settlement, payment, number);
            await billFees(organization, [fee], number, { otherTotal: 250_00_00 });

            expect(await buildStatus(organization, number)).toMatchObject({ check: '✓', outsideExport: 0 });
        });

        test('an invoice that bills less than was charged does not match', async () => {
            const { organization, payment, settlement } = await createSettledPayment();
            const number = uuidv4();
            const fee = await addFeeCharge(organization, settlement, payment, number, { amount: 1_00_00 });
            await billFees(organization, [fee], number, { billed: 60_00 });

            expect(await buildStatus(organization, number)).toMatchObject({ check: 'Nog niet (volledig) gefactureerd' });
        });

        test('charges outside the exported range still count towards the invoice', async () => {
            const { organization, payment, settlement } = await createSettledPayment();
            const number = uuidv4();
            const inRange = await addFeeCharge(organization, settlement, payment, number, { amount: 1_00_00 });

            // A charge of the same invoice in a month this export doesn't cover
            const outside = await addFeeCharge(organization, null, null, number, { amount: 40_00, occurredAt: new Date(2026, 5, 15) });
            await billFees(organization, [inRange, outside], number);

            expect(await buildStatus(organization, number)).toMatchObject({ check: '✓', outsideExport: 40_00 });
        });

        test('fees without an invoice number are not billed yet', async () => {
            const { organization, payment, settlement } = await createSettledPayment();
            await addFeeCharge(organization, settlement, payment, null);

            const exporter = createExporter(organization);
            await exporter.build();
            const totals = exporter.getProviderInvoiceTotals().find(t => t.isSellingOrganization)!;

            expect(await exporter.getProviderInvoiceStatus(totals)).toMatchObject({
                check: 'Nog niet (volledig) gefactureerd',
                outsideExport: null,
            });
        });

        test('the provider\'s own invoices carry no verdict', async () => {
            const { organization } = await createSettledPayment();
            const exporter = createExporter(organization);
            await exporter.build();
            const totals = exporter.getProviderInvoiceTotals().find(t => t.invoiceId === 'inv_123')!;

            expect((await exporter.getProviderInvoiceStatus(totals)).check).toBe('');
        });
    });

    describe('getSettlementCheck', () => {
        const check = (settlement: { amount: number; pendingFees?: number; uncollectibleFees?: number }, rows: { linesTotal: number; chargesTotal: number }) => {
            return SettlementExporter.getSettlementCheck({ pendingFees: 0, uncollectibleFees: 0, ...settlement } as Settlement, rows);
        };

        test('a payout its rows fully explain is approved', () => {
            expect(check({ amount: 49_70_00 }, { linesTotal: 50_00_00, chargesTotal: -30_00 })).toBe('✓');
        });

        test('a difference the stored rows do not cover is missing data', () => {
            expect(check({ amount: 49_70_00 }, { linesTotal: 50_00_00, chargesTotal: 0 })).toBe('Ontbrekende gegevens');
        });

        test('fees still waiting for their invoice explain the rest, and say so', () => {
            expect(check({ amount: 50_00_00, pendingFees: 30_00 }, { linesTotal: 49_70_00, chargesTotal: 0 })).toBe('Kosten nog niet gefactureerd');
        });

        test('fees that will never be invoiced explain the rest without waiting for one', () => {
            expect(check({ amount: 50_00_00, uncollectibleFees: 30_00 }, { linesTotal: 49_70_00, chargesTotal: 0 })).toBe('✓');
        });
    });
});
