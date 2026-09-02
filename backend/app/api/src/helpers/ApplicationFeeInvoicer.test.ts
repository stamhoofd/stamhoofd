import { EmailMocker } from '@stamhoofd/email';
import type { StripeAccount, Organization } from '@stamhoofd/models';
import { BalanceItem, BalanceItemPayment, OrganizationFactory, Payment } from '@stamhoofd/models';
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
import { WebmasterReport } from './WebmasterReport.js';

describe('ApplicationFeeInvoicer', () => {
    const stripeMocker = new StripeMocker();
    let membershipOrganization: Organization;

    const day = new Date(Date.UTC(2024, 6, 10));
    const occurredAt = new Date(Date.UTC(2024, 6, 10, 12));
    const reference = 'application-fees-2024-07-10';

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
            .where('occurredAt', '>=', new Date(Date.UTC(2024, 6, 1)))
            .where('occurredAt', '<', new Date(Date.UTC(2024, 7, 1)));
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

    const getFeePayments = async (organization: Organization, paymentReference = reference) => {
        return await Payment.select()
            .where('payingOrganizationId', organization.id)
            .where('reference', paymentReference)
            .where('method', PaymentMethod.AccountDeductions)
            .fetch();
    };

    const createInvoicer = () => new ApplicationFeeInvoicer({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });

    /**
     * Bills the day as if the run started a second from now: fees stored in the current second
     * are deliberately left for the next run, and a test stores them right before billing.
     */
    const invoiceDay = async (when = day) => {
        await createInvoicer().generateInvoicesForDay(membershipOrganization, when, new Date(Date.now() + 1000));
    };

    test('a day is billed per paying account, and every fee carries its balance item', async () => {
        const { organization, stripeAccount } = await init();
        const serviceFee = await createFee(organization, stripeAccount, { type: ApplicationFeeType.Service, amount: 30_00 });
        const transferFee = await createFee(organization, stripeAccount, { type: ApplicationFeeType.Transfer, amount: 2_20_00 });

        await invoiceDay();

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
        expect(serviceItem.startDate).toEqual(new Date(Date.UTC(2024, 6, 10)));
        expect(serviceItem.endDate).toEqual(new Date(Date.UTC(2024, 6, 10, 23, 59, 59)));
        expect(serviceItem.name).toBe('Servicekosten op 10 juli 2024');
        expect(serviceItem.description).toBe('Ingehouden via Stripe op 10 juli 2024 (UTC)');
        expect(transferItem.name).toBe('Transactiekosten op 10 juli 2024');

        expect((await ApplicationFee.getByID(serviceFee.id))!.balanceItemId).toBe(serviceItem.id);
        expect((await ApplicationFee.getByID(transferFee.id))!.balanceItemId).toBe(transferItem.id);
    });

    test('fees of different accounts are billed separately', async () => {
        const { organization, stripeAccount } = await init();
        const second = await stripeMocker.createStripeAccount(organization.id);

        await createFee(organization, stripeAccount, { amount: 30_00 });
        await createFee(organization, second, { amount: 40_00 });

        await invoiceDay();

        const payments = await getFeePayments(organization);
        expect(payments).toHaveLength(2);
        expect(payments.map(p => p.price).sort((a, b) => a - b)).toEqual([30_00, 40_00]);
        expect(payments.map(p => p.stripeAccountId).sort()).toEqual([stripeAccount.id, second.id].sort());
    });

    test('days are cut at UTC midnight, one payment per day', async () => {
        const { organization, stripeAccount } = await init();
        const lastOfDay = await createFee(organization, stripeAccount, { amount: 30_00, when: new Date(Date.UTC(2024, 6, 10, 23, 59, 59)) });
        const firstOfNextDay = await createFee(organization, stripeAccount, { amount: 5_00, when: new Date(Date.UTC(2024, 6, 11, 0, 0, 0)) });

        await invoiceDay(new Date(Date.UTC(2024, 6, 10)));
        await invoiceDay(new Date(Date.UTC(2024, 6, 11)));

        const payments = await getFeePayments(organization);
        expect(payments).toHaveLength(1);
        expect(payments[0].price).toBe(30_00);

        const nextDayPayments = await getFeePayments(organization, 'application-fees-2024-07-11');
        expect(nextDayPayments).toHaveLength(1);
        expect(nextDayPayments[0].price).toBe(5_00);

        expect((await ApplicationFee.getByID(lastOfDay.id))!.balanceItemId).not.toBe((await ApplicationFee.getByID(firstOfNextDay.id))!.balanceItemId);
    });

    test('generateInvoices bills every past day separately', async () => {
        const { organization, stripeAccount } = await init();

        vitest.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] }).setSystemTime(new Date(Date.UTC(2024, 6, 20, 12)));
        try {
            await createFee(organization, stripeAccount, { amount: 30_00, when: new Date(Date.UTC(2024, 6, 10, 12)) });
            await createFee(organization, stripeAccount, { amount: 5_00, when: new Date(Date.UTC(2024, 6, 12, 12)) });

            await createInvoicer().generateInvoices(membershipOrganization);
        } finally {
            vitest.useRealTimers();
        }

        const payments = await Payment.select()
            .where('payingOrganizationId', organization.id)
            .where('method', PaymentMethod.AccountDeductions)
            .fetch();
        expect(payments.map(p => [p.reference, p.price]).sort()).toEqual([
            ['application-fees-2024-07-10', 30_00],
            ['application-fees-2024-07-12', 5_00],
        ]);
    });

    test('re-running bills nothing more', async () => {
        const { organization, stripeAccount } = await init();
        await createFee(organization, stripeAccount);

        await invoiceDay();
        await invoiceDay();

        expect(await getFeePayments(organization)).toHaveLength(1);
    });

    test('a fee that arrives after its day was billed lands in an extra payment', async () => {
        const { organization, stripeAccount } = await init();
        await createFee(organization, stripeAccount, { amount: 30_00 });

        await invoiceDay();

        const late = await createFee(organization, stripeAccount, { amount: 5_00 });
        await invoiceDay();

        const payments = await getFeePayments(organization);
        expect(payments).toHaveLength(2);
        expect(payments.map(p => p.price).sort((a, b) => a - b)).toEqual([5_00, 30_00]);
        expect((await ApplicationFee.getByID(late.id))!.balanceItemId).not.toBeNull();
    });

    test('a fee the day\'s Stripe sync stores is billed in the same run', async () => {
        const { organization, stripeAccount } = await init();

        const now = new Date();
        const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10, 12));
        const stored = await createFee(organization, stripeAccount, { amount: 30_00, when: lastMonth });

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.stripeAccountId = stripeAccount.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 100_00_00;
        payment.paidAt = lastMonth;
        await payment.save();

        const stripeFee = stripeMocker.createApplicationFee({
            amount: 5,
            account: stripeAccount.accountId,
            originatingTransaction: stripeMocker.createChargeObject({ metadata: { payment: payment.id, serviceFee: '5' } }),
        });
        stripeMocker.createBalanceTransaction({ type: 'application_fee', amount: 5, created: lastMonth, source: stripeFee });

        await createInvoicer().generateInvoices(membershipOrganization);

        const payments = await Payment.select()
            .where('payingOrganizationId', organization.id)
            .where('method', PaymentMethod.AccountDeductions)
            .fetch();
        expect(payments).toHaveLength(1);
        expect(payments[0].price).toBe(35_00);

        const synced = await ApplicationFee.select().where('externalId', stripeFee.id).first(true);
        expect(synced.balanceItemId).not.toBeNull();
        expect((await ApplicationFee.getByID(stored.id))!.balanceItemId).toBe(synced.balanceItemId);
    });

    test('the fee payment is settled by the payouts that contained its fees', async () => {
        const { organization, stripeAccount } = await init();
        const payout = await SettlementService.upsertSettlement({
            provider: PaymentProvider.Stripe,
            externalId: 'po_' + uuidv4(),
            stripeAccountId: null,
            organizationId: membershipOrganization.id,
            amount: 30_00,
            settledAt: new Date(Date.UTC(2024, 6, 20)),
        });
        await createFee(organization, stripeAccount, { amount: 30_00, settlement: payout });

        await invoiceDay();

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

        await invoiceDay();

        expect(await getFeePayments(organization)).toHaveLength(0);
        expect((await ApplicationFee.getByID(fee.id))!.balanceItemId).toBeNull();
    });

    test('fees of the current UTC day are not billed yet', async () => {
        const { organization, stripeAccount } = await init();
        const now = new Date();
        await createFee(organization, stripeAccount, { when: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) });

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

        // A month the legacy invoicer billed may never be billed again: that group throws
        const legacy = new Payment();
        legacy.organizationId = membershipOrganization.id;
        legacy.payingOrganizationId = organization.id;
        legacy.stripeAccountId = broken.id;
        legacy.method = PaymentMethod.AccountDeductions;
        legacy.provider = PaymentProvider.Stripe;
        legacy.status = PaymentStatus.Succeeded;
        legacy.reference = LEGACY_FEE_PAYMENT_REFERENCE_PREFIX + '2024-07-01';
        legacy.price = 40_00;
        legacy.paidAt = occurredAt;
        await legacy.save();

        await invoiceDay();

        const payments = await getFeePayments(organization);
        expect(payments).toHaveLength(1);
        expect(payments[0].price).toBe(30_00);
    });

    test('fees without the Stripe account they were deducted from are skipped, not retried forever', async () => {
        const { organization, stripeAccount } = await init();
        const removed = await stripeMocker.createStripeAccount(organization.id);

        await createFee(organization, stripeAccount, { amount: 30_00 });
        const orphaned = await createFee(organization, removed, { amount: 40_00 });

        // Deleting the account row clears payingStripeAccountId: that fee can no longer be checked
        // against what the legacy invoicer billed per account, so it is not billed at all
        await removed.delete();

        await WebmasterReport.group('Overslaan applicatiekosten', async () => {
            await invoiceDay();
        });

        const payments = await getFeePayments(organization);
        expect(payments).toHaveLength(1);
        expect(payments[0].price).toBe(30_00);
        expect((await ApplicationFee.getByID(orphaned.id))!.balanceItemId).toBeNull();

        // Skipping is silent here: the sync that stored the fee already reported it, and this run
        // repeats every night
        const emails = (await EmailMocker.transactional.getSucceededEmails()).filter(e => e.subject.startsWith('Overslaan applicatiekosten'));
        expect(emails).toHaveLength(0);
    });

    test('charges of a billed fee keep pointing at the deduction row', async () => {
        const { organization, stripeAccount } = await init();
        const fee = await createFee(organization, stripeAccount);

        await invoiceDay();

        const charge = await SettlementCharge.getByID(fee.settlementChargeId!);
        expect(charge).toBeDefined();
        expect(charge!.amount).toBe(-30_00);
    });

    test('fees of a deleted organization are never billed, and do not block the other accounts', async () => {
        const { organization, stripeAccount } = await init();
        const { organization: other, stripeAccount: otherAccount } = await init();

        const orphaned = await createFee(organization, stripeAccount, { amount: 30_00 });
        await createFee(other, otherAccount, { amount: 40_00 });

        // Takes the Stripe account and the deduction charge with it, but not our income
        await organization.delete();

        await invoiceDay();

        const payments = await getFeePayments(other);
        expect(payments).toHaveLength(1);
        expect(payments[0].price).toBe(40_00);

        const stored = await ApplicationFee.getByID(orphaned.id);
        expect(stored).toBeDefined();
        expect(stored!.payingOrganizationId).toBeNull();
        expect(stored!.settlementChargeId).toBeNull();
        expect(stored!.balanceItemId).toBeNull();
    });
});
