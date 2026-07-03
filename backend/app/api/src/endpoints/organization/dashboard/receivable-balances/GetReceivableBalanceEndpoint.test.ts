import { Request } from '@simonbackx/simple-endpoints';
import type { BalanceItem, Organization, User } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, Invoice, InvoicedBalanceItem, MemberFactory, OrganizationFactory, Payment, Token, UserFactory } from '@stamhoofd/models';
import type { DetailedReceivableBalance } from '@stamhoofd/structures';
import { PaymentMethod, PaymentStatus, PermissionLevel, Permissions, ReceivableBalanceType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetReceivableBalanceEndpoint } from './GetReceivableBalanceEndpoint.js';

describe('Endpoint.GetReceivableBalanceEndpoint', () => {
    const endpoint = new GetReceivableBalanceEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    const createPayment = async ({ organization, balanceItems, invoiceId }: { organization: Organization; balanceItems: BalanceItem[]; invoiceId?: string | null }) => {
        const payment = new Payment();
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Succeeded;
        payment.organizationId = organization.id;
        payment.price = balanceItems.reduce((sum, b) => sum + b.price, 0);
        payment.invoiceId = invoiceId ?? null;
        await payment.save();

        for (const balanceItem of balanceItems) {
            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.price = balanceItem.price;
            balanceItemPayment.organizationId = organization.id;
            await balanceItemPayment.save();
        }

        return payment;
    };

    const createInvoice = async ({ organization, balanceItems, payingOrganizationId }: { organization: Organization; balanceItems?: BalanceItem[]; payingOrganizationId?: string | null }) => {
        const invoice = new Invoice();
        invoice.organizationId = organization.id;
        invoice.payingOrganizationId = payingOrganizationId ?? null;
        await invoice.save();

        for (const balanceItem of balanceItems ?? []) {
            const item = new InvoicedBalanceItem();
            item.organizationId = organization.id;
            item.invoiceId = invoice.id;
            item.balanceItemId = balanceItem.id;
            item.name = 'Test item';
            item.unitPrice = balanceItem.unitPrice;
            item.balanceInvoicedAmount = balanceItem.price;
            await item.save();
        }

        return invoice;
    };

    const getReceivableBalance = async ({ type, id, organization, user }: { type: ReceivableBalanceType; id: string; organization: Organization; user: User }) => {
        const token = await Token.createToken(user);

        const request = Request.get({
            path: `/receivable-balances/${type}/${id}`,
            host: organization.getApiHost(),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return testServer.test<DetailedReceivableBalance>(endpoint, request);
    };

    const createAdmin = async (organization: Organization) => {
        return await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    };

    describe('Invoices of a member receivable balance', () => {
        test('returns invoices that invoiced a balance item of the member, and marks the payments as invoiced', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await createAdmin(organization);
            const member = await new MemberFactory({ organization }).create();
            const otherMember = await new MemberFactory({ organization }).create();

            const balanceItem = await new BalanceItemFactory({
                organizationId: organization.id,
                memberId: member.id,
                amount: 1,
                unitPrice: 50_00,
            }).create();

            const otherBalanceItem = await new BalanceItemFactory({
                organizationId: organization.id,
                memberId: otherMember.id,
                amount: 1,
                unitPrice: 10_00,
            }).create();

            const invoice = await createInvoice({ organization, balanceItems: [balanceItem] });
            const otherInvoice = await createInvoice({ organization, balanceItems: [otherBalanceItem] });

            const invoicedPayment = await createPayment({ organization, balanceItems: [balanceItem], invoiceId: invoice.id });
            const notInvoicedPayment = await createPayment({ organization, balanceItems: [balanceItem] });

            const response = await getReceivableBalance({
                type: ReceivableBalanceType.member,
                id: member.id,
                organization,
                user: admin,
            });

            expect(response.status).toBe(200);
            expect(response.body.invoices.map(i => i.id)).toEqual([invoice.id]);
            expect(response.body.invoices.map(i => i.id)).not.toContain(otherInvoice.id);

            const payments = response.body.payments;
            expect(payments.find(p => p.id === invoicedPayment.id)?.invoiceId).toBe(invoice.id);
            expect(payments.find(p => p.id === notInvoicedPayment.id)?.invoiceId).toBeNull();
        });
    });

    describe('Invoices of an organization receivable balance', () => {
        test('returns invoices via the paying organization and via invoiced balance items, without duplicates', async () => {
            const organization = await new OrganizationFactory({}).create();
            const payingOrganization = await new OrganizationFactory({}).create();
            const admin = await createAdmin(organization);

            const balanceItem = await new BalanceItemFactory({
                organizationId: organization.id,
                payingOrganizationId: payingOrganization.id,
                amount: 1,
                unitPrice: 50_00,
            }).create();

            // Linked both directly and via the invoiced balance item: should only be returned once
            const invoiceViaBoth = await createInvoice({ organization, balanceItems: [balanceItem], payingOrganizationId: payingOrganization.id });

            // Only linked via the invoiced balance item: the invoice itself has no payingOrganizationId,
            // so it can only be found through the balance item that belongs to the paying organization
            const invoiceViaItemOnly = await createInvoice({ organization, balanceItems: [balanceItem], payingOrganizationId: null });

            // Only linked directly to the paying organization (no invoiced balance items)
            const directInvoice = await createInvoice({ organization, payingOrganizationId: payingOrganization.id });

            // Invoice of another paying organization
            const otherPayingOrganization = await new OrganizationFactory({}).create();
            const otherInvoice = await createInvoice({ organization, payingOrganizationId: otherPayingOrganization.id });

            const response = await getReceivableBalance({
                type: ReceivableBalanceType.organization,
                id: payingOrganization.id,
                organization,
                user: admin,
            });

            expect(response.status).toBe(200);
            expect(response.body.invoices.map(i => i.id).sort()).toEqual([invoiceViaBoth.id, invoiceViaItemOnly.id, directInvoice.id].sort());
            expect(response.body.invoices.map(i => i.id)).not.toContain(otherInvoice.id);
        });

        test('does not return invoices of a different selling organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const otherOrganization = await new OrganizationFactory({}).create();
            const payingOrganization = await new OrganizationFactory({}).create();
            const admin = await createAdmin(organization);

            await createInvoice({ organization: otherOrganization, payingOrganizationId: payingOrganization.id });

            const response = await getReceivableBalance({
                type: ReceivableBalanceType.organization,
                id: payingOrganization.id,
                organization,
                user: admin,
            });

            expect(response.status).toBe(200);
            expect(response.body.invoices).toHaveLength(0);
        });
    });

    describe('Invoices of a user receivable balance', () => {
        test('returns invoices that invoiced a balance item of the user', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await createAdmin(organization);
            const user = await new UserFactory({ organization }).create();

            const balanceItem = await new BalanceItemFactory({
                organizationId: organization.id,
                userId: user.id,
                amount: 1,
                unitPrice: 25_00,
            }).create();

            const invoice = await createInvoice({ organization, balanceItems: [balanceItem] });
            await createPayment({ organization, balanceItems: [balanceItem], invoiceId: invoice.id });

            const response = await getReceivableBalance({
                type: ReceivableBalanceType.user,
                id: user.id,
                organization,
                user: admin,
            });

            expect(response.status).toBe(200);
            expect(response.body.invoices.map(i => i.id)).toEqual([invoice.id]);
        });
    });
});
