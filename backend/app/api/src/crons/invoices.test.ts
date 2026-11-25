import type { BalanceItem } from '@stamhoofd/models';
import {
    BalanceItemFactory,
    BalanceItemPayment,
    Invoice,
    Organization,
    OrganizationFactory,
    Payment,
} from '@stamhoofd/models';
import { EmailMocker } from '@stamhoofd/email';
import { InvoiceCounter } from '@stamhoofd/models/helpers/InvoiceCounter.js';
import {
    Company,
    PaymentCustomer,
    PaymentMethod,
    PaymentStatus,
    PaymentType,
} from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { createInvoiceCron, createInvoicesFor } from './invoices.js';
import { InvoiceService } from '../services/InvoiceService.js';
import { TestUtils } from '@stamhoofd/test-utils';

describe('Cron.invoices', () => {
    const startOfMonth = () => Formatter.luxon().startOf('month');
    const lastMonth = () => startOfMonth().minus({ day: 15 }).toJSDate();

    beforeEach(() => {
        InvoiceCounter.clearAll();
    });

    const createBalanceItem = async (organization: Organization, unitPrice: number) => {
        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            amount: 1,
            unitPrice,
        }).create();
        balanceItem.VATPercentage = 0;
        await balanceItem.save();
        return balanceItem;
    };

    const init = async ({ unitPrice = 10_0000 }: { unitPrice?: number } = {}) => {
        const organization = await new OrganizationFactory({}).create();
        organization.meta.companies = [Company.create({ name: 'Seller' })];
        organization.meta.invoicesEnabled = true;
        await organization.save();

        const payingOrganization = await new OrganizationFactory({}).create();
        const customer = PaymentCustomer.create({
            company: Company.create({ name: 'Paying club' }),
        });
        const balanceItem = await createBalanceItem(organization, unitPrice);

        return { organization, payingOrganization, customer, balanceItem };
    };

    const createPayment = async ({
        organization,
        payingOrganization,
        customer,
        balanceItem,
        price,
        paidAt,
        type = PaymentType.Payment,
    }: {
        organization: Organization;
        payingOrganization: Organization;
        customer: PaymentCustomer;
        balanceItem: BalanceItem;
        price: number;
        paidAt: Date;
        type?: PaymentType;
    }) => {
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.payingOrganizationId = payingOrganization.id;
        payment.customer = customer;
        payment.method = PaymentMethod.Bancontact;
        payment.status = PaymentStatus.Succeeded;
        payment.type = type;
        payment.price = price;
        payment.paidAt = paidAt;
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.organizationId = organization.id;
        balanceItemPayment.price = price;
        await balanceItemPayment.save();

        return payment;
    };

    test('all payments before the current month are invoiced together', async () => {
        const context = await init();
        const current = await createPayment({
            ...context,
            price: 10_0000,
            paidAt: startOfMonth().toJSDate(),
        });
        const last = await createPayment({
            ...context,
            balanceItem: await createBalanceItem(context.organization, 10_0000),
            price: 10_0000,
            paidAt: startOfMonth().minus({ second: 1 }).toJSDate(),
        });
        const old = await createPayment({
            ...context,
            balanceItem: await createBalanceItem(context.organization, 10_0000),
            price: 10_0000,
            paidAt: startOfMonth().minus({ month: 6 }).toJSDate(),
        });

        await createInvoicesFor(context.organization);

        expect((await Payment.getByID(current.id))!.invoiceId).toBeNull();

        const invoiceId = (await Payment.getByID(last.id))!.invoiceId;
        expect(invoiceId).not.toBeNull();
        expect((await Payment.getByID(old.id))!.invoiceId).toBe(invoiceId);
        const invoice = (await Invoice.getByID(invoiceId!))!;
        expect(invoice.isReceipt).toBe(false);
        expect(invoice.number).toBe('000001');
        expect(invoice.totalWithVAT).toBe(20_0000);
    });

    test('a payment below four euro is invoiced', async () => {
        const context = await init({ unitPrice: 3_0000 });
        const payment = await createPayment({ ...context, price: 3_0000, paidAt: lastMonth() });

        await createInvoicesFor(context.organization);

        expect((await Payment.getByID(payment.id))!.invoiceId).not.toBeNull();
    });

    test('a restarted scan retries failed invoices, skips linked payments and signals completion', async () => {
        const context = await init();
        const paidAt = new Date('2026-10-31T12:00:00Z');
        const payment = await createPayment({ ...context, price: 10_0000, paidAt });
        const otherPayment = await createPayment({
            ...context,
            price: 10_0000,
            paidAt,
            payingOrganization: await new OrganizationFactory({}).create(),
            balanceItem: await createBalanceItem(context.organization, 10_0000),
        });
        const select = Organization.select.bind(Organization);
        const sellers = vi
            .spyOn(Organization, 'select')
            .mockImplementation(() => select().where('id', context.organization.id));
        TestUtils.setEnvironment('MONTHLY_INVOICE_HEARTBEAT_URL', 'https://example.invalid/month');
        const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal('fetch', request);
        const create = vi
            .spyOn(InvoiceService, 'createFrom')
            .mockRejectedValueOnce(new Error('invoice failed'));
        try {
            vi.setSystemTime(new Date('2026-11-11T00:00:00Z'));
            const tick = createInvoiceCron();
            vi.setSystemTime(new Date('2026-11-11T06:00:00Z'));
            await tick();
            const invoiceIds = () =>
                Promise.all(
                    [payment, otherPayment].map(
                        async (p) => (await Payment.getByID(p.id))!.invoiceId,
                    ),
                );
            const beforeRestart = await invoiceIds();
            expect(beforeRestart.filter((id) => id !== null)).toHaveLength(1);
            await tick();
            expect(create).toHaveBeenCalledTimes(2);
            expect(request).toHaveBeenCalledOnce();

            vi.setSystemTime(new Date('2026-11-18T09:00:00Z'));
            const restarted = createInvoiceCron();
            vi.setSystemTime(new Date('2026-11-18T14:00:00Z'));
            await restarted();
            const afterRestart = await invoiceIds();
            expect(afterRestart).not.toContain(null);
            expect(afterRestart).toContain(beforeRestart.find((id) => id !== null));
            expect(create).toHaveBeenCalledTimes(3);
            expect(request).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
            vi.unstubAllGlobals();
            create.mockRestore();
            sellers.mockRestore();
        }
    });

    test('a refund on its own is booked with a credit note', async () => {
        const context = await init({ unitPrice: -10_0000 });
        const refund = await createPayment({
            ...context,
            price: -10_0000,
            paidAt: lastMonth(),
            type: PaymentType.Refund,
        });

        await createInvoicesFor(context.organization);

        const invoiceId = (await Payment.getByID(refund.id))!.invoiceId;
        expect(invoiceId).not.toBeNull();
        const creditNote = (await Invoice.getByID(invoiceId!))!;
        expect(creditNote.isReceipt).toBe(false);
        expect(creditNote.totalWithVAT).toBe(-10_0000);
    });

    test('payments on different balance items that sum to zero are skipped without an error', async () => {
        const context = await init();
        const refundedItem = await createBalanceItem(context.organization, -10_0000);
        const payment = await createPayment({ ...context, price: 10_0000, paidAt: lastMonth() });
        const refund = await createPayment({
            ...context,
            balanceItem: refundedItem,
            price: -10_0000,
            paidAt: lastMonth(),
            type: PaymentType.Refund,
        });

        const emailsBefore = (await EmailMocker.transactional.getSucceededEmails()).length;
        await createInvoicesFor(context.organization);

        // Goods moved, so this needs a zero invoice, which is not supported yet
        expect((await Payment.getByID(payment.id))!.invoiceId).toBeNull();
        expect((await Payment.getByID(refund.id))!.invoiceId).toBeNull();
        expect(
            (await Invoice.select().where('organizationId', context.organization.id).fetch())
                .length,
        ).toBe(0);
        expect((await EmailMocker.transactional.getSucceededEmails()).length).toBe(emailsBefore);
    });

    test('a payment and its refund are booked with a zero receipt instead of an invoice and a credit note', async () => {
        const context = await init();
        const payment = await createPayment({ ...context, price: 10_0000, paidAt: lastMonth() });
        const refund = await createPayment({
            ...context,
            price: -10_0000,
            paidAt: lastMonth(),
            type: PaymentType.Refund,
        });

        await createInvoicesFor(context.organization);

        const invoiceId = (await Payment.getByID(payment.id))!.invoiceId;
        expect(invoiceId).not.toBeNull();
        expect((await Payment.getByID(refund.id))!.invoiceId).toBe(invoiceId);

        const receipt = (await Invoice.getByID(invoiceId!))!;
        expect(receipt.isReceipt).toBe(true);
        expect(receipt.number).toBe('BON-000001');
        expect(receipt.totalWithVAT).toBe(0);
        expect(receipt.pdf).not.toBeNull();
        expect(receipt.xml).toBeNull();

        const { invoicedBalanceItems } = await Invoice.loadBalanceItems([receipt]);
        expect(invoicedBalanceItems.length).toBe(0);
    });
});
