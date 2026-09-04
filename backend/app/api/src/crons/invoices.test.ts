import type { BalanceItem, Organization } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, Invoice, OrganizationFactory, Payment } from '@stamhoofd/models';
import { InvoiceCounter } from '@stamhoofd/models/helpers/InvoiceCounter.js';
import { Company, PaymentCustomer, PaymentMethod, PaymentStatus, PaymentType } from '@stamhoofd/structures';
import { createInvoicesFor } from './invoices.js';

describe('Cron.invoices', () => {
    const twoDaysAgo = () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

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
        const customer = PaymentCustomer.create({ company: Company.create({ name: 'Paying club' }) });
        const balanceItem = await createBalanceItem(organization, unitPrice);

        return { organization, payingOrganization, customer, balanceItem };
    };

    const createPayment = async ({ organization, payingOrganization, customer, balanceItem, price, paidAt, type = PaymentType.Payment }: { organization: Organization; payingOrganization: Organization; customer: PaymentCustomer; balanceItem: BalanceItem; price: number; paidAt: Date; type?: PaymentType }) => {
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

    test('a payment is only invoiced after one day', async () => {
        const context = await init();
        const recent = await createPayment({ ...context, price: 10_0000, paidAt: new Date() });
        const old = await createPayment({ ...context, price: 10_0000, paidAt: twoDaysAgo() });

        await createInvoicesFor(context.organization);

        expect((await Payment.getByID(recent.id))!.invoiceId).toBeNull();

        const invoiceId = (await Payment.getByID(old.id))!.invoiceId;
        expect(invoiceId).not.toBeNull();
        const invoice = (await Invoice.getByID(invoiceId!))!;
        expect(invoice.isReceipt).toBe(false);
        expect(invoice.number).toBe('000001');
        expect(invoice.totalWithVAT).toBe(10_0000);
    });

    test('a payment below the minimum is delayed', async () => {
        const context = await init({ unitPrice: 3_0000 });
        const payment = await createPayment({ ...context, price: 3_0000, paidAt: twoDaysAgo() });

        await createInvoicesFor(context.organization);

        expect((await Payment.getByID(payment.id))!.invoiceId).toBeNull();
    });

    test('a refund on its own is booked with a credit note', async () => {
        const context = await init({ unitPrice: -10_0000 });
        const refund = await createPayment({ ...context, price: -10_0000, paidAt: twoDaysAgo(), type: PaymentType.Refund });

        await createInvoicesFor(context.organization);

        const invoiceId = (await Payment.getByID(refund.id))!.invoiceId;
        expect(invoiceId).not.toBeNull();
        const creditNote = (await Invoice.getByID(invoiceId!))!;
        expect(creditNote.isReceipt).toBe(false);
        expect(creditNote.totalWithVAT).toBe(-10_0000);
    });

    test('payments on different balance items that sum to zero are booked with a receipt that keeps its items', async () => {
        const context = await init();
        const refundedItem = await createBalanceItem(context.organization, -10_0000);
        const payment = await createPayment({ ...context, price: 10_0000, paidAt: twoDaysAgo() });
        const refund = await createPayment({ ...context, balanceItem: refundedItem, price: -10_0000, paidAt: twoDaysAgo(), type: PaymentType.Refund });

        await createInvoicesFor(context.organization);

        const invoiceId = (await Payment.getByID(payment.id))!.invoiceId;
        expect(invoiceId).not.toBeNull();
        expect((await Payment.getByID(refund.id))!.invoiceId).toBe(invoiceId);

        const receipt = (await Invoice.getByID(invoiceId!))!;
        expect(receipt.isReceipt).toBe(true);
        expect(receipt.totalWithVAT).toBe(0);

        const { invoicedBalanceItems } = await Invoice.loadBalanceItems([receipt]);
        expect(invoicedBalanceItems.map(i => i.balanceInvoicedAmount).sort((a, b) => a - b)).toEqual([-10_0000, 10_0000]);
    });

    test('a payment and its refund are booked with a zero receipt instead of an invoice and a credit note', async () => {
        const context = await init();
        const payment = await createPayment({ ...context, price: 10_0000, paidAt: twoDaysAgo() });
        const refund = await createPayment({ ...context, price: -10_0000, paidAt: twoDaysAgo(), type: PaymentType.Refund });

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
