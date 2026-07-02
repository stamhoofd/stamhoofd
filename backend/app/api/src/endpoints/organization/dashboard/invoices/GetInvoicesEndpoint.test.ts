import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { BalanceItemFactory, Invoice, InvoicedBalanceItem, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import type { InvoiceStruct, PaginatedResponse, StamhoofdFilter } from '@stamhoofd/structures';
import { LimitedFilteredRequest, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetInvoicesEndpoint } from './GetInvoicesEndpoint.js';

describe('Endpoint.GetInvoicesEndpoint', () => {
    const endpoint = new GetInvoicesEndpoint();

    const createBalanceItem = async ({ organization }: { organization: Organization }) => {
        return await new BalanceItemFactory({
            organizationId: organization.id,
            amount: 1,
            unitPrice: 10_00,
        }).create();
    };

    const createInvoice = async ({ organization, balanceItemIds }: { organization: Organization; balanceItemIds: string[] }) => {
        const invoice = new Invoice();
        invoice.organizationId = organization.id;
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

        return invoice;
    };

    const getInvoices = async ({ filter, organization, user }: { filter: StamhoofdFilter | null; organization: Organization; user: User }) => {
        const token = await Token.createToken(user);

        const request = Request.get({
            path: '/invoices',
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter,
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return testServer.test<PaginatedResponse<InvoiceStruct[], LimitedFilteredRequest>>(endpoint, request);
    };

    describe('Filtering on balance item', () => {
        test('only returns invoices that invoiced the balance item', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const balanceItemId1 = (await createBalanceItem({ organization })).id;
            const balanceItemId2 = (await createBalanceItem({ organization })).id;

            const invoiceWithBothItems = await createInvoice({ organization, balanceItemIds: [balanceItemId1, balanceItemId2] });
            const invoiceWithSecondItem = await createInvoice({ organization, balanceItemIds: [balanceItemId2] });
            const invoiceWithoutItems = await createInvoice({ organization, balanceItemIds: [] });

            const response = await getInvoices({
                filter: {
                    items: {
                        $elemMatch: {
                            balanceItemId: balanceItemId1,
                        },
                    },
                },
                organization,
                user,
            });

            expect(response.status).toBe(200);
            expect(response.body.results.map(r => r.id)).toEqual([invoiceWithBothItems.id]);

            const response2 = await getInvoices({
                filter: {
                    items: {
                        $elemMatch: {
                            balanceItemId: balanceItemId2,
                        },
                    },
                },
                organization,
                user,
            });

            expect(response2.status).toBe(200);
            expect(response2.body.results.map(r => r.id).sort()).toEqual([invoiceWithBothItems.id, invoiceWithSecondItem.id].sort());
            expect(response2.body.results.map(r => r.id)).not.toContain(invoiceWithoutItems.id);
        });

        test('does not return invoices of other organizations for the same balance item', async () => {
            const organization = await new OrganizationFactory({}).create();
            const otherOrganization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const balanceItemId = (await createBalanceItem({ organization: otherOrganization })).id;
            await createInvoice({ organization: otherOrganization, balanceItemIds: [balanceItemId] });

            const response = await getInvoices({
                filter: {
                    items: {
                        $elemMatch: {
                            balanceItemId,
                        },
                    },
                },
                organization,
                user,
            });

            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(0);
        });
    });

    describe('Permission checking', () => {
        test('user without finance permissions cannot list invoices', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Read }),
            }).create();

            await expect(getInvoices({
                filter: null,
                organization,
                user,
            })).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        });
    });
});
