import { Request } from '@simonbackx/simple-endpoints';
import { GroupFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { BundleDiscountGroupPriceSettings, GroupPrice, GroupType, LimitedFilteredRequest, StamhoofdFilter } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initAdmin, initBundleDiscount, initPlatformAdmin } from '../../../../tests/init/index.js';
import { GetGroupsEndpoint } from './GetGroupsEndpoint.js';
import { Database } from '@simonbackx/simple-database';

const baseUrl = `/groups`;

describe('Endpoint.GetGroupsEndpoint', () => {
    const endpoint = new GetGroupsEndpoint();

    let registrationPeriod1: RegistrationPeriod;
    let registrationPeriod2: RegistrationPeriod;

    const get = async ({ organization, token, filter }: { organization?: Organization; token: Token; filter?: StamhoofdFilter }) => {
        const request = Request.get({
            path: baseUrl,
            host: organization?.getApiHost() ?? '',
            query: new LimitedFilteredRequest({
                limit: 100,
                filter,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        return (await testServer.test(endpoint, request)).body.results;
    };

    beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        registrationPeriod2 = await new RegistrationPeriodFactory({
            startDate: new Date(2022, 0, 1),
            endDate: new Date(2022, 11, 31),
        }).create();

        registrationPeriod1 = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
            previousPeriodId: registrationPeriod2.id,
        }).create();
    });

    afterEach(async () => {
        await Database.delete('DELETE FROM `groups`');
    });

    const initOrganization = async (registrationPeriod: RegistrationPeriod) => {
        const organization = await new OrganizationFactory({ period: registrationPeriod })
            .create();

        const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({
            organization,
            period: registrationPeriod1,
        }).create();

        return { organization, organizationRegistrationPeriod };
    };

    async function initTest() {
        const { organization, organizationRegistrationPeriod } = await initOrganization(registrationPeriod1);
        const { organization: otherOrganization } = await initOrganization(registrationPeriod1);

        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);

        const waitingList = await new GroupFactory({
            organization,
            type: GroupType.WaitingList,
        }).create();

        const event = await new GroupFactory({
            organization,
            type: GroupType.EventRegistration,
        }).create();

        const group = await new GroupFactory({
            organization,
            type: GroupType.Membership,
        }).create();

        // Create a group that should not be returned
        const otherGroup = await new GroupFactory({
            organization: otherOrganization,
            type: GroupType.Membership,
        }).create();

        return { organizationRegistrationPeriod, organization, token, waitingList, event, group, otherGroup };
    }

    it('Can return all groups for an organization', async () => {
        const { organization, token, waitingList, event, group } = await initTest();
        const result = await get({ organization, token });
        expect(result).toHaveLength(3);
        expect(result).toIncludeSameMembers([
            expect.objectContaining({
                id: waitingList.id,
            }),
            expect.objectContaining({
                id: event.id,
            }),
            expect.objectContaining({
                id: group.id,
            }),
        ]);
    });

    it('Can return all groups to a platform admin', async () => {
        const { waitingList, event, group, otherGroup } = await initTest();
        const { adminToken } = await initPlatformAdmin();

        const result = await get({ token: adminToken });
        expect(result).toHaveLength(4);
        expect(result).toIncludeSameMembers([
            expect.objectContaining({
                id: waitingList.id,
            }),
            expect.objectContaining({
                id: event.id,
            }),
            expect.objectContaining({
                id: group.id,
            }),
            expect.objectContaining({
                id: otherGroup.id,
            }),
        ]);
    });

    it('Cannot return all groups to a normal admin', async () => {
        const { organization } = await initTest();
        const { adminToken } = await initAdmin({ organization });
        await expect(get({ token: adminToken })).rejects.toThrow(STExpect.simpleError({ code: 'permission_denied' }));
    });

    it('Can return a group by ID for an organization', async () => {
        const { organization, token, group } = await initTest();
        const result = await get({
            organization,
            token,
            filter: {
                id: group.id,
            },
        });
        expect(result).toIncludeSameMembers([
            expect.objectContaining({
                id: group.id,
            }),
        ]);
    });

    it('Can return a group by bundle discount id', async () => {
        const { organizationRegistrationPeriod, organization, token, group, event } = await initTest();
        const bundleDiscount = await initBundleDiscount({ organizationRegistrationPeriod, discount: {} });

        // Add a price to event with a bundle discount
        const eventGroupPriceAdded = GroupPrice.create({
            bundleDiscounts: new Map([
                [bundleDiscount.id, BundleDiscountGroupPriceSettings.create({ name: bundleDiscount.name })],
            ]),
        });
        event.settings.prices.push(eventGroupPriceAdded);
        await event.save();

        // Set the main group price to the group
        group.settings.prices[0].bundleDiscounts.set(bundleDiscount.id, BundleDiscountGroupPriceSettings.create({
            name: bundleDiscount.name,
        }));
        await group.save();

        const result = await get({
            organization,
            token,
            filter: {
                bundleDiscounts: {
                    [bundleDiscount.id]: {
                        $neq: null,
                    },
                },
            },
        });
        expect(result).toIncludeSameMembers([
            expect.objectContaining({
                id: event.id,
            }),
            expect.objectContaining({
                id: group.id,
            }),
        ]);
    });

    it('Safely escapes ids', async () => {
        const { organizationRegistrationPeriod, organization, token, group, event } = await initTest();
        const bundleDiscount = await initBundleDiscount({ organizationRegistrationPeriod, discount: {} });
        const id = `This Id. contains "[10] and .**' inside of it... \\"\\'"'`;
        const differentId = `This Id. contains "[10] and .**' inside of it... "\\'"'`;

        // Add a price to event with a bundle discount
        const eventGroupPriceAdded = GroupPrice.create({
            bundleDiscounts: new Map([
                [id, BundleDiscountGroupPriceSettings.create({ name: bundleDiscount.name })],
            ]),
        });
        event.settings.prices.push(eventGroupPriceAdded);
        await event.save();

        // Set the main group price to the group
        group.settings.prices[0].bundleDiscounts.set(differentId, BundleDiscountGroupPriceSettings.create({
            name: bundleDiscount.name,
        }));
        await group.save();

        const result = await get({
            organization,
            token,
            filter: {
                bundleDiscounts: {
                    [id]: {
                        $neq: null,
                    },
                },
            },
        });
        expect(result).toIncludeSameMembers([
            expect.objectContaining({
                id: event.id,
            }),
        ]);
    });
});
