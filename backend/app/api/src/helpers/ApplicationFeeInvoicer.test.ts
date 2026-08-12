import type { StripeAccount } from '@stamhoofd/models';
import { BalanceItem, BalanceItemPayment, Organization, OrganizationFactory, Payment } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import type { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { Address, BalanceItemType, Company, PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { Country } from '@stamhoofd/types/Country';
import { v4 as uuidv4 } from 'uuid';

import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import { initMembershipOrganization } from '../../tests/init/initMembershipOrganization.js';
import { ApplicationFeeService, LEGACY_FEE_PAYMENT_REFERENCE_PREFIX } from '../services/ApplicationFeeService.js';
import { SettlementService } from '../services/SettlementService.js';
import { ApplicationFeeInvoicer } from './ApplicationFeeInvoicer.js';

describe('ApplicationFeeInvoicer', () => {
    const stripeMocker = new StripeMocker();
    let membershipOrganization: Organization;

    // A month in the past that no other test writes fee rows in
    const month = new Date(2024, 6, 1);
    const occurredAt = new Date(2024, 6, 10);
    const reference = 'application-fees-2024-07-01';

    const belgianAddress = () => Address.create({
        street: 'Teststraat',
        number: '1',
        postalCode: '9000',
        city: 'Gent',
        country: Country.Belgium,
    });

    beforeAll(async () => {
        stripeMocker.start();

        membershipOrganization = await initMembershipOrganization();
        membershipOrganization.meta.companies = [
            Company.create({
                name: 'Platform BV',
                companyNumber: '0700000000',
                VATNumber: 'BE0700000000',
                address: belgianAddress(),
            }),
        ];
        await membershipOrganization.save();
    });

    afterAll(() => {
        stripeMocker.stop();
    });

    beforeEach(async () => {
        stripeMocker.clear();
        ApplicationFeeService.resetWarnings();

        // The test database persists across runs: leftover fees of this month would be billed again
        await ApplicationFee.delete()
            .where('occurredAt', '>=', month)
            .where('occurredAt', '<', new Date(2024, 7, 1));
    });

    const init = async () => {
        const organization = await new OrganizationFactory({}).create();
        organization.meta.companies = [
            Company.create({
                name: 'Testvereniging VZW ' + organization.id,
                companyNumber: '0500000000',
                VATNumber: 'BE0500000000',
                address: belgianAddress(),
            }),
        ];
        await organization.save();

        const stripeAccount = await stripeMocker.createStripeAccount(organization.id);
        return { organization, stripeAccount };
    };

    const createFee = async (organization: Organization, stripeAccount: StripeAccount, { type = ApplicationFeeType.Service, amount = 30_00, settlement = null as Settlement | null, when = occurredAt } = {}) => {
        const externalId = 'fee_' + uuidv4();
        const charge = await SettlementService.upsertCharge({
            type: type === ApplicationFeeType.Service ? SettlementChargeType.ApplicationFeeService : SettlementChargeType.ApplicationFeeTransfer,
            externalId: externalId + ':' + type,
            amount: -amount,
            applicationFeeId: externalId,
            organizationId: organization.id,
            stripeAccountId: stripeAccount.id,
            occurredAt: when,
        });

        return await ApplicationFeeService.upsertFee({
            externalId,
            type,
            amount,
            organizationId: membershipOrganization.id,
            payingOrganizationId: organization.id,
            payingStripeAccountId: stripeAccount.id,
            settlementChargeId: charge.id,
            settlementId: settlement?.id ?? null,
            occurredAt: when,
        });
    };

    const getFeePayments = async (organization: Organization) => {
        return await Payment.select()
            .where('payingOrganizationId', organization.id)
            .where('reference', reference)
            .where('method', PaymentMethod.AccountDeductions)
            .fetch();
    };

    const createInvoicer = () => new ApplicationFeeInvoicer({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });

    /**
     * Bills the month as if the run started a second from now: fees stored in the current second
     * are deliberately left for the next run, and a test stores them right before billing.
     */
    const invoiceMonth = async () => {
        await createInvoicer().generateInvoicesForMonth(membershipOrganization, month, new Date(Date.now() + 1000));
    };

    test('a month is billed per paying account, and every fee carries its balance item', async () => {
        const { organization, stripeAccount } = await init();
        const serviceFee = await createFee(organization, stripeAccount, { type: ApplicationFeeType.Service, amount: 30_00 });
        const transferFee = await createFee(organization, stripeAccount, { type: ApplicationFeeType.Transfer, amount: 2_20_00 });

        await invoiceMonth();

        const payments = await getFeePayments(organization);
        expect(payments).toHaveLength(1);
        expect(payments[0]).toMatchObject({
            price: 2_50_00,
            status: PaymentStatus.Succeeded,
            provider: PaymentProvider.Stripe,
            organizationId: membershipOrganization.id,
            stripeAccountId: stripeAccount.id,
        });

        const balanceItemPayments = await BalanceItemPayment.select().where('paymentId', payments[0].id).fetch();
        const balanceItems = await BalanceItem.select().where('id', balanceItemPayments.map(b => b.balanceItemId)).fetch();
        const serviceItem = balanceItems.find(i => i.type === BalanceItemType.ServiceFee)!;
        const transferItem = balanceItems.find(i => i.type === BalanceItemType.TransferFee)!;

        expect(serviceItem.unitPrice).toBe(30_00);
        expect(transferItem.unitPrice).toBe(2_20_00);
        expect(serviceItem.organizationId).toBe(membershipOrganization.id);
        expect(serviceItem.payingOrganizationId).toBe(organization.id);

        expect((await ApplicationFee.getByID(serviceFee.id))!.balanceItemId).toBe(serviceItem.id);
        expect((await ApplicationFee.getByID(transferFee.id))!.balanceItemId).toBe(transferItem.id);
    });

    test('fees of different accounts are billed separately', async () => {
        const { organization, stripeAccount } = await init();
        const second = await stripeMocker.createStripeAccount(organization.id);

        await createFee(organization, stripeAccount, { amount: 30_00 });
        await createFee(organization, second, { amount: 40_00 });

        await invoiceMonth();

        const payments = await getFeePayments(organization);
        expect(payments).toHaveLength(2);
        expect(payments.map(p => p.price).sort((a, b) => a - b)).toEqual([30_00, 40_00]);
        expect(payments.map(p => p.stripeAccountId).sort()).toEqual([stripeAccount.id, second.id].sort());
    });

    test('re-running bills nothing more', async () => {
        const { organization, stripeAccount } = await init();
        await createFee(organization, stripeAccount);

        await invoiceMonth();
        await invoiceMonth();

        expect(await getFeePayments(organization)).toHaveLength(1);
    });

    test('a fee that arrives after its month was billed lands in an extra payment', async () => {
        const { organization, stripeAccount } = await init();
        await createFee(organization, stripeAccount, { amount: 30_00 });

        await invoiceMonth();

        const late = await createFee(organization, stripeAccount, { amount: 5_00 });
        await invoiceMonth();

        const payments = await getFeePayments(organization);
        expect(payments).toHaveLength(2);
        expect(payments.map(p => p.price).sort((a, b) => a - b)).toEqual([5_00, 30_00]);
        expect((await ApplicationFee.getByID(late.id))!.balanceItemId).not.toBeNull();
    });

    test('the fee payment is settled by the payouts that contained its fees', async () => {
        const { organization, stripeAccount } = await init();
        const payout = await SettlementService.upsertSettlement({
            provider: PaymentProvider.Stripe,
            externalId: 'po_' + uuidv4(),
            stripeAccountId: null,
            organizationId: membershipOrganization.id,
            amount: 30_00,
            settledAt: new Date(2024, 6, 20),
        });
        await createFee(organization, stripeAccount, { amount: 30_00, settlement: payout });

        await invoiceMonth();

        const payment = (await getFeePayments(organization))[0];
        const lines = await PaymentSettlement.select().where('paymentId', payment.id).fetch();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ settlementId: payout.id, amount: 30_00 });

        // Completely paid out: the lines add up to the payment
        expect(lines.reduce((total, line) => total + line.amount, 0)).toBe(payment.price);
    });

    test('a month the legacy invoicer billed is never billed again', async () => {
        const { organization, stripeAccount } = await init();

        // A legacy payment without balance items: the inline linking can't reach it, so the fee
        // stays uninvoiced and the invoicer may not bill it either
        const legacy = new Payment();
        legacy.organizationId = membershipOrganization.id;
        legacy.payingOrganizationId = organization.id;
        legacy.stripeAccountId = stripeAccount.id;
        legacy.method = PaymentMethod.AccountDeductions;
        legacy.provider = PaymentProvider.Stripe;
        legacy.status = PaymentStatus.Succeeded;
        legacy.reference = LEGACY_FEE_PAYMENT_REFERENCE_PREFIX + '2024-07-01';
        legacy.price = 30_00;
        legacy.paidAt = occurredAt;
        await legacy.save();

        const fee = await createFee(organization, stripeAccount, { amount: 30_00 });
        expect(fee.balanceItemId).toBeNull();

        await invoiceMonth();

        expect(await getFeePayments(organization)).toHaveLength(0);
        expect((await ApplicationFee.getByID(fee.id))!.balanceItemId).toBeNull();
    });

    test('fees of the current month are not billed yet', async () => {
        const { organization, stripeAccount } = await init();
        const now = new Date();
        await createFee(organization, stripeAccount, { when: new Date(now.getFullYear(), now.getMonth(), 1, 12) });

        await createInvoicer().generateInvoices(membershipOrganization);

        const payments = await Payment.select()
            .where('payingOrganizationId', organization.id)
            .where('method', PaymentMethod.AccountDeductions)
            .fetch();
        expect(payments).toHaveLength(0);
    });

    test('a broken account does not block the other accounts', async () => {
        const { organization, stripeAccount } = await init();
        const broken = await stripeMocker.createStripeAccount(organization.id);

        await createFee(organization, stripeAccount, { amount: 30_00 });
        await createFee(organization, broken, { amount: 40_00 });

        // Deleting the account clears payingStripeAccountId: that group can't be billed anymore
        await broken.delete();

        await invoiceMonth();

        const payments = await getFeePayments(organization);
        expect(payments).toHaveLength(1);
        expect(payments[0].price).toBe(30_00);
    });

    test('charges of a billed fee keep pointing at the deduction row', async () => {
        const { organization, stripeAccount } = await init();
        const fee = await createFee(organization, stripeAccount);

        await invoiceMonth();

        const charge = await SettlementCharge.getByID(fee.settlementChargeId);
        expect(charge).toBeDefined();
        expect(charge!.amount).toBe(-30_00);
    });
});
