import type { Organization, StripeAccount } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, OrganizationFactory, Payment } from '@stamhoofd/models';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { BalanceItemStatus, BalanceItemType, PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { v4 as uuidv4 } from 'uuid';

import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import { SettlementService } from '../services/SettlementService.js';
import { StripeFeeInvoiceBackfill } from './StripeFeeInvoiceBackfill.js';

describe('StripeFeeInvoiceBackfill', () => {
    const stripeMocker = new StripeMocker();
    let sellingOrganization: Organization;

    const month = new Date(2026, 0, 1);

    beforeAll(async () => {
        sellingOrganization = await new OrganizationFactory({}).create();
    });

    const init = async () => {
        const organization = await new OrganizationFactory({}).create();
        const stripeAccount = await stripeMocker.createStripeAccount(organization.id);
        return { organization, stripeAccount };
    };

    /**
     * The Received rows the fee sync would have stored for this month.
     */
    const createReceivedRows = async (stripeAccount: StripeAccount, { serviceFee = 30_00, transferFee = 2_20_00 } = {}) => {
        const applicationFeeId = 'fee_' + uuidv4();
        const rows: SettlementCharge[] = [];

        for (const [type, amount] of [
            [SettlementChargeType.ReceivedApplicationFeeService, serviceFee],
            [SettlementChargeType.ReceivedApplicationFeeTransfer, transferFee],
        ] as const) {
            if (amount === 0) {
                continue;
            }
            rows.push(await SettlementService.upsertCharge({
                type,
                externalId: applicationFeeId + ':' + type,
                amount,
                applicationFeeId,
                organizationId: stripeAccount.organizationId,
                stripeAccountId: stripeAccount.id,
                occurredAt: new Date(2026, 0, 15),
            }));
        }
        return rows;
    };

    /**
     * The fee payment + balance items the old invoicer created for this month.
     */
    const createInvoicedPayment = async (organization: Organization, stripeAccount: StripeAccount, { serviceFee = 30_00, transferFee = 2_20_00, stripeAccountId = stripeAccount.id as string | null } = {}) => {
        const items = [] as { type: BalanceItemType; price: number }[];
        if (serviceFee !== 0) {
            items.push({ type: BalanceItemType.ServiceFee, price: serviceFee });
        }
        if (transferFee !== 0) {
            items.push({ type: BalanceItemType.TransferFee, price: transferFee });
        }

        const payment = new Payment();
        payment.organizationId = sellingOrganization.id;
        payment.payingOrganizationId = organization.id;
        payment.stripeAccountId = stripeAccountId;
        payment.reference = 'stripe-fees-2026-01-01';
        payment.method = PaymentMethod.AccountDeductions;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Succeeded;
        payment.price = items.reduce((total, item) => total + item.price, 0);
        payment.paidAt = new Date(2026, 0, 31);
        await payment.save();

        const balanceItems = [] as { type: BalanceItemType; id: string }[];
        for (const item of items) {
            const balanceItem = await new BalanceItemFactory({
                organizationId: sellingOrganization.id,
                payingOrganizationId: organization.id,
                type: item.type,
                amount: 1,
                unitPrice: item.price,
                status: BalanceItemStatus.Hidden,
            }).create();

            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = sellingOrganization.id;
            balanceItemPayment.price = item.price;
            await balanceItemPayment.save();

            balanceItems.push({ type: item.type, id: balanceItem.id });
        }

        return { payment, balanceItems };
    };

    const reload = async (rows: SettlementCharge[]) => {
        return await Promise.all(rows.map(async row => (await SettlementCharge.getByID(row.id))!));
    };

    test('service rows get the ServiceFee item, transfer rows the TransferFee item', async () => {
        const { organization, stripeAccount } = await init();
        const rows = await createReceivedRows(stripeAccount);
        const { balanceItems } = await createInvoicedPayment(organization, stripeAccount);

        await StripeFeeInvoiceBackfill.backfillMonth(sellingOrganization, month);

        const [serviceRow, transferRow] = await reload(rows);
        expect(serviceRow.balanceItemId).toBe(balanceItems.find(i => i.type === BalanceItemType.ServiceFee)!.id);
        expect(transferRow.balanceItemId).toBe(balanceItems.find(i => i.type === BalanceItemType.TransferFee)!.id);

        // Idempotent
        await StripeFeeInvoiceBackfill.backfillMonth(sellingOrganization, month);
        expect((await reload(rows))[0].balanceItemId).toBe(serviceRow.balanceItemId);
    });

    test('a legacy fee payment without stripeAccountId is still found', async () => {
        const { organization, stripeAccount } = await init();
        const rows = await createReceivedRows(stripeAccount);
        const { balanceItems } = await createInvoicedPayment(organization, stripeAccount, { stripeAccountId: null });

        await StripeFeeInvoiceBackfill.backfillMonth(sellingOrganization, month);

        const [serviceRow] = await reload(rows);
        expect(serviceRow.balanceItemId).toBe(balanceItems.find(i => i.type === BalanceItemType.ServiceFee)!.id);
    });

    test('a sum mismatch marks nothing as invoiced', async () => {
        const { organization, stripeAccount } = await init();
        const rows = await createReceivedRows(stripeAccount, { serviceFee: 30_00, transferFee: 2_20_00 });

        // The invoicer charged a different amount than the stored rows sum to
        await createInvoicedPayment(organization, stripeAccount, { serviceFee: 40_00, transferFee: 2_20_00 });

        // The counters are global over the shared test database, so only this test's rows are asserted
        await StripeFeeInvoiceBackfill.backfillMonth(sellingOrganization, month);

        for (const row of await reload(rows)) {
            expect(row.balanceItemId).toBeNull();
        }
    });

    test('a matching total with a different service/transfer split marks nothing as invoiced', async () => {
        const { organization, stripeAccount } = await init();
        const rows = await createReceivedRows(stripeAccount, { serviceFee: 40_00, transferFee: 2_10_00 });

        // Same total, different split
        await createInvoicedPayment(organization, stripeAccount, { serviceFee: 30_00, transferFee: 2_20_00 });

        await StripeFeeInvoiceBackfill.backfillMonth(sellingOrganization, month);

        for (const row of await reload(rows)) {
            expect(row.balanceItemId).toBeNull();
        }
    });

    test('a month that was never invoiced waits', async () => {
        const { stripeAccount } = await init();
        const rows = await createReceivedRows(stripeAccount);

        await StripeFeeInvoiceBackfill.backfillMonth(sellingOrganization, month);

        for (const row of await reload(rows)) {
            expect(row.balanceItemId).toBeNull();
        }
    });
});
