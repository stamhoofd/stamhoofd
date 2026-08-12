import type { Organization } from '@stamhoofd/models';
import { BalanceItem, BalanceItemPayment, Invoice, OrganizationFactory, Payment, StripeAccount } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { BalanceItemStatus, BalanceItemType, PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { v4 as uuidv4 } from 'uuid';

import { initMembershipOrganization } from '../../tests/init/initMembershipOrganization.js';
import { ApplicationFeeService, LEGACY_FEE_PAYMENT_REFERENCE_PREFIX } from './ApplicationFeeService.js';
import { SettlementService } from './SettlementService.js';

describe('ApplicationFeeService', () => {
    let membershipOrganization: Organization;

    // A month the legacy invoicer would have billed
    const occurredAt = new Date(2025, 2, 14);
    const legacyReference = LEGACY_FEE_PAYMENT_REFERENCE_PREFIX + '2025-03-01';

    beforeAll(async () => {
        membershipOrganization = await initMembershipOrganization();
    });

    beforeEach(() => {
        ApplicationFeeService.resetWarnings();
    });

    const init = async () => {
        const organization = await new OrganizationFactory({}).create();
        const stripeAccount = new StripeAccount();
        stripeAccount.organizationId = organization.id;
        stripeAccount.accountId = 'acct_' + uuidv4();
        await stripeAccount.save();
        return { organization, stripeAccount };
    };

    /**
     * The fee payment and balance items the legacy invoicer created for a month.
     */
    const createLegacyFeePayment = async (organization: Organization, stripeAccount: StripeAccount | null, { types = [BalanceItemType.ServiceFee, BalanceItemType.TransferFee], price = 2_50_00 } = {}) => {
        const payment = new Payment();
        payment.organizationId = membershipOrganization.id;
        payment.payingOrganizationId = organization.id;
        payment.stripeAccountId = stripeAccount?.id ?? null;
        payment.method = PaymentMethod.AccountDeductions;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Succeeded;
        payment.reference = legacyReference;
        payment.price = price;
        payment.paidAt = occurredAt;
        await payment.save();

        const balanceItems: BalanceItem[] = [];
        for (const type of types) {
            const item = new BalanceItem();
            item.type = type;
            item.organizationId = membershipOrganization.id;
            item.payingOrganizationId = organization.id;
            item.unitPrice = price;
            item.quantity = 1;
            item.status = BalanceItemStatus.Hidden;
            await item.save();
            balanceItems.push(item);

            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = item.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = membershipOrganization.id;
            balanceItemPayment.price = price;
            await balanceItemPayment.save();
        }

        return { payment, balanceItems };
    };

    const upsertFee = async (organization: Organization, stripeAccount: StripeAccount, { type = ApplicationFeeType.Service, amount = 30_00 } = {}) => {
        const externalId = 'fee_' + uuidv4();
        const charge = await SettlementService.upsertCharge({
            type: type === ApplicationFeeType.Service ? SettlementChargeType.ApplicationFeeService : SettlementChargeType.ApplicationFeeTransfer,
            externalId: externalId + ':' + type,
            amount: -amount,
            applicationFeeId: externalId,
            organizationId: organization.id,
            stripeAccountId: stripeAccount.id,
            occurredAt,
        });

        const fee = await ApplicationFeeService.upsertFee({
            externalId,
            type,
            amount,
            organizationId: membershipOrganization.id,
            payingOrganizationId: organization.id,
            payingStripeAccountId: stripeAccount.id,
            settlementChargeId: charge.id,
            occurredAt,
        });

        return { fee, charge };
    };

    describe('legacy linking', () => {
        test('a fee of a month the legacy invoicer billed is linked right away', async () => {
            const { organization, stripeAccount } = await init();
            const { balanceItems } = await createLegacyFeePayment(organization, stripeAccount);

            const { fee } = await upsertFee(organization, stripeAccount, { type: ApplicationFeeType.Service });
            const { fee: transferFee } = await upsertFee(organization, stripeAccount, { type: ApplicationFeeType.Transfer });

            expect(fee.balanceItemId).toBe(balanceItems.find(i => i.type === BalanceItemType.ServiceFee)!.id);
            expect(transferFee.balanceItemId).toBe(balanceItems.find(i => i.type === BalanceItemType.TransferFee)!.id);
        });

        test('legacy payments without a Stripe account are found too', async () => {
            const { organization, stripeAccount } = await init();
            const { balanceItems } = await createLegacyFeePayment(organization, null);

            const { fee } = await upsertFee(organization, stripeAccount);

            expect(fee.balanceItemId).toBe(balanceItems.find(i => i.type === BalanceItemType.ServiceFee)!.id);
        });

        test('a month that was never billed stays uninvoiced', async () => {
            const { organization, stripeAccount } = await init();

            const { fee } = await upsertFee(organization, stripeAccount);

            expect(fee.balanceItemId).toBeNull();
        });

        test('a legacy payment without the matching balance item leaves the fee uninvoiced', async () => {
            const { organization, stripeAccount } = await init();
            await createLegacyFeePayment(organization, stripeAccount, { types: [BalanceItemType.ServiceFee] });

            const { fee } = await upsertFee(organization, stripeAccount, { type: ApplicationFeeType.Transfer });

            expect(fee.balanceItemId).toBeNull();
        });

        test('re-storing the same fee links it as soon as the legacy payment exists', async () => {
            const { organization, stripeAccount } = await init();
            const externalId = 'fee_' + uuidv4();
            const charge = await SettlementService.upsertCharge({
                type: SettlementChargeType.ApplicationFeeService,
                externalId: externalId + ':' + ApplicationFeeType.Service,
                amount: -30_00,
                applicationFeeId: externalId,
                organizationId: organization.id,
                occurredAt,
            });

            const data = {
                externalId,
                type: ApplicationFeeType.Service,
                amount: 30_00,
                organizationId: membershipOrganization.id,
                payingOrganizationId: organization.id,
                payingStripeAccountId: stripeAccount.id,
                settlementChargeId: charge.id,
                occurredAt,
            };

            const unlinked = await ApplicationFeeService.upsertFee(data);
            expect(unlinked.balanceItemId).toBeNull();

            const { balanceItems } = await createLegacyFeePayment(organization, stripeAccount);
            const linked = await ApplicationFeeService.upsertFee(data);

            expect(linked.id).toBe(unlinked.id);
            expect(linked.balanceItemId).toBe(balanceItems.find(i => i.type === BalanceItemType.ServiceFee)!.id);
        });
    });

    describe('providerInvoiceId', () => {
        const createInvoice = async (payment: Payment, number: string | null) => {
            const invoice = new Invoice();
            invoice.organizationId = membershipOrganization.id;
            invoice.payingOrganizationId = payment.payingOrganizationId;
            invoice.number = number;
            invoice.totalWithVAT = payment.price;
            await invoice.save();

            payment.invoiceId = invoice.id;
            await payment.save();
            return invoice;
        };

        test('the invoice number is stamped on the deduction charge when the fee is linked', async () => {
            const { organization, stripeAccount } = await init();
            const { payment } = await createLegacyFeePayment(organization, stripeAccount);
            await createInvoice(payment, '2025001');

            const { charge } = await upsertFee(organization, stripeAccount);

            expect((await SettlementCharge.getByID(charge.id))!.providerInvoiceId).toBe('2025001');
        });

        test('a draft invoice has no number to stamp yet', async () => {
            const { organization, stripeAccount } = await init();
            const { payment } = await createLegacyFeePayment(organization, stripeAccount);
            await createInvoice(payment, null);

            const { charge } = await upsertFee(organization, stripeAccount);

            expect((await SettlementCharge.getByID(charge.id))!.providerInvoiceId).toBeNull();
        });

        test('stampInvoicedPayments stamps and clears the charges of an invoice', async () => {
            const { organization, stripeAccount } = await init();
            const { payment } = await createLegacyFeePayment(organization, stripeAccount);
            const { charge, fee } = await upsertFee(organization, stripeAccount);
            expect(fee.balanceItemId).not.toBeNull();

            const invoice = await createInvoice(payment, '2025042');
            await ApplicationFeeService.stampInvoicedPayments([payment], invoice);
            expect((await SettlementCharge.getByID(charge.id))!.providerInvoiceId).toBe('2025042');

            await ApplicationFeeService.stampInvoicedPayments([payment], null);
            expect((await SettlementCharge.getByID(charge.id))!.providerInvoiceId).toBeNull();
        });

        test('an invoice without application fees is a no-op', async () => {
            const { organization } = await init();
            const payment = new Payment();
            payment.organizationId = membershipOrganization.id;
            payment.payingOrganizationId = organization.id;
            payment.method = PaymentMethod.Transfer;
            payment.status = PaymentStatus.Succeeded;
            payment.price = 10_00;
            await payment.save();

            await expect(ApplicationFeeService.stampInvoicedPayments([payment], null)).resolves.toBeUndefined();
        });
    });

    test('upserting the same fee twice keeps one row', async () => {
        const { organization, stripeAccount } = await init();
        const { fee } = await upsertFee(organization, stripeAccount);

        const again = await ApplicationFeeService.upsertFee({
            externalId: fee.externalId,
            type: fee.type,
            amount: 35_00,
            organizationId: membershipOrganization.id,
            payingOrganizationId: organization.id,
            payingStripeAccountId: stripeAccount.id,
            settlementChargeId: fee.settlementChargeId,
            occurredAt,
        });

        expect(again.id).toBe(fee.id);
        expect(again.amount).toBe(35_00);
        expect(await ApplicationFee.select().where('externalId', fee.externalId).count()).toBe(1);
    });
});
