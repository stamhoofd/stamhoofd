import { Request } from '@node/endpoints';
import type { Organization, User, Webshop } from '@stamhoofd/models';
import { OrderFactory, OrganizationFactory, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import type { CountResponse, PaginatedResponse, PrivateOrder, StamhoofdFilter } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { PermissionsResourceType } from '@stamhoofd/types/PermissionsResourceType';
import { Cart, CountFilteredRequest, Customer, LimitedFilteredRequest, OrderData, Permissions, PermissionsResourceKey, RecordDateAnswer, RecordSettings, RecordType, ResourcePermissions } from '@stamhoofd/structures';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetWebshopOrdersCountEndpoint } from './GetWebshopOrdersCountEndpoint.js';
import { GetWebshopOrdersEndpoint } from './GetWebshopOrdersEndpoint.js';
import { SessionService } from '../../../../services/SessionService.js';

describe('Endpoint.GetWebshopOrdersEndpoint', () => {
    const endpoint = new GetWebshopOrdersEndpoint();
    const countEndpoint = new GetWebshopOrdersCountEndpoint();

    const getOrders = async ({ filter, organization, user }: { filter: StamhoofdFilter | null; organization: Organization; user: User }) => {
        const token = await SessionService.createSession(user);

        const request = Request.get({
            path: '/webshop/orders',
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter,
                limit: 100,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return testServer.test<PaginatedResponse<PrivateOrder[], LimitedFilteredRequest>>(endpoint, request);
    };

    const countOrders = async ({ filter, organization, user }: { filter: StamhoofdFilter | null; organization: Organization; user: User }) => {
        const token = await SessionService.createSession(user);

        const request = Request.get({
            path: '/webshop/orders/count',
            host: organization.getApiHost(),
            query: new CountFilteredRequest({ filter }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return testServer.test<CountResponse>(countEndpoint, request);
    };

    const createOrderWithDateAnswer = async ({ webshop, record, dateValue }: { webshop: Webshop; record: RecordSettings; dateValue: Date | null }) => {
        const answer = RecordDateAnswer.create({ settings: record });
        answer.dateValue = dateValue;

        const data = OrderData.create({
            customer: Customer.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
            }),
            cart: Cart.create({}),
        });
        data.recordAnswers.set(record.id, answer);

        return await new OrderFactory({ webshop, data }).create();
    };

    describe('Filtering on record answers', () => {
        test('filters orders on the date of a date record answer', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

            const record = RecordSettings.create({ type: RecordType.Date });

            // The order we are looking for: answered with a time of day that is not midnight
            const matchingOrder = await createOrderWithDateAnswer({
                webshop,
                record,
                dateValue: new Date(2023, 5, 10, 14, 30, 15),
            });

            // Answered with a different date
            await createOrderWithDateAnswer({
                webshop,
                record,
                dateValue: new Date(2023, 5, 11, 14, 30, 15),
            });

            // Did not answer the question
            await createOrderWithDateAnswer({
                webshop,
                record,
                dateValue: null,
            });

            // Does not have the record answer at all
            await new OrderFactory({ webshop }).create();

            const response = await getOrders({
                organization,
                user,
                filter: {
                    recordAnswers: {
                        [record.id]: {
                            // Same filter as the date filter in the UI builds for 'equals'
                            $and: [
                                {
                                    dateValue: {
                                        $gte: new Date(2023, 5, 10),
                                    },
                                },
                                {
                                    dateValue: {
                                        $lte: new Date(2023, 5, 10, 23, 59, 59, 999),
                                    },
                                },
                            ],
                        },
                    },
                },
            });

            expect(response.status).toBe(200);
            expect(response.body.results).toIncludeSameMembers([
                expect.objectContaining({ id: matchingOrder.id }),
            ]);
        });
    });

    describe('Permissions', () => {
        test('orders of webshops the admin cannot access are not listed or counted', async () => {
            const organization = await new OrganizationFactory({}).create();
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
            const otherWebshop = await new WebshopFactory({ organizationId: organization.id }).create();

            const order = await new OrderFactory({ webshop }).create();
            const ownOrder = await new OrderFactory({ webshop: otherWebshop }).create();

            const otherAdmin = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([
                        [PermissionsResourceType.Webshops, new Map([[otherWebshop.id, ResourcePermissions.create({ level: PermissionLevel.Full })]])],
                    ]),
                }),
            }).create();

            // Responses must not depend on whether the filter matches orders of the inaccessible webshop
            const filters: StamhoofdFilter[] = [
                { webshopId: webshop.id },
                { id: order.id },
                { webshopId: webshop.id, email: { $neq: null } },
            ];
            for (const filter of filters) {
                const response = await getOrders({ organization, user: otherAdmin, filter });
                expect(response.body.results).toEqual([]);

                const count = await countOrders({ organization, user: otherAdmin, filter });
                expect(count.body.count).toBe(0);
            }

            const response = await getOrders({ organization, user: otherAdmin, filter: null });
            expect(response.body.results).toEqual([expect.objectContaining({ id: ownOrder.id })]);

            const count = await countOrders({ organization, user: otherAdmin, filter: null });
            expect(count.body.count).toBe(1);
        });

        test('an admin with access to all webshops sees the orders of every webshop', async () => {
            const organization = await new OrganizationFactory({}).create();
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
            const otherWebshop = await new WebshopFactory({ organizationId: organization.id }).create();

            const order = await new OrderFactory({ webshop }).create();
            const otherOrder = await new OrderFactory({ webshop: otherWebshop }).create();

            const admin = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([
                        [PermissionsResourceType.Webshops, new Map([[PermissionsResourceKey.All, ResourcePermissions.create({ level: PermissionLevel.Read })]])],
                    ]),
                }),
            }).create();

            const response = await getOrders({ organization, user: admin, filter: null });
            expect(response.body.results).toIncludeSameMembers([
                expect.objectContaining({ id: order.id }),
                expect.objectContaining({ id: otherOrder.id }),
            ]);

            const count = await countOrders({ organization, user: admin, filter: null });
            expect(count.body.count).toBe(2);
        });
    });
});
