import { Request, Response } from '@simonbackx/simple-endpoints';
import { MemberFactory, Organization, OrganizationFactory, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { AccessRight, BalanceItemWithPayments, ChargeMembersRequest, LimitedFilteredRequest, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions, StamhoofdFilter, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { ChargeMembersEndpoint } from '../../src/endpoints/admin/members/ChargeMembersEndpoint';
import { GetMemberBalanceEndpoint } from '../../src/endpoints/organization/dashboard/payments/GetMemberBalanceEndpoint';
import { testServer } from '../helpers/TestServer';

describe('E2E.ChargeMembers', () => {
    const chargeMembersEndpoint = new ChargeMembersEndpoint();
    const memberBalanceEndpoint = new GetMemberBalanceEndpoint();
    let period: RegistrationPeriod;
    let organization: Organization;
    let otherOrganization: Organization;
    let financialDirector: User;
    let financialDirectorToken: Token;
    let financialDirectorRole: PermissionRoleDetailed;
    let financialDirectorRoleOfOtherOrganization: PermissionRoleDetailed;

    const postCharge = async (filter: StamhoofdFilter, organization: Organization, body: ChargeMembersRequest, token: Token) => {
        const request = Request.buildJson('POST', `/v${Version}/admin/charge-members`, organization.getApiHost(), body);
        const filterRequest = new LimitedFilteredRequest({
            filter,
            limit: 100,
        });
        request.query = filterRequest.encode({ version: Version }) as any;
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(chargeMembersEndpoint, request);
    };

    const getBalance = async (memberId: string, organization: Organization, token: Token): Promise<Response<BalanceItemWithPayments[]>> => {
        const request = Request.buildJson('GET', `/v${Version}/organization/members/${memberId}/balance`, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(memberBalanceEndpoint, request);
    };

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();

        financialDirectorRole = PermissionRoleDetailed.create({
            name: 'financial director',
            accessRights: [AccessRight.OrganizationFinanceDirector],
        });

        financialDirectorRoleOfOtherOrganization = PermissionRoleDetailed.create({
            name: 'financial director other organization',
            accessRights: [AccessRight.OrganizationFinanceDirector],
        });

        organization = await new OrganizationFactory({ period, roles: [financialDirectorRole] })
            .create();

        otherOrganization = await new OrganizationFactory({ period, roles: [financialDirectorRoleOfOtherOrganization] }).create();

        financialDirector = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                roles: [
                    financialDirectorRole,
                ],
                resources: new Map([[PermissionsResourceType.Groups, new Map([[
                    '',
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]])]]),
            }),
        })
            .create();

        financialDirectorToken = await Token.createToken(financialDirector);
    });

    test('Should fail if user does can not manage the finances of the organization', async () => {
        // arrange
        const member1 = await new MemberFactory({ }).create();
        const member2 = await new MemberFactory({ }).create();

        await new RegistrationFactory({ member: member1, organization }).create();
        await new RegistrationFactory({ member: member2, organization }).create();

        const filter: StamhoofdFilter = {
            id: {
                $in: [member1.id, member2.id],
            },
        };

        const body = ChargeMembersRequest.create({
            description: 'test description',
            price: 3,
            amount: 4,
            dueAt: new Date(2023, 0, 10),
            createdAt: new Date(2023, 0, 4),
        });

        const testUserFactories: UserFactory[] = [
            new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        financialDirectorRole,
                    ],
                    resources: new Map([[PermissionsResourceType.Groups, new Map([[
                        '',
                        ResourcePermissions.create({
                            level: PermissionLevel.Read,
                        }),
                    ]])]]),
                }),
            }),
            new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[PermissionsResourceType.Groups, new Map([[
                        '',
                        ResourcePermissions.create({
                            level: PermissionLevel.Write,
                        }),
                    ]])]]),
                }),
            }),
        ];

        for (const userFactory of testUserFactories) {
            const user = await userFactory.create();

            const token = await Token.createToken(user);

            await expect(async () => await postCharge(filter, organization, body, token))
                .rejects
                .toThrow('You do not have permissions for this action');
        }
    });

    test('Should create balance items for members', async () => {
        // arrange
        const member1 = await new MemberFactory({ }).create();

        const member2 = await new MemberFactory({ }).create();

        await new RegistrationFactory({ member: member1, organization }).create();
        await new RegistrationFactory({ member: member2, organization }).create();

        const filter: StamhoofdFilter = {
            id: {
                $in: [member1.id, member2.id],
            },
        };

        const body = ChargeMembersRequest.create({
            description: 'test description',
            price: 3,
            amount: 4,
            dueAt: new Date(2023, 0, 10),
            createdAt: new Date(2023, 0, 4),
        });

        const result = await postCharge(filter, organization, body, financialDirectorToken);
        expect(result).toBeDefined();
        expect(result.body).toBeUndefined();

        // act and assert
        const testBalanceResponse = (response: Response<BalanceItemWithPayments[]>) => {
            expect(response).toBeDefined();
            expect(response.body.length).toBe(1);
            const balanceItem1 = response.body[0];
            expect(balanceItem1.price).toEqual(12);
            expect(balanceItem1.amount).toEqual(body.amount);
            expect(balanceItem1.description).toEqual(body.description);
            expect(balanceItem1.organizationId).toEqual(organization.id);
            // const dueAt = balanceItem1.dueAt!;
            expect(balanceItem1.dueAt).toEqual(body.dueAt);
            expect(balanceItem1.createdAt).toEqual(body.createdAt);
        };

        testBalanceResponse(await getBalance(member1.id, organization, financialDirectorToken));
        testBalanceResponse(await getBalance(member2.id, organization, financialDirectorToken));
    });

    test('Should not charge members of other organization', async () => {
        // arrange
        const member1 = await new MemberFactory({ }).create();

        const member2 = await new MemberFactory({ }).create();

        await new RegistrationFactory({ member: member1, organization: otherOrganization }).create();
        await new RegistrationFactory({ member: member2, organization: otherOrganization }).create();

        const filter: StamhoofdFilter = {
            id: {
                $in: [member1.id, member2.id],
            },
        };

        const otherFinancialDirector = await new UserFactory({
            organization: otherOrganization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                roles: [
                    financialDirectorRoleOfOtherOrganization,
                ],
                resources: new Map([[PermissionsResourceType.Groups, new Map([[
                    '',
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]])]]),
            }),
        })
            .create();

        const otherFinancialDirectorToken = await Token.createToken(otherFinancialDirector);

        const body = ChargeMembersRequest.create({
            description: 'test description',
            price: 3,
            amount: 4,
            dueAt: new Date(2023, 0, 10),
            createdAt: new Date(2023, 0, 4),
        });

        // act and assert
        const result = await postCharge(filter, organization, body, financialDirectorToken);
        expect(result).toBeDefined();
        expect(result.body).toBeUndefined();

        const testBalanceResponse = (response: Response<BalanceItemWithPayments[]>) => {
            expect(response).toBeDefined();
            expect(response.body.length).toBe(0);
        };

        testBalanceResponse(await getBalance(member1.id, otherOrganization, otherFinancialDirectorToken));
        testBalanceResponse(await getBalance(member2.id, otherOrganization, otherFinancialDirectorToken));
    });

    test('Should fail if invalid request', async () => {
        // arrange
        const member1 = await new MemberFactory({ }).create();

        const member2 = await new MemberFactory({ }).create();

        await new RegistrationFactory({ member: member1, organization }).create();
        await new RegistrationFactory({ member: member2, organization }).create();

        const filter: StamhoofdFilter = {
            id: {
                $in: [member1.id, member2.id],
            },
        };

        const testCases: [body: ChargeMembersRequest, expectedErrorMessage: string][] = [
            // empty description
            [ChargeMembersRequest.create({
                description: ' ',
                price: 3,
                amount: 4,
                dueAt: new Date(2023, 0, 10),
                createdAt: new Date(2023, 0, 4),
            }), 'Invalid description'],

            // price 0
            [ChargeMembersRequest.create({
                description: 'test description',
                price: 0,
                amount: 4,
                dueAt: new Date(2023, 0, 10),
                createdAt: new Date(2023, 0, 4),
            }), 'Invalid price'],

            // amount 0
            [ChargeMembersRequest.create({
                description: 'test description',
                price: 3,
                amount: 0,
                dueAt: new Date(2023, 0, 10),
                createdAt: new Date(2023, 0, 4),
            }), 'Invalid amount'],
        ];

        // act and assert
        for (const [body, expectedErrorMessage] of testCases) {
            await expect(async () => await postCharge(filter, organization, body, financialDirectorToken))
                .rejects
                .toThrow(expectedErrorMessage);
        }
    });
});
