import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, BalanceItemPayment, OrderFactory, OrganizationFactory, Payment, StripeAccount, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import type { PaginatedResponse, PaymentGeneral, StamhoofdFilter } from '@stamhoofd/structures';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemType, LimitedFilteredRequest, PaymentMethod, PaymentProvider, PaymentStatus, PermissionLevel, Permissions, TranslatedString } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { SettlementService } from '../../../../services/SettlementService.js';
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

    describe('Settlements of a payment', () => {
        const createSettledPayment = async (organization: Organization) => {
            const payment = new Payment();
            payment.method = PaymentMethod.Bancontact;
            payment.provider = PaymentProvider.Stripe;
            payment.status = PaymentStatus.Succeeded;
            payment.organizationId = organization.id;
            payment.price = 50_00_00;
            payment.paidAt = new Date();
            await payment.save();

            const settlement = await SettlementService.upsertSettlement({
                provider: PaymentProvider.Stripe,
                externalId: 'po_' + payment.id,
                organizationId: organization.id,
                reference: 'STRIPE PAYOUT',
                amount: 49_00_00,
                settledAt: new Date(2026, 0, 15),
            });
            await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id,
                amount: 50_00_00,
                externalId: 'txn_' + payment.id,
                occurredAt: new Date(2026, 0, 14),
            });

            return { payment, settlement };
        };

        test('the m2m settlement filter selects only payments in a matching payout', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const { payment, settlement } = await createSettledPayment(organization);

            // Negative control: a payment without settlement rows
            const other = new Payment();
            other.method = PaymentMethod.Bancontact;
            other.provider = PaymentProvider.Stripe;
            other.status = PaymentStatus.Succeeded;
            other.organizationId = organization.id;
            other.price = 10_00_00;
            await other.save();

            const response = await getPayments({
                filter: {
                    settlements: {
                        $elemMatch: {
                            settlement: {
                                externalId: settlement.externalId,
                            },
                        },
                    },
                },
                organization,
                user,
            });

            expect(response.status).toBe(200);
            expect(response.body.results.map(r => r.id)).toEqual([payment.id]);
        });

        test('an admin of the organization receives the settlements of a payment', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const { payment, settlement } = await createSettledPayment(organization);

            const response = await getPayments({
                filter: { id: payment.id },
                organization,
                user,
            });

            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(1);

            const result = response.body.results[0];
            expect(result.settlements).toHaveLength(1);
            expect(result.settlements[0]).toMatchObject({
                paymentId: payment.id,
                amount: 50_00_00,
                externalId: 'txn_' + payment.id,
            });
            expect(result.settlements[0].settlement).toMatchObject({
                externalId: settlement.externalId,
                reference: 'STRIPE PAYOUT',
                amount: 49_00_00,
            });
        });

        test('the platform payout of a destination charge is never returned to the organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const stripeAccount = new StripeAccount();
            stripeAccount.organizationId = organization.id;
            stripeAccount.accountId = 'acct_' + uuidv4();
            await stripeAccount.save();

            const payment = new Payment();
            payment.method = PaymentMethod.Bancontact;
            payment.provider = PaymentProvider.Stripe;
            payment.status = PaymentStatus.Succeeded;
            payment.organizationId = organization.id;
            payment.stripeAccountId = stripeAccount.id;
            payment.price = 50_00_00;
            payment.paidAt = new Date();
            await payment.save();

            const organizationPayout = await SettlementService.upsertSettlement({
                provider: PaymentProvider.Stripe,
                externalId: 'po_org_' + payment.id,
                stripeAccountId: stripeAccount.id,
                organizationId: organization.id,
                amount: 49_00_00,
                settledAt: new Date(2026, 0, 15),
            });
            await SettlementService.upsertPaymentLine(organizationPayout, {
                paymentId: payment.id, amount: 50_00_00, externalId: 'txn_org_' + payment.id, occurredAt: new Date(2026, 0, 14),
            });

            // The same gross charge also sits in our platform payout, owned by the membership
            // organization
            const membershipOrganization = await new OrganizationFactory({}).create();
            const platformPayout = await SettlementService.upsertSettlement({
                provider: PaymentProvider.Stripe,
                externalId: 'po_platform_' + payment.id,
                stripeAccountId: null,
                organizationId: membershipOrganization.id,
                amount: 1234_00_00,
                settledAt: new Date(2026, 0, 12),
            });
            await SettlementService.upsertPaymentLine(platformPayout, {
                paymentId: payment.id, amount: 50_00_00, externalId: 'txn_platform_' + payment.id, occurredAt: new Date(2026, 0, 11),
            });

            const response = await getPayments({ filter: { id: payment.id }, organization, user });

            expect(response.status).toBe(200);
            const result = response.body.results[0];
            expect(result.settlements).toHaveLength(1);
            expect(result.settlements[0].settlement.externalId).toBe(organizationPayout.externalId);
        });
    });
});
