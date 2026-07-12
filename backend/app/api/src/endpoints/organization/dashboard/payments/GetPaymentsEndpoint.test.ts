import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, BalanceItemPayment, OrderFactory, OrganizationFactory, Payment, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import type { PaginatedResponse, PaymentGeneral, StamhoofdFilter } from '@stamhoofd/structures';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemType, LimitedFilteredRequest, PaymentMethod, PaymentStatus, PermissionLevel, Permissions, TranslatedString } from '@stamhoofd/structures';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetPaymentsEndpoint } from './GetPaymentsEndpoint.js';

// These tests exercise the balance-item filters reused inside the payments query (balanceItemPayments ->
// balanceItem -> ...), which is the path where balance_items is joined into another query.
describe('Endpoint.GetPaymentsEndpoint', () => {
    const endpoint = new GetPaymentsEndpoint();

    const getPayments = async ({ filter, organization, user }: { filter: StamhoofdFilter | null; organization: Organization; user: User }) => {
        const token = await Token.createToken(user);

        const request = Request.get({
            path: '/payments',
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter,
                limit: 100,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return testServer.test<PaginatedResponse<PaymentGeneral[], LimitedFilteredRequest>>(endpoint, request);
    };

    const createFinanceUser = async (organization: Organization) => {
        return await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    };

    const createPaymentForBalanceItem = async (organization: Organization, balanceItem: BalanceItem) => {
        const payment = new Payment();
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Succeeded;
        payment.organizationId = organization.id;
        payment.price = 10_00;
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.price = 10_00;
        balanceItemPayment.organizationId = organization.id;
        await balanceItemPayment.save();

        return payment;
    };

    describe('Filtering on the balance item of a payment', () => {
        test('only returns payments whose balance item is linked to an order of the given webshop', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
            const otherWebshop = await new WebshopFactory({ organizationId: organization.id }).create();

            const order = await new OrderFactory({ webshop }).create();
            const otherOrder = await new OrderFactory({ webshop: otherWebshop }).create();

            const matchingItem = await new BalanceItemFactory({
                organizationId: organization.id,
                orderId: order.id,
                type: BalanceItemType.Order,
                amount: 1,
                unitPrice: 10_00,
            }).create();
            const matchingPayment = await createPaymentForBalanceItem(organization, matchingItem);

            // Negative control: a payment for a balance item of another webshop's order
            const otherItem = await new BalanceItemFactory({
                organizationId: organization.id,
                orderId: otherOrder.id,
                type: BalanceItemType.Order,
                amount: 1,
                unitPrice: 10_00,
            }).create();
            await createPaymentForBalanceItem(organization, otherItem);

            const response = await getPayments({
                filter: {
                    balanceItemPayments: {
                        $elemMatch: {
                            balanceItem: {
                                order: {
                                    webshopId: {
                                        $in: [webshop.id],
                                    },
                                },
                            },
                        },
                    },
                },
                organization,
                user,
            });

            expect(response.status).toBe(200);
            expect(response.body.results.map(r => r.id)).toEqual([matchingPayment.id]);
        });

        test('only returns payments whose balance item matches the given membership type', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const createMembershipItem = async (membershipTypeId: string) => {
                return await new BalanceItemFactory({
                    organizationId: organization.id,
                    type: BalanceItemType.PlatformMembership,
                    amount: 1,
                    unitPrice: 10_00,
                    relations: new Map([
                        [
                            BalanceItemRelationType.MembershipType,
                            BalanceItemRelation.create({
                                id: membershipTypeId,
                                name: new TranslatedString('Membership type'),
                            }),
                        ],
                    ]),
                }).create();
            };

            const matchingItem = await createMembershipItem('membership-type-a');
            const matchingPayment = await createPaymentForBalanceItem(organization, matchingItem);

            // Negative control: a payment for a balance item with a different membership type
            const otherItem = await createMembershipItem('membership-type-b');
            await createPaymentForBalanceItem(organization, otherItem);

            const response = await getPayments({
                filter: {
                    balanceItemPayments: {
                        $elemMatch: {
                            balanceItem: {
                                membershipType: {
                                    $in: ['membership-type-a'],
                                },
                            },
                        },
                    },
                },
                organization,
                user,
            });

            expect(response.status).toBe(200);
            expect(response.body.results.map(r => r.id)).toEqual([matchingPayment.id]);
        });
    });
});
