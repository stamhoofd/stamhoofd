import { Request, Response } from '@simonbackx/simple-endpoints';
import { GroupFactory, MemberFactory, Organization, OrganizationFactory, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { AccessRight, BalanceItemWithPayments, ChargeMembersRequest, LimitedFilteredRequest, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions, StamhoofdFilter, Version } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { ChargeMembersEndpoint } from '../../src/endpoints/admin/members/ChargeMembersEndpoint.js';
import { testServer } from '../helpers/TestServer.js';
import { GetReceivableBalanceEndpoint } from '../../src/endpoints/organization/dashboard/receivable-balances/GetReceivableBalanceEndpoint.js';

describe('E2E.ChargeMembers', () => {
    const chargeMembersEndpoint = new ChargeMembersEndpoint();
    const getReceivableBalanceEndpoint = new GetReceivableBalanceEndpoint();
    let period: RegistrationPeriod;
    let organization: Organization;
    let otherOrganization: Organization;
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

    const getBalance = async (memberId: string, organization: Organization, token: Token): Promise<BalanceItemWithPayments[]> => {
        const request = Request.buildJson('GET', `/v${Version}/receivable-balances/member/${memberId}`, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return (await testServer.test(getReceivableBalanceEndpoint, request)).body.balanceItems;
    };

    const createUserData = async (permissions: Permissions | null | undefined, roles: PermissionRoleDetailed[]) => {
        const organization = await new OrganizationFactory({ period, roles })
            .create();

        const user = await new UserFactory({
            organization,
            permissions,
        })
            .create();

        const token = await Token.createToken(user);

        return { organization, user, token };
    };

    const createFinancialDirectorData = async () => {
        const role = PermissionRoleDetailed.create({
            name: 'financial director',
            accessRights: [AccessRight.OrganizationFinanceDirector],
        });

        const { organization, user: financialDirector, token } = await createUserData(Permissions.create({
            level: PermissionLevel.None,
            roles: [
                role,
            ],
            resources: new Map([[PermissionsResourceType.Groups, new Map([[
                '',
                ResourcePermissions.create({
                    level: PermissionLevel.Write,
                }),
            ]])]]),
        }), [role]);

        return { role, organization, financialDirector, token };
    };

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();

        const financialDirectorData = await createFinancialDirectorData();
        financialDirectorRole = financialDirectorData.role;
        financialDirectorToken = financialDirectorData.token;
        organization = financialDirectorData.organization;

        const otherFinancialDirectorData = await createFinancialDirectorData();
        otherOrganization = otherFinancialDirectorData.organization;
        financialDirectorRoleOfOtherOrganization = otherFinancialDirectorData.role;
    });

    test('Should fail if user does can not manage the payments of the organization', async () => {
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
                .toThrow(STExpect.errorWithCode('permission_denied'));
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
        const testBalanceResponse = (response: BalanceItemWithPayments[]) => {
            expect(response).toBeDefined();
            expect(response.length).toBe(1);
            const balanceItem1 = response[0];
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

        const testBalanceResponse = (response: BalanceItemWithPayments[]) => {
            expect(response).toBeDefined();
            expect(response.length).toBe(0);
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

    describe('Access for single group', () => {
        test('Should create balance items for members if can manage payments of group', async () => {
            // arrange
            const role = PermissionRoleDetailed.create({
                name: 'financial director',
                accessRights: [AccessRight.OrganizationFinanceDirector],
            });

            const resources = new Map();

            const { organization, token, user } = await createUserData(Permissions.create({
                level: PermissionLevel.None,
                roles: [
                    role,
                ],
                resources,
            }), [role]);

            const member1 = await new MemberFactory({ }).create();

            const member2 = await new MemberFactory({ }).create();

            const group = await new GroupFactory({ organization, period }).create();

            resources.set(PermissionsResourceType.Groups, new Map([[group.id, ResourcePermissions.create({
                level: PermissionLevel.Write,
            })]]));

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();

            const filter: StamhoofdFilter = {
                registrations: {
                    $elemMatch: {
                        groupId: group.id,
                    },
                },
            };

            const body = ChargeMembersRequest.create({
                description: 'test description',
                price: 3,
                amount: 4,
                dueAt: new Date(2023, 0, 10),
                createdAt: new Date(2023, 0, 4),
            });

            const result = await postCharge(filter, organization, body, token);
            expect(result).toBeDefined();
            expect(result.body).toBeUndefined();

            // act and assert
            const testBalanceResponse = (response: BalanceItemWithPayments[]) => {
                expect(response).toBeDefined();
                expect(response.length).toBe(1);
                const balanceItem1 = response[0];
                expect(balanceItem1.price).toEqual(12);
                expect(balanceItem1.amount).toEqual(4);
                expect(balanceItem1.description).toEqual('test description');
                expect(balanceItem1.organizationId).toEqual(organization.id);
                expect(balanceItem1.dueAt).toEqual(new Date(2023, 0, 10));
                expect(balanceItem1.createdAt).toEqual(body.createdAt);
            };

            testBalanceResponse(await getBalance(member1.id, organization, token));
            testBalanceResponse(await getBalance(member2.id, organization, token));
        });

        test('Should fail if no write access for group', async () => {
            // arrange
            const role = PermissionRoleDetailed.create({
                name: 'financial director',
                accessRights: [AccessRight.OrganizationFinanceDirector],
            });

            const resources = new Map();

            const { organization, token, user } = await createUserData(Permissions.create({
                level: PermissionLevel.None,
                roles: [
                    role,
                ],
                resources,
            }), [role]);

            const member1 = await new MemberFactory({ }).create();

            const member2 = await new MemberFactory({ }).create();

            const group = await new GroupFactory({ organization, period }).create();

            resources.set(PermissionsResourceType.Groups, new Map([[group.id, ResourcePermissions.create({
                level: PermissionLevel.Read,
            })]]));

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();

            const filter: StamhoofdFilter = {
                registrations: {
                    $elemMatch: {
                        groupId: group.id,
                    },
                },
            };

            const body = ChargeMembersRequest.create({
                description: 'test description',
                price: 3,
                amount: 4,
                dueAt: new Date(2023, 0, 10),
                createdAt: new Date(2023, 0, 4),
            });

            await expect(async () => await postCharge(filter, organization, body, token))
                .rejects
                .toThrow(STExpect.errorWithCode('permission_denied'));
        });
    });
});
