import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User, Webshop } from '@stamhoofd/models';
import { OrderFactory, OrganizationFactory, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import type { PaginatedResponse, PrivateOrder, StamhoofdFilter } from '@stamhoofd/structures';
import { Cart, Customer, LimitedFilteredRequest, OrderData, PermissionLevel, Permissions, RecordDateAnswer, RecordSettings, RecordType } from '@stamhoofd/structures';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetWebshopOrdersEndpoint } from './GetWebshopOrdersEndpoint.js';

describe('Endpoint.GetWebshopOrdersEndpoint', () => {
    const endpoint = new GetWebshopOrdersEndpoint();

    const getOrders = async ({ filter, organization, user }: { filter: StamhoofdFilter | null; organization: Organization; user: User }) => {
        const token = await Token.createToken(user);

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
});
