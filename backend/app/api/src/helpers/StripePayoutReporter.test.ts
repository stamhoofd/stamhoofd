import { EmailMocker } from '@stamhoofd/email';
import type { StripeAccount, Organization } from '@stamhoofd/models';
import { Invoice, OrganizationFactory, Payment } from '@stamhoofd/models';
import { Address, Company, PaymentCustomer, PaymentMethod, PaymentProvider, PaymentStatus, PaymentType } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Formatter } from '@stamhoofd/utility';
import nock from 'nock';

import { resetNock } from '../../tests/helpers/resetNock.js';
import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import { initMembershipOrganization } from '../../tests/init/initMembershipOrganization.js';
import { StripeInvoicer } from './StripeInvoicer.js';
import { StripePayoutBreakdownData, StripePayoutData, StripePayoutExportData, StripePayoutItemData, StripePayoutItemType } from './StripePayoutExportData.js';
import { StripePayoutReporter } from './StripePayoutReporter.js';

describe('StripePayoutReporter', () => {
    let membershipOrganization: Organization;
    const stripeMocker = new StripeMocker();

    // Report over March 2026 (tests always run in UTC)
    const month = new Date(2026, 2, 15);
    const { start: monthStartUnix } = StripeInvoicer.getMonthUnixStartEnd(month);
    const reference = 'stripe-fees-' + Formatter.dateIso(new Date(monthStartUnix * 1000));
    const reportStart = new Date(2026, 2, 1);
    const reportEnd = new Date(new Date(2026, 3, 1).getTime() - 1000);

    const belgianAddress = () => Address.create({
        street: 'Teststraat',
        number: '1',
        postalCode: '9000',
        city: 'Gent',
        country: Country.Belgium,
    });

    beforeAll(async () => {
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

    afterEach(() => {
        resetNock();
    });

    const init = async () => {
        const organization = await new OrganizationFactory({}).create();
        const stripeAccount = await stripeMocker.createStripeAccount(organization.id);
        return { organization, stripeAccount };
    };

    /**
     * One payout containing a charge of `chargeCents` with an application fee of `feeCents`,
     * fully transferred to the connected account. The payout pays out the application fee
     * minus the Stripe processing fee to the platform.
     */
    const mockStripeData = (accountId: string, { feeCents = 250, chargeCents = 10000, stripeFeeCents = 25, feeRefundCents = 0, refundCents = 0 } = {}) => {
        const createdUnix = monthStartUnix + 14 * 24 * 3600;
        const payout = {
            id: stripeMocker.createId('po'),
            object: 'payout',
            status: 'paid',
            amount: feeCents - feeRefundCents - stripeFeeCents,
            arrival_date: createdUnix + 5 * 24 * 3600,
            statement_descriptor: 'STAMHOOFD',
        };

        const transactions: unknown[] = [
            {
                id: stripeMocker.createId('txn'),
                type: 'charge',
                amount: chargeCents,
                fee: stripeFeeCents,
                created: createdUnix,
                source: { object: 'charge', id: stripeMocker.createId('ch'), amount: chargeCents, on_behalf_of: accountId },
            },
            {
                id: stripeMocker.createId('txn'),
                type: 'transfer',
                amount: -chargeCents,
                fee: 0,
                created: createdUnix,
                source: { object: 'transfer', id: stripeMocker.createId('tr'), destination: accountId },
            },
            {
                id: stripeMocker.createId('txn'),
                type: 'application_fee',
                amount: feeCents,
                fee: 0,
                created: createdUnix,
                source: { object: 'application_fee', id: stripeMocker.createId('fee'), amount: feeCents, account: accountId },
            },
            {
                id: stripeMocker.createId('txn'),
                type: 'payout',
                amount: -(feeCents - feeRefundCents - stripeFeeCents),
                fee: 0,
                created: createdUnix + 5 * 24 * 3600,
                source: null,
            },
        ];

        if (refundCents > 0) {
            // A customer refund: paid back from the connected account balance via a transfer refund
            transactions.push({
                id: stripeMocker.createId('txn'),
                type: 'refund',
                amount: -refundCents,
                fee: 0,
                created: createdUnix,
                source: {
                    object: 'refund',
                    id: stripeMocker.createId('re'),
                    amount: refundCents,
                    charge: { object: 'charge', id: stripeMocker.createId('ch'), amount: chargeCents, on_behalf_of: accountId },
                },
            }, {
                id: stripeMocker.createId('txn'),
                type: 'transfer_refund',
                amount: refundCents,
                fee: 0,
                created: createdUnix,
                source: { object: 'transfer', id: stripeMocker.createId('tr'), destination: accountId },
            });
        }

        if (feeRefundCents > 0) {
            transactions.push({
                id: stripeMocker.createId('txn'),
                type: 'application_fee_refund',
                amount: -feeRefundCents,
                fee: 0,
                created: createdUnix,
                source: {
                    object: 'fee_refund',
                    id: stripeMocker.createId('fr'),
                    amount: feeRefundCents,
                    fee: { object: 'application_fee', id: stripeMocker.createId('fee'), amount: feeCents, account: accountId },
                },
            });
        }

        nock('https://api.stripe.com')
            .get('/v1/payouts')
            .query(true)
            .reply(200, { object: 'list', data: [payout], has_more: false, url: '/v1/payouts' });

        nock('https://api.stripe.com')
            .get('/v1/balance_transactions')
            .query(true)
            .reply(200, { object: 'list', data: transactions, has_more: false, url: '/v1/balance_transactions' });

        return { payout, transactions };
    };

    const createPayment = async (organization: Organization, stripeAccount: StripeAccount, price: number) => {
        const payment = new Payment();
        payment.organizationId = membershipOrganization.id;
        payment.payingOrganizationId = organization.id;
        payment.stripeAccountId = stripeAccount.id;
        payment.reference = reference;
        payment.method = PaymentMethod.AccountDeductions;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Succeeded;
        payment.type = PaymentType.Payment;
        payment.price = price;
        payment.paidAt = new Date(monthStartUnix * 1000);
        payment.customer = PaymentCustomer.create({
            company: Company.create({
                name: 'Testvereniging VZW',
                companyNumber: '0500000000',
                VATNumber: 'BE0500000000',
                address: belgianAddress(),
            }),
        });
        await payment.save();
        return payment;
    };

    const createInvoice = async (organization: Organization, payment: Payment, { number, totalWithVAT, VATTotalAmount }: { number: string; totalWithVAT: number; VATTotalAmount: number }) => {
        const invoice = new Invoice();
        invoice.organizationId = membershipOrganization.id;
        invoice.payingOrganizationId = organization.id;
        invoice.number = number;
        invoice.customer = payment.customer!;
        invoice.seller = membershipOrganization.meta.companies[0];
        invoice.totalWithVAT = totalWithVAT;
        invoice.VATTotalAmount = VATTotalAmount;
        invoice.totalWithoutVAT = totalWithVAT - VATTotalAmount;
        invoice.invoicedAt = new Date();
        await invoice.save();

        payment.invoiceId = invoice.id;
        await payment.save();
        return invoice;
    };

    const buildReport = async () => {
        const reporter = new StripePayoutReporter({
            secretKey: STAMHOOFD.STRIPE_SECRET_KEY!,
            sellingOrganization: membershipOrganization,
        });
        await reporter.build(reportStart, reportEnd);
        return reporter;
    };

    test('A payment that has been invoiced is reported with its invoice number and makes the report valid', async () => {
        const { organization, stripeAccount } = await init();
        mockStripeData(stripeAccount.accountId, { feeCents: 250, stripeFeeCents: 25 });

        // 2.50 euro in platform units (1/100 cent)
        const payment = await createPayment(organization, stripeAccount, 250_00);
        await createInvoice(organization, payment, { number: '2026-101', totalWithVAT: 250_00, VATTotalAmount: 4339 });

        const reporter = await buildReport();
        const payoutExport = reporter.toStructure();

        expect(payoutExport.payouts.length).toBe(1);

        const breakdown = payoutExport.payouts[0];
        expect(breakdown.payout.amount).toBe(225_00);
        expect(breakdown.isValid).toBe(true);

        const invoiceItem = breakdown.items.find(i => i.type === StripePayoutItemType.Invoice)!;
        expect(invoiceItem.name).toBe('Factuur 2026-101');
        expect(invoiceItem.amount).toBe(250_00);
        expect(invoiceItem.reference).toBe(reference);
        expect(invoiceItem.payments.map(p => p.id)).toEqual([payment.id]);
        expect(invoiceItem.invoices.map(i => i.number)).toEqual(['2026-101']);

        const feesItem = breakdown.items.find(i => i.type === StripePayoutItemType.StripeFees)!;
        expect(feesItem.amount).toBe(-25_00);

        expect(payoutExport.completePayouts.length).toBe(1);
        expect(payoutExport.isValid).toBe(true);
        expect(payoutExport.totalPaidOut).toBe(225_00);
        expect(payoutExport.totalStripeFees).toBe(25_00);
        expect(payoutExport.totalInvoices).toBe(250_00);
        expect(payoutExport.totalVAT).toBe(4339);
        expect(payoutExport.net).toBe(225_00 - 4339);

        // The report can be exported to Excel
        const buffer = await reporter.toExcel(payoutExport);
        expect(buffer.length).toBeGreaterThan(0);

        // Extra recipients receive the report because it is valid
        await reporter.sendEmail({
            to: [{ email: 'requester@example.com' }],
            extraRecipientsWhenValid: [{ email: 'accountant@example.com' }],
        });
        const email = (await EmailMocker.transactional.getSucceededEmails()).find(e => e.subject.startsWith('Stripe Uitbetalingen'));
        expect(email).toBeDefined();
        expect(email!.to).toContain('requester@example.com');
        expect(email!.to).toContain('accountant@example.com');
        expect(email!.text).not.toContain('RAPPORT ONVOLLEDIG');
    });

    test('A payment that has not been invoiced yet is visible in the report and marks it as incomplete', async () => {
        const { organization, stripeAccount } = await init();
        mockStripeData(stripeAccount.accountId, { feeCents: 250, stripeFeeCents: 25 });

        const payment = await createPayment(organization, stripeAccount, 250_00);

        const reporter = await buildReport();
        const payoutExport = reporter.toStructure();

        const breakdown = payoutExport.payouts[0];
        expect(breakdown.isValid).toBe(true); // amounts of the payout itself are consistent

        const invoiceItem = breakdown.items.find(i => i.type === StripePayoutItemType.Invoice)!;
        expect(invoiceItem.name).toBe('Betaling aangemaakt, nog niet gefactureerd');
        expect(invoiceItem.amount).toBe(250_00);
        expect(invoiceItem.payments.map(p => p.id)).toEqual([payment.id]);
        expect(invoiceItem.invoices).toEqual([]);

        // Not invoiced yet: the payout is not complete and the report is invalid
        expect(payoutExport.completePayouts.length).toBe(0);
        expect(payoutExport.isValid).toBe(false);

        // Extra recipients are skipped for invalid reports
        await reporter.sendEmail({
            to: [{ email: 'requester@example.com' }],
            extraRecipientsWhenValid: [{ email: 'accountant@example.com' }],
        });
        const email = (await EmailMocker.transactional.getSucceededEmails()).find(e => e.subject.startsWith('Stripe Uitbetalingen'));
        expect(email).toBeDefined();
        expect(email!.to).toContain('requester@example.com');
        expect(email!.to).not.toContain('accountant@example.com');
        expect(email!.text).toContain('RAPPORT ONVOLLEDIG');
    });

    test('Application fees without a created payment are visible in the report and mark it as incomplete', async () => {
        const { stripeAccount } = await init();
        mockStripeData(stripeAccount.accountId, { feeCents: 250, stripeFeeCents: 25 });

        const reporter = await buildReport();
        const payoutExport = reporter.toStructure();

        const invoiceItem = payoutExport.payouts[0].items.find(i => i.type === StripePayoutItemType.Invoice)!;
        expect(invoiceItem.name).toBe('Nog geen betaling aangemaakt');
        expect(invoiceItem.amount).toBe(250_00);
        expect(invoiceItem.payments).toEqual([]);

        expect(payoutExport.completePayouts.length).toBe(0);
        expect(payoutExport.isValid).toBe(false);
    });

    test('Refunded application fees reduce the amount that should be invoiced', async () => {
        const { organization, stripeAccount } = await init();
        mockStripeData(stripeAccount.accountId, { feeCents: 250, feeRefundCents: 50, stripeFeeCents: 25 });

        // 2 euro invoiced: 2.50 euro of fees minus 0.50 euro refunded
        const payment = await createPayment(organization, stripeAccount, 200_00);
        await createInvoice(organization, payment, { number: '2026-103', totalWithVAT: 200_00, VATTotalAmount: 3471 });

        const reporter = await buildReport();
        const payoutExport = reporter.toStructure();

        const breakdown = payoutExport.payouts[0];
        expect(breakdown.payout.amount).toBe(175_00);
        expect(breakdown.isValid).toBe(true);

        const invoiceItem = breakdown.items.find(i => i.type === StripePayoutItemType.Invoice)!;
        expect(invoiceItem.amount).toBe(200_00);

        expect(payoutExport.completePayouts.length).toBe(1);
        expect(payoutExport.isValid).toBe(true);
    });

    test('A payout containing a customer refund can be reported', async () => {
        const { organization, stripeAccount } = await init();
        mockStripeData(stripeAccount.accountId, { feeCents: 250, stripeFeeCents: 25, refundCents: 1000 });

        const payment = await createPayment(organization, stripeAccount, 250_00);
        await createInvoice(organization, payment, { number: '2026-104', totalWithVAT: 250_00, VATTotalAmount: 4339 });

        const reporter = await buildReport();
        const payoutExport = reporter.toStructure();

        // The refund and its transfer refund cancel each other out on the payout
        const breakdown = payoutExport.payouts[0];
        expect(breakdown.payout.amount).toBe(225_00);
        expect(breakdown.isValid).toBe(true);

        expect(payoutExport.completePayouts.length).toBe(1);
        expect(payoutExport.isValid).toBe(true);
    });

    test('Payout-level mismatches that cancel each other out still make the report invalid', () => {
        const payoutExport = new StripePayoutExportData({ start: reportStart, end: reportEnd });

        const buildBreakdown = (payoutAmount: number, itemAmount: number) => new StripePayoutBreakdownData({
            payout: new StripePayoutData({
                id: stripeMocker.createId('po'),
                amount: payoutAmount,
                arrivalDate: new Date(2026, 2, 15),
                statementDescriptor: 'STAMHOOFD',
            }),
            items: [
                new StripePayoutItemData({
                    name: 'Stripe Factuur',
                    type: StripePayoutItemType.StripeFees,
                    amount: itemAmount,
                }),
            ],
        });

        // One payout paid out 1 euro too much and the other 1 euro too little: the aggregate
        // totals still match, but the report should not be considered valid
        payoutExport.payouts.push(buildBreakdown(100_00, 200_00), buildBreakdown(300_00, 200_00));

        expect(payoutExport.totalPaidOut).toBe(400_00);
        expect(payoutExport.completePayouts.length).toBe(2);
        expect(payoutExport.payouts[0].isValid).toBe(false);
        expect(payoutExport.isValid).toBe(false);
    });

    test('An invoiced payment with a different amount than the application fees marks the report as incomplete', async () => {
        const { organization, stripeAccount } = await init();
        mockStripeData(stripeAccount.accountId, { feeCents: 250, stripeFeeCents: 25 });

        // Payment of 2 euro, while 2.50 euro of application fees were charged
        const payment = await createPayment(organization, stripeAccount, 200_00);
        await createInvoice(organization, payment, { number: '2026-102', totalWithVAT: 200_00, VATTotalAmount: 3471 });

        const reporter = await buildReport();
        const payoutExport = reporter.toStructure();

        const invoiceItem = payoutExport.payouts[0].items.find(i => i.type === StripePayoutItemType.Invoice)!;
        expect(invoiceItem.name).toBe('Factuur 2026-102');
        expect(invoiceItem.amount).toBe(250_00);

        expect(payoutExport.completePayouts.length).toBe(0);
        expect(payoutExport.isValid).toBe(false);
    });
});
