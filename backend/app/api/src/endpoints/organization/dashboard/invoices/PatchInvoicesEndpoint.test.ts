import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, Invoice, InvoicedBalanceItem, OrganizationFactory, Payment, Token, UserFactory } from '@stamhoofd/models';
import type { InvoiceStruct } from '@stamhoofd/structures';
import { PaymentMethod, PaymentStatus, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchInvoicesEndpoint } from './PatchInvoicesEndpoint.js';

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
        const token = await Token.createToken(user);
        const request = Request.buildJson('PATCH', '/invoices', organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test<InvoiceStruct[]>(endpoint, request);
    };

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
