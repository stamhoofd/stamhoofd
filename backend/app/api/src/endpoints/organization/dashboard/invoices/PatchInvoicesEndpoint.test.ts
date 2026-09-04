import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, Invoice, InvoicedBalanceItem, OrganizationFactory, Payment, UserFactory } from '@stamhoofd/models';
import { InvoiceCounter } from '@stamhoofd/models/helpers/InvoiceCounter.js';
import { Company, InvoicedBalanceItem as InvoicedBalanceItemStruct, InvoiceStruct, InvoiceType, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchInvoicesEndpoint } from './PatchInvoicesEndpoint.js';
import { InvoicePdfService } from '../../../../services/InvoicePdfService.js';
import { InvoiceService } from '../../../../services/InvoiceService.js';
import { SessionService } from '../../../../services/SessionService.js';

describe('Endpoint.PatchInvoicesEndpoint', () => {
    const endpoint = new PatchInvoicesEndpoint();

    const createBalanceItem = async ({ organization, unitPrice = 10_00 }: { organization: Organization; unitPrice?: number }) => {
        return await new BalanceItemFactory({
            organizationId: organization.id,
            amount: 1,
            unitPrice,
        }).create();
    };

    const createInvoice = async ({ organization, balanceItemIds, number = '1' }: { organization: Organization; balanceItemIds: string[]; number?: string | null }) => {
        const invoice = new Invoice();
        invoice.organizationId = organization.id;
        invoice.number = number;
        invoice.invoicedAt = number ? new Date() : null;
        await invoice.save();

        for (const balanceItemId of balanceItemIds) {
            const item = new InvoicedBalanceItem();
            item.organizationId = organization.id;
            item.invoiceId = invoice.id;
            item.balanceItemId = balanceItemId;
            item.name = 'Test item';
            item.unitPrice = 10_00;
            item.balanceInvoicedAmount = 10_00;
            await item.save();
        }

        // Make sure the invoiced cache of the balance items is up to date, like it would be for a real invoice.
        await BalanceItem.updateInvoiced(balanceItemIds);

        return invoice;
    };

    const createPayment = async ({ organization, invoice }: { organization: Organization; invoice: Invoice }) => {
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.PointOfSale;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 10_00;
        payment.invoiceId = invoice.id;
        await payment.save();
        return payment;
    };

    const patchInvoices = async ({ body, organization, user }: { body: PatchableArrayAutoEncoder<InvoiceStruct>; organization: Organization; user: User }) => {
        const token = await SessionService.createSession(user);
        const request = Request.buildJson('PATCH', '/invoices', organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test<InvoiceStruct[]>(endpoint, request);
    };

    /**
     * Builds an invoice struct (PUT body) for one new, unlinked payment of 10 euro on a fresh balance item
     */
    const buildNewInvoice = async ({ organization, customer, isReceipt = false, comments = null }: { organization: Organization; customer: PaymentCustomer; isReceipt?: boolean; comments?: string | null }) => {
        const balanceItem = await createBalanceItem({ organization });
        balanceItem.VATPercentage = 0;
        await balanceItem.save();

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.PointOfSale;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 10_00;
        await payment.save();

        const struct = InvoiceStruct.create({
            organizationId: organization.id,
            seller: Company.create({ name: 'Seller' }),
            customer,
            isReceipt,
            comments,
            payments: [PaymentGeneral.create({ id: payment.id, method: payment.method, status: payment.status, price: payment.price })],
        });
        struct.addItem(InvoicedBalanceItemStruct.createFor(balanceItem.getStructure(), 10_00));
        return struct;
    };

    /**
     * Builds an invoice struct (PUT body) for two unlinked payments of 10 and -10 euro that cancel each other out.
     * Both payments get their own balance item, unless `withoutItems` is set: then the balance items cancelled each other out and the struct has no items.
     */
    const buildZeroInvoice = async ({ organization, customer, isReceipt = false, withoutItems = false }: { organization: Organization; customer: PaymentCustomer; isReceipt?: boolean; withoutItems?: boolean }) => {
        const struct = InvoiceStruct.create({
            organizationId: organization.id,
            seller: Company.create({ name: 'Seller' }),
            customer,
            isReceipt,
        });

        for (const price of [10_00, -10_00]) {
            const payment = new Payment();
            payment.organizationId = organization.id;
            payment.method = PaymentMethod.PointOfSale;
            payment.status = PaymentStatus.Succeeded;
            payment.price = price;
            await payment.save();
            struct.payments.push(PaymentGeneral.create({ id: payment.id, method: payment.method, status: payment.status, price: payment.price }));

            if (!withoutItems) {
                const balanceItem = await createBalanceItem({ organization, unitPrice: price });
                balanceItem.VATPercentage = 0;
                await balanceItem.save();
                struct.addItem(InvoicedBalanceItemStruct.createFor(balanceItem.getStructure(), price));
            }
        }
        return struct;
    };

    describe('Creating zero receipts', () => {
        beforeEach(() => {
            InvoiceCounter.clearAll();
        });

        test('a zero receipt marks payments that cancel each other out as booked, also for a company customer', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const company = PaymentCustomer.create({ company: Company.create({ name: 'BTW-plichtig', VATNumber: 'BE0123456749' }) });

            const body = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
            const struct = await buildZeroInvoice({ organization, customer: company, isReceipt: true });
            body.addPut(struct);
            const [receipt] = (await patchInvoices({ body, organization, user })).body;

            expect(receipt.number).toBe('BON-000001');
            expect(receipt.type).toBe(InvoiceType.Receipt);
            expect(receipt.totalWithVAT).toBe(0);
            expect(receipt.items.length).toBe(2);
            expect(receipt.pdf).not.toBeNull();
            expect(receipt.xml).toBeNull();

            for (const p of struct.payments) {
                const payment = await Payment.getByID(p.id);
                expect(payment!.invoiceId).toBe(receipt.id);
            }

            const html = await InvoicePdfService.generateHtml((await Invoice.getByID(receipt.id))!);
            expect(html).toContain('Aankoopbewijs');
            expect(html).toContain('Dit is geen factuur');
            expect(html).not.toContain('Er werden geen goederen of diensten geleverd');
        });

        test('a zero receipt without items lists its payments on the PDF', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
            const struct = await buildZeroInvoice({ organization, customer: PaymentCustomer.create({}), isReceipt: true, withoutItems: true });
            expect(struct.items.length).toBe(0);
            body.addPut(struct);
            const [receipt] = (await patchInvoices({ body, organization, user })).body;

            expect(receipt.number).toBe('BON-000001');
            expect(receipt.totalWithVAT).toBe(0);
            expect(receipt.items.length).toBe(0);
            expect(receipt.pdf).not.toBeNull();

            for (const p of struct.payments) {
                const payment = await Payment.getByID(p.id);
                expect(payment!.invoiceId).toBe(receipt.id);
            }

            const html = await InvoicePdfService.generateHtml((await Invoice.getByID(receipt.id))!);
            expect(html).toContain('Er werden geen goederen of diensten geleverd');
            expect(html).toContain(PaymentMethodHelper.getName(PaymentMethod.PointOfSale));
            expect(html).toContain(Formatter.price(10_00));
            expect(html).toContain(Formatter.price(-10_00));
            expect(html).not.toContain('BTW ()');
            expect(html).not.toContain('werd al betaald via');
        });

        test('multiple rows on one balance item are validated on their sum', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const balanceItem = await createBalanceItem({ organization });
            balanceItem.VATPercentage = 0;
            await balanceItem.save();

            const payment = new Payment();
            payment.organizationId = organization.id;
            payment.method = PaymentMethod.PointOfSale;
            payment.status = PaymentStatus.Succeeded;
            payment.price = 20_00;
            await payment.save();

            const struct = InvoiceStruct.create({
                organizationId: organization.id,
                seller: Company.create({ name: 'Seller' }),
                customer: PaymentCustomer.create({}),
                payments: [PaymentGeneral.create({ id: payment.id, method: payment.method, status: payment.status, price: payment.price })],
            });

            // Two rows of 10 euro each on a balance item of 10 euro: each row fits on its own, the sum does not
            struct.addItem(InvoicedBalanceItemStruct.createFor(balanceItem.getStructure(), 10_00));
            struct.addItem(InvoicedBalanceItemStruct.createFor(balanceItem.getStructure(), 10_00));

            const body = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
            body.addPut(struct);
            await expect(patchInvoices({ body, organization, user })).rejects.toThrow(STExpect.errorWithCode('cannot_invoice_balance_item'));
        });

        test('a zero invoice is still rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            for (const withoutItems of [false, true]) {
                const body = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
                body.addPut(await buildZeroInvoice({ organization, customer: PaymentCustomer.create({}), withoutItems }));
                await expect(patchInvoices({ body, organization, user })).rejects.toThrow(STExpect.errorWithCode('invalid_invoiced_amount'));
            }
        });

        test('a zero receipt without payments is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const struct = InvoiceStruct.create({
                organizationId: organization.id,
                seller: Company.create({ name: 'Seller' }),
                customer: PaymentCustomer.create({}),
                isReceipt: true,
            });

            await expect(InvoiceService.createFrom(organization, struct)).rejects.toThrow(STExpect.errorWithCode('missing_payments'));
        });
    });

    describe('Creating receipts', () => {
        beforeEach(() => {
            InvoiceCounter.clearAll();
        });

        test('a receipt gets its own number series, no XML and keeps its comments', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const anonymous = PaymentCustomer.create({});

            const invoiceBody = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
            invoiceBody.addPut(await buildNewInvoice({ organization, customer: anonymous }));
            const [invoice] = (await patchInvoices({ body: invoiceBody, organization, user })).body;
            expect(invoice.number).toBe('000001');
            expect(invoice.type).toBe(InvoiceType.Invoice);

            const receiptBody = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
            receiptBody.addPut(await buildNewInvoice({ organization, customer: anonymous, isReceipt: true, comments: '  Verkoop op de bar  ' }));
            const [receipt] = (await patchInvoices({ body: receiptBody, organization, user })).body;

            expect(receipt.number).toBe('BON-000001');
            expect(receipt.type).toBe(InvoiceType.Receipt);
            expect(receipt.isReceipt).toBe(true);
            expect(receipt.comments).toBe('Verkoop op de bar');
            expect(receipt.pdf).not.toBeNull();
            expect(receipt.xml).toBeNull();
            expect(receipt.didSendPeppol).toBe(false);

            const model = await Invoice.getByID(receipt.id);
            expect(model!.generateCustomerFilename('pdf')).toContain('Aankoopbewijs BON-000001');

            const html = await InvoicePdfService.generateHtml(model!);
            expect(html).toContain('Aankoopbewijs');
            expect(html).toContain('Verkoop op de bar');
            expect(html).toContain('Dit is geen factuur');
            expect(html).not.toContain('Factuur');

            // The invoice series continues independently
            const secondInvoiceBody = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
            secondInvoiceBody.addPut(await buildNewInvoice({ organization, customer: anonymous, comments: 'Opmerking' }));
            const [secondInvoice] = (await patchInvoices({ body: secondInvoiceBody, organization, user })).body;
            expect(secondInvoice.number).toBe('000002');
            expect(secondInvoice.comments).toBe('Opmerking');

            const invoiceHtml = await InvoicePdfService.generateHtml((await Invoice.getByID(secondInvoice.id))!);
            expect(invoiceHtml).toContain('Factuur');
            expect(invoiceHtml).toContain('Opmerking');
            expect(invoiceHtml).not.toContain('Aankoopbewijs');
            expect(invoiceHtml).not.toContain('Dit is geen factuur');
        });

        test('a receipt cannot be created for a customer with a company or VAT number', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            for (const company of [
                Company.create({ name: 'BTW-plichtig', VATNumber: 'BE0123456749' }),
                Company.create({ name: 'VZW', companyNumber: '0123456749' }),
            ]) {
                const body = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
                body.addPut(await buildNewInvoice({ organization, customer: PaymentCustomer.create({ company }), isReceipt: true }));

                await expect(patchInvoices({ body, organization, user })).rejects.toThrow(STExpect.errorWithCode('receipt_not_allowed'));
            }

            // A company without numbers is fine
            const body = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
            body.addPut(await buildNewInvoice({ organization, customer: PaymentCustomer.create({ company: Company.create({ name: 'Feitelijke vereniging' }) }), isReceipt: true }));
            const [receipt] = (await patchInvoices({ body, organization, user })).body;
            expect(receipt.number).toBe('BON-000001');
        });

        test('a receipt cannot be created for a paying organization with a company or VAT number', async () => {
            const organization = await new OrganizationFactory({}).create();
            const payingOrganization = await new OrganizationFactory({}).create();
            payingOrganization.meta.companies = [Company.create({ name: 'Paying VZW', companyNumber: '0123456749' })];
            await payingOrganization.save();

            const struct = await buildNewInvoice({ organization, customer: PaymentCustomer.create({}), isReceipt: true });
            struct.payingOrganizationId = payingOrganization.id;

            await expect(InvoiceService.createFrom(organization, struct)).rejects.toThrow(STExpect.errorWithCode('receipt_not_allowed'));
        });
    });

    describe('Deleting invoices', () => {
        test('deletes the invoice, its invoiced balance items and unlinks the payments', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const balanceItem = await createBalanceItem({ organization });
            const invoice = await createInvoice({ organization, balanceItemIds: [balanceItem.id] });
            const payment = await createPayment({ organization, invoice });

            // Sanity check: the balance item is marked as invoiced
            const before = await BalanceItem.getByID(balanceItem.id);
            expect(before!.priceInvoiced).toBe(10_00);

            const body = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
            body.addDelete(invoice.id);

            const response = await patchInvoices({ body, organization, user });
            expect(response.status).toBe(200);

            // Invoice is gone
            expect(await Invoice.getByID(invoice.id)).toBeUndefined();

            // Invoiced balance items are cascade deleted
            const remainingItems = await InvoicedBalanceItem.select().where('invoiceId', invoice.id).fetch();
            expect(remainingItems).toHaveLength(0);

            // Payment is kept but unlinked
            const reloadedPayment = await Payment.getByID(payment.id);
            expect(reloadedPayment).toBeDefined();
            expect(reloadedPayment!.invoiceId).toBeNull();

            // Invoiced cache of the balance item is recalculated
            const after = await BalanceItem.getByID(balanceItem.id);
            expect(after!.priceInvoiced).toBe(0);
        });

        test('user without full access cannot delete invoices', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Read }),
            }).create();

            const balanceItem = await createBalanceItem({ organization });
            const invoice = await createInvoice({ organization, balanceItemIds: [balanceItem.id] });

            const body = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
            body.addDelete(invoice.id);

            await expect(patchInvoices({ body, organization, user })).rejects.toThrow(STExpect.errorWithCode('permission_denied'));

            // Invoice is untouched
            expect(await Invoice.getByID(invoice.id)).toBeDefined();
        });

        test('cannot delete an invoice of another organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const otherOrganization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const balanceItem = await createBalanceItem({ organization: otherOrganization });
            const invoice = await createInvoice({ organization: otherOrganization, balanceItemIds: [balanceItem.id] });

            const body = new PatchableArray() as PatchableArrayAutoEncoder<InvoiceStruct>;
            body.addDelete(invoice.id);

            await expect(patchInvoices({ body, organization, user })).rejects.toThrow(STExpect.errorWithCode('not_found'));

            // Invoice is untouched
            expect(await Invoice.getByID(invoice.id)).toBeDefined();
        });
    });
});
