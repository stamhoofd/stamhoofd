import { Request } from '@simonbackx/simple-endpoints';
import { GroupFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { GroupType, LimitedFilteredRequest, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetOrganizationRegistrationPeriodsEndpoint } from './GetOrganizationRegistrationPeriodsEndpoint.js';

const baseUrl = `/organization/registration-periods`;

describe('Endpoint.GetOrganizationRegistrationPeriods', () => {
    const endpoint = new GetOrganizationRegistrationPeriodsEndpoint();

    let registrationPeriod1: RegistrationPeriod;
    let registrationPeriod2: RegistrationPeriod;

    const get = async (organization: Organization, token: Token) => {
        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                limit: 100,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        return await testServer.test(endpoint, request);
    };

    beforeAll(async () => {
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

    const initOrganization = async (registrationPeriod: RegistrationPeriod) => {
        return await new OrganizationFactory({ period: registrationPeriod })
            .create();
    };

    describe('Groups', () => {
        test('Should contain waiting lists', async () => {
            // arrange
            const organization = await initOrganization(registrationPeriod1);
            const organizationPeriod = await new OrganizationRegistrationPeriodFactory({
                organization,
                period: registrationPeriod1,
            }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            })
                .create();
            const token = await Token.createToken(user);

            const otherOrganization = await initOrganization(registrationPeriod1);

            const waitingList1 = await new GroupFactory({
                organization,
                type: GroupType.WaitingList,
            }).create();

            const waitingList2 = await new GroupFactory({
                organization,
                type: GroupType.WaitingList,
            }).create();

            // waiting list of other organization
            await new GroupFactory({
                organization: otherOrganization,
                type: GroupType.WaitingList,
            }).create();

            const groupWithWaitingList = await new GroupFactory({
                organization,
                waitingListId: waitingList1.id,
            }).create();

            // Make sure the group is in a category of the organization period
            organizationPeriod.settings.rootCategory?.groupIds.push(groupWithWaitingList.id);
            await organizationPeriod.save();

            // act
            const result = await get(organization, token);

            // assert
            expect(result.body).toBeDefined();
            expect(result.body.results.length).toBe(1);
            const organizationPeriodStruct = result.body.results[0];
            const groups = organizationPeriodStruct.groups;
            expect(groups.length).toBe(3);
            expect(groups).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    id: groupWithWaitingList.id,
                }),
                expect.objectContaining({
                    id: waitingList1.id,
                }),
                expect.objectContaining({
                    id: waitingList2.id,
                }),
            ]));
            expect(organizationPeriodStruct.waitingLists.length).toBe(2);
        });

        test('Should not contain groups of other organizations or periods', async () => {
            // arrange
            const period2 = await new RegistrationPeriodFactory({
                startDate: new Date(2022, 0, 1),
                endDate: new Date(2022, 11, 31),
            }).create();

            const period = await new RegistrationPeriodFactory({
                startDate: new Date(2023, 0, 1),
                endDate: new Date(2023, 11, 31),
                previousPeriodId: period2.id,
            }).create();

            const organization = await initOrganization(period);
            period.organizationId = organization.id;
            await period.save();
            period2.organizationId = organization.id;
            await period2.save();

            const organizationPeriod = await new OrganizationRegistrationPeriodFactory({
                organization,
                period,
            }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            })
                .create();

            const token = await Token.createToken(user);

            const group1 = await new GroupFactory({
                organization,
                period,
            }).create();

            const group2 = await new GroupFactory({
                organization,
                period,
            }).create();

            // Make sure the groups are in a category of the organization period
            organizationPeriod.settings.rootCategory?.groupIds.push(group1.id);
            organizationPeriod.settings.rootCategory?.groupIds.push(group2.id);

            await organizationPeriod.save();

            // group list of other organization
            const otherPeriod = await new RegistrationPeriodFactory({
                startDate: new Date(2023, 0, 1),
                endDate: new Date(2023, 11, 31),
            }).create();

            const otherOrganization = await initOrganization(otherPeriod);
            otherPeriod.organizationId = otherOrganization.id;
            await otherPeriod.save();

            const otherOrganizationPeriod = await new OrganizationRegistrationPeriodFactory({
                organization: otherOrganization,
                period: otherPeriod,
            }).create();

            const otherGroup1 = await new GroupFactory({
                organization: otherOrganization,
                period: otherPeriod,
            }).create();

            // Add the group to the other organization's period
            otherOrganizationPeriod.settings.rootCategory?.groupIds.push(otherGroup1.id);
            await otherOrganizationPeriod.save();

            // group of other period
            await new GroupFactory({
                organization,
                period: period2,
            }).create();

            // act
            const result = await get(organization, token);

            // assert
            expect(result.body).toBeDefined();
            expect(result.body.results.length).toBe(1);
            const groups = result.body.results[0].groups;
            expect(groups.length).toBe(2);
            expect(groups).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    id: group1.id,
                }),
                expect.objectContaining({
                    id: group2.id,
                }),
            ]));
        });
    });
});
