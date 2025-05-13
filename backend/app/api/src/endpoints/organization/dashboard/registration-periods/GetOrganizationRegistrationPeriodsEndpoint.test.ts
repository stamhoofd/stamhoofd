import { Request } from '@simonbackx/simple-endpoints';
import { GroupFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { GroupType, PermissionLevel, Permissions, Version } from '@stamhoofd/structures';
import { testServer } from '../../../../../tests/helpers/TestServer';
import { GetOrganizationRegistrationPeriodsEndpoint } from './GetOrganizationRegistrationPeriodsEndpoint';

const baseUrl = `/v${Version}/organization/registration-periods`;

describe('Endpoint.GetOrganizationRegistrationPeriods', () => {
    const endpoint = new GetOrganizationRegistrationPeriodsEndpoint();

    let registrationPeriod1: RegistrationPeriod;
    let registrationPeriod2: RegistrationPeriod;

    const get = async (organization: Organization, token: Token) => {
        const request = Request.buildJson('GET', baseUrl, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
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

    describe('groups', () => {
        test('Should contain waiting lists', async () => {
            // arrange
            const organization = await initOrganization(registrationPeriod1);
            await new OrganizationRegistrationPeriodFactory({
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
            }).create();

            groupWithWaitingList.waitingListId = waitingList1.id;
            await groupWithWaitingList.save();

            // act
            const result = await get(organization, token);

            // assert
            expect(result.body).toBeDefined();
            expect(result.body.organizationPeriods.length).toBe(1);
            const organizationPeriod = result.body.organizationPeriods[0];
            const groups = organizationPeriod.groups;
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
            expect(organizationPeriod.waitingLists.length).toBe(2);
        });

        test('Should contain only groups of the organization registration period', async () => {
            // arrange
            const organization = await initOrganization(registrationPeriod1);
            await new OrganizationRegistrationPeriodFactory({
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

            const group1 = await new GroupFactory({
                organization,
                period: registrationPeriod1,
            }).create();

            const group2 = await new GroupFactory({
                organization,
                period: registrationPeriod1,
            }).create();

            // group list of other organization
            const otherOrganization = await initOrganization(registrationPeriod1);

            await new GroupFactory({
                organization: otherOrganization,
            }).create();

            // group of other period
            await new GroupFactory({
                organization,
                period: registrationPeriod2,
            }).create();

            // act
            const result = await get(organization, token);

            // assert
            expect(result.body).toBeDefined();
            expect(result.body.organizationPeriods.length).toBe(1);
            const groups = result.body.organizationPeriods[0].groups;
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
