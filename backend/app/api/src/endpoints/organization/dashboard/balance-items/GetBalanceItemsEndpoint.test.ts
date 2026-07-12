import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { BalanceItemFactory, GroupFactory, MemberFactory, OrderFactory, OrganizationFactory, RegistrationFactory, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import type { BalanceItem as BalanceItemStruct, PaginatedResponse, StamhoofdFilter } from '@stamhoofd/structures';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemType, LimitedFilteredRequest, PermissionLevel, Permissions, TranslatedString } from '@stamhoofd/structures';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetBalanceItemsEndpoint } from './GetBalanceItemsEndpoint.js';

describe('Endpoint.GetBalanceItemsEndpoint', () => {
    const endpoint = new GetBalanceItemsEndpoint();

    const getBalanceItems = async ({ filter, organization, user }: { filter: StamhoofdFilter | null; organization: Organization; user: User }) => {
        const token = await Token.createToken(user);

        const request = Request.get({
            path: '/balance-items',
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter,
                limit: 100,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return testServer.test<PaginatedResponse<BalanceItemStruct[], LimitedFilteredRequest>>(endpoint, request);
    };

    const createFinanceUser = async (organization: Organization) => {
        return await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    };

    describe('Filtering on the associated webshop', () => {
        test('only returns balance items linked to an order of the given webshop', async () => {
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

            // Negative controls: an order of another webshop and an item without an order
            await new BalanceItemFactory({
                organizationId: organization.id,
                orderId: otherOrder.id,
                type: BalanceItemType.Order,
                amount: 1,
                unitPrice: 10_00,
            }).create();
            await new BalanceItemFactory({
                organizationId: organization.id,
                type: BalanceItemType.Other,
                amount: 1,
                unitPrice: 10_00,
            }).create();

            const response = await getBalanceItems({
                filter: {
                    order: {
                        webshopId: {
                            $in: [webshop.id],
                        },
                    },
                },
                organization,
                user,
            });

            expect(response.status).toBe(200);
            expect(response.body.results.map(r => r.id)).toEqual([matchingItem.id]);
        });
    });

    describe('Filtering on the associated group', () => {
        test('only returns balance items linked to a registration of the given group', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const member = await new MemberFactory({}).create();
            const group = await new GroupFactory({ organization }).create();
            const otherGroup = await new GroupFactory({ organization }).create();

            const registration = await new RegistrationFactory({ member, group }).create();
            const otherRegistration = await new RegistrationFactory({ member, group: otherGroup }).create();

            const matchingItem = await new BalanceItemFactory({
                organizationId: organization.id,
                registrationId: registration.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 10_00,
            }).create();

            // Negative control: a registration for another group
            await new BalanceItemFactory({
                organizationId: organization.id,
                registrationId: otherRegistration.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 10_00,
            }).create();

            const response = await getBalanceItems({
                filter: {
                    registration: {
                        groupId: {
                            $in: [group.id],
                        },
                    },
                },
                organization,
                user,
            });

            expect(response.status).toBe(200);
            expect(response.body.results.map(r => r.id)).toEqual([matchingItem.id]);
        });
    });

    describe('Filtering on the membership type', () => {
        const createMembershipItem = async ({ organization, membershipTypeId }: { organization: Organization; membershipTypeId: string }) => {
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

        test('only returns balance items whose membership type relation matches', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const membershipTypeId = 'membership-type-a';
            const matchingItem = await createMembershipItem({ organization, membershipTypeId });

            // Negative controls: a different membership type and an item without any relation
            await createMembershipItem({ organization, membershipTypeId: 'membership-type-b' });
            await new BalanceItemFactory({
                organizationId: organization.id,
                type: BalanceItemType.Other,
                amount: 1,
                unitPrice: 10_00,
            }).create();

            const response = await getBalanceItems({
                filter: {
                    membershipType: {
                        $in: [membershipTypeId],
                    },
                },
                organization,
                user,
            });

            expect(response.status).toBe(200);
            expect(response.body.results.map(r => r.id)).toEqual([matchingItem.id]);
        });
    });
});
