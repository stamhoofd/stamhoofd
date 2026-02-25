import { Request } from '@simonbackx/simple-endpoints';
import { GroupFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory, Webshop, WebshopFactory } from '@stamhoofd/models';
import { AccessRight, MemberResponsibility, OrganizationPrivateMetaData, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, Organization as OrganizationStruct, PermissionLevel, PermissionRoleDetailed, PermissionRoleForResponsibility, Permissions, PermissionsResourceType, ResourcePermissions, Version } from '@stamhoofd/structures';

import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, PatchMap } from '@simonbackx/simple-encoding';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchOrganizationEndpoint } from './PatchOrganizationEndpoint.js';

describe('Endpoint.PatchOrganization', () => {
    // Test endpoint
    const endpoint = new PatchOrganizationEndpoint();

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    const patchOrganization = async ({ patch, organization, token }: { patch: AutoEncoderPatchType<OrganizationStruct> | OrganizationStruct; organization: Organization; token: Token }) => {
        const request = Request.buildJson('PATCH', `/v${Version}/organization`, organization.getApiHost(), patch);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    test('Change the name of the organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
        // const groups = await new GroupFactory({ organization }).createMultiple(2)
        const token = await Token.createToken(user);

        const r = Request.buildJson('PATCH', '/v2/organization', organization.getApiHost(), {
            id: organization.id,
            name: 'My crazy name',
        });
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof OrganizationStruct)) {
            throw new Error('Expected Organization');
        }

        expect(response.body.id).toEqual(organization.id);
        expect(response.body.name).toEqual('My crazy name');
    });

    test("Can't change organization as a normal user", async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('PATCH', '/organization', organization.getApiHost(), {
            id: organization.id,
            name: 'My crazy name',
        });
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/permissions/i);
    });

    test("Can't change organization as a user with read access", async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Read }) }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('PATCH', '/organization', organization.getApiHost(), {
            id: organization.id,
            name: 'My crazy name',
        });
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/permissions/i);
    });

    describe('Edit access to webshop', () => {
        describe('full access', () => {
            test('patch responsibilities, roles and inherited responsibility roles should be allowed', async () => {
                // arrange
                const organization = await new OrganizationFactory({ }).create();
                const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

                const role1 = PermissionRoleDetailed.create({});
                organization.privateMeta.roles = [role1];

                const inheritedResponsibilityRole1 = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                });

                organization.privateMeta.inheritedResponsibilityRoles = [inheritedResponsibilityRole1];

                const inheritedResponsibilityRole2 = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                });

                const memberResponsibility = MemberResponsibility.create({
                    permissions: inheritedResponsibilityRole2,
                });

                organization.privateMeta.responsibilities = [memberResponsibility];

                await organization.save();

                const rolesPatch: PatchableArrayAutoEncoder<PermissionRoleDetailed> = new PatchableArray();

                rolesPatch.addPatch(PermissionRoleDetailed.patch({
                    id: role1.id,
                    resources: new PatchMap([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                }));

                const responsibilitiesPatch: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();

                responsibilitiesPatch.addPatch(MemberResponsibility.patch({
                    id: memberResponsibility.id,
                    permissions: PermissionRoleForResponsibility.patch({
                        id: inheritedResponsibilityRole2.id,
                        resources: new PatchMap([
                            [PermissionsResourceType.Webshops,
                                new Map([
                                    [webshop.id,
                                        ResourcePermissions.create({ level: PermissionLevel.Full }),
                                    ],
                                ]),
                            ],
                        ]),
                    }),
                }));

                const inheritedResponsibilityRolesPatch: PatchableArrayAutoEncoder<PermissionRoleForResponsibility> = new PatchableArray();

                inheritedResponsibilityRolesPatch.addPatch(PermissionRoleForResponsibility.patch({
                    id: inheritedResponsibilityRole1.id,
                    resources: new PatchMap([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                }));

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        roles: rolesPatch,
                        responsibilities: responsibilitiesPatch,
                        inheritedResponsibilityRoles: inheritedResponsibilityRolesPatch,
                    }),
                });

                const user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({ level: PermissionLevel.Full }),
                })
                    .create();

                const token = await Token.createToken(user);

                // act
                const response = await patchOrganization({
                    patch,
                    organization,
                    token,
                });

                // assert
                expect(response.body).toBeDefined();
                expect(response.body.privateMeta).not.toBeNull();

                // roles
                expect(response.body.privateMeta!.roles).toHaveLength(1);
                expect(response.body.privateMeta!.roles[0].id).toBe(role1.id);
                expect(response.body.privateMeta!.roles[0].resources.size).toBe(1);

                // responsibilities
                expect(response.body.privateMeta!.responsibilities).toHaveLength(1);
                expect(response.body.privateMeta!.responsibilities[0].id).toBe(memberResponsibility.id);
                expect(response.body.privateMeta!.responsibilities[0].permissions).not.toBeNull();
                expect(response.body.privateMeta!.responsibilities[0].permissions?.resources.size).toBe(1);

                // inherited responsibility roles
                expect(response.body.privateMeta!.inheritedResponsibilityRoles).toHaveLength(1);
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].id).toBe(inheritedResponsibilityRole1.id);
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].resources.size).toBe(1);
            });

            test('put responsibilities, roles and inherited responsibility roles should be allowed', async () => {
                // arrange
                const organization = await new OrganizationFactory({ }).create();
                const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

                const role1 = PermissionRoleDetailed.create({
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                });

                const inheritedResponsibilityRole1 = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                });

                const inheritedResponsibilityRole2 = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                });

                const memberResponsibility = MemberResponsibility.create({
                    permissions: inheritedResponsibilityRole2,
                });

                const rolesPatch: PatchableArrayAutoEncoder<PermissionRoleDetailed> = new PatchableArray();

                rolesPatch.addPut(role1);

                const responsibilitiesPatch: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();

                responsibilitiesPatch.addPut(memberResponsibility);

                const inheritedResponsibilityRolesPatch: PatchableArrayAutoEncoder<PermissionRoleForResponsibility> = new PatchableArray();

                inheritedResponsibilityRolesPatch.addPut(inheritedResponsibilityRole1);

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        roles: rolesPatch,
                        responsibilities: responsibilitiesPatch,
                        inheritedResponsibilityRoles: inheritedResponsibilityRolesPatch,
                    }),
                });

                const user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({ level: PermissionLevel.Full }),
                })
                    .create();

                const token = await Token.createToken(user);

                // act
                const response = await patchOrganization({
                    patch,
                    organization,
                    token,
                });

                // assert
                expect(response.body).toBeDefined();
                expect(response.body.privateMeta).not.toBeNull();

                // roles
                expect(response.body.privateMeta!.roles).toHaveLength(1);
                expect(response.body.privateMeta!.roles[0].id).toBe(role1.id);
                expect(response.body.privateMeta!.roles[0].resources.size).toBe(1);

                // responsibilities
                expect(response.body.privateMeta!.responsibilities).toHaveLength(1);
                expect(response.body.privateMeta!.responsibilities[0].id).toBe(memberResponsibility.id);
                expect(response.body.privateMeta!.responsibilities[0].permissions).not.toBeNull();
                expect(response.body.privateMeta!.responsibilities[0].permissions?.resources.size).toBe(1);

                // inherited responsibility roles
                expect(response.body.privateMeta!.inheritedResponsibilityRoles).toHaveLength(1);
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].id).toBe(inheritedResponsibilityRole1.id);
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].resources.size).toBe(1);
            });
        });

        describe('full access to webshop', () => {
            let user: User;
            let token: Token;
            let organization: Organization;
            let webshop: Webshop;

            beforeAll(async () => {
                const createWebshopRole = PermissionRoleDetailed.create({
                    accessRights: [AccessRight.OrganizationCreateWebshops],
                });

                organization = await new OrganizationFactory({ roles: [createWebshopRole] }).create();
                webshop = await new WebshopFactory({ organizationId: organization.id }).create();

                // organization.privateMeta.roles = [createWebshopRole];
                // await organization.save();

                user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({ level: PermissionLevel.None, roles: [createWebshopRole], resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ])],
                    ]) }),
                })
                    .create();

                token = await Token.createToken(user);
            });

            test('should throw if put roles', async () => {
                const roleName = 'test role 1';

                const role1 = PermissionRoleDetailed.create({
                    name: roleName,
                    level: PermissionLevel.Full,
                    accessRights: [AccessRight.MemberReadFinancialData],
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                });

                const rolesPatch: PatchableArrayAutoEncoder<PermissionRoleDetailed> = new PatchableArray();

                rolesPatch.addPut(role1);

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        roles: rolesPatch,
                    }),
                });

                // act
                await expect(patchOrganization({
                    patch,
                    organization,
                    token,
                })).rejects.toThrow('You do not have permissions to add roles');
            });

            test('should only be able to patch resources of roles', async () => {
                // arrange
                const role1 = PermissionRoleDetailed.create({
                    name: 'role1',
                });
                organization.privateMeta.roles = [role1, ...organization.privateMeta.roles];

                await organization.save();

                const rolesPatch: PatchableArrayAutoEncoder<PermissionRoleDetailed> = new PatchableArray();

                rolesPatch.addPatch(PermissionRoleDetailed.patch({
                    id: role1.id,
                    name: 'new name',
                    resources: new PatchMap([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                    level: PermissionLevel.Full,
                }));

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        roles: rolesPatch,
                    }),
                });

                // act
                const response = await patchOrganization({
                    patch,
                    organization,
                    token,
                });

                // assert
                expect(response.body).toBeDefined();
                expect(response.body.privateMeta).not.toBeNull();

                // roles
                expect(response.body.privateMeta!.roles).toHaveLength(2);
                expect(response.body.privateMeta!.roles[0].id).toBe(role1.id);
                expect(response.body.privateMeta!.roles[0].resources.size).toBe(1);

                // name should not have been changed
                expect(response.body.privateMeta!.roles[0].name).toBe('role1');
                // permission level should not have been changed
                expect(response.body.privateMeta!.roles[0].level).toBe(PermissionLevel.None);
            });

            test('should throw if put responsibilities', async () => {
                // arrange
                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    responsibilityId: 'responsibilityId',
                    responsibilityGroupId: 'responsibilityGroupId',
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                    level: PermissionLevel.Full,
                    accessRights: [AccessRight.MemberReadFinancialData],
                });

                const memberResponsibility = MemberResponsibility.create({
                    permissions: inheritedResponsibilityRole,
                    organizationBased: false,
                    defaultAgeGroupIds: ['test'],
                    organizationTagIds: ['test'],
                    groupPermissionLevel: PermissionLevel.Full,
                });

                const responsibilitiesPatch: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();

                responsibilitiesPatch.addPut(memberResponsibility);

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        responsibilities: responsibilitiesPatch,
                    }),
                });

                // act
                await expect(patchOrganization({
                    patch,
                    organization,
                    token,
                })).rejects.toThrow('You do not have permissions to add responsibilities');
            });

            test('should only be able to patch resources of responsibilities', async () => {
                // arrange
                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    name: 'name1',
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                });

                const memberResponsibility = MemberResponsibility.create({
                    name: 'memberResponsibility1',
                    description: 'description1',
                    permissions: inheritedResponsibilityRole,
                });

                organization.privateMeta.responsibilities = [memberResponsibility];

                await organization.save();

                const responsibilitiesPatch: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();

                responsibilitiesPatch.addPatch(MemberResponsibility.patch({
                    id: memberResponsibility.id,
                    name: 'new name',
                    description: 'new description',
                    permissions: PermissionRoleForResponsibility.patch({
                        name: 'new name',
                        level: PermissionLevel.Full,
                        id: inheritedResponsibilityRole.id,
                        resources: new PatchMap([
                            [PermissionsResourceType.Webshops,
                                new Map([
                                    [webshop.id,
                                        ResourcePermissions.create({ level: PermissionLevel.Full }),
                                    ],
                                ]),
                            ],
                        ]),
                    }),
                }));

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        responsibilities: responsibilitiesPatch,
                    }),
                });

                // act
                const response = await patchOrganization({
                    patch,
                    organization,
                    token,
                });

                // assert
                expect(response.body).toBeDefined();
                expect(response.body.privateMeta).not.toBeNull();

                // responsibilities
                expect(response.body.privateMeta!.responsibilities).toHaveLength(1);
                expect(response.body.privateMeta!.responsibilities[0].id).toBe(memberResponsibility.id);
                expect(response.body.privateMeta!.responsibilities[0].permissions).not.toBeNull();
                expect(response.body.privateMeta!.responsibilities[0].permissions?.resources.size).toBe(1);

                // other fields should not have changed
                expect(response.body.privateMeta!.responsibilities[0].name).toBe('memberResponsibility1');
                expect(response.body.privateMeta!.responsibilities[0].description).toBe('description1');
                expect(response.body.privateMeta!.responsibilities[0].permissions?.name).toBe('name1');
                expect(response.body.privateMeta!.responsibilities[0].permissions?.level).toBe(PermissionLevel.None);
            });

            test('should be able to put limited inherited responsibility roles', async () => {
                // arrange
                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    responsibilityId: 'responsibilityId',
                    responsibilityGroupId: 'responsibilityGroupId',
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                    level: PermissionLevel.Full,
                    accessRights: [AccessRight.MemberReadFinancialData],
                });

                const inheritedResponsibilityRolesPatch: PatchableArrayAutoEncoder<PermissionRoleForResponsibility> = new PatchableArray();

                inheritedResponsibilityRolesPatch.addPut(inheritedResponsibilityRole);

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        inheritedResponsibilityRoles: inheritedResponsibilityRolesPatch,
                    }),
                });

                // act
                const response = await patchOrganization({
                    patch,
                    organization,
                    token,
                });

                // assert
                expect(response.body).toBeDefined();
                expect(response.body.privateMeta).not.toBeNull();

                // inherited responsibility roles
                expect(response.body.privateMeta!.inheritedResponsibilityRoles).toHaveLength(1);
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].id).toBe(inheritedResponsibilityRole.id);
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].resources.size).toBe(1);
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].responsibilityId).toBe('responsibilityId');
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].responsibilityGroupId).toBe('responsibilityGroupId');

                // other fields should be default fields and not be set
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].level).toBe(PermissionLevel.None);
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].accessRights).toBeEmpty();
            });

            test('should only be able to patch resources of inherited responsibility roles', async () => {
                // arrange
                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    responsibilityId: 'responsibilityId',
                    responsibilityGroupId: 'responsibilityGroupId',
                    name: 'name1',
                });

                organization.privateMeta.inheritedResponsibilityRoles = [inheritedResponsibilityRole];

                await organization.save();

                const inheritedResponsibilityRolesPatch: PatchableArrayAutoEncoder<PermissionRoleForResponsibility> = new PatchableArray();

                inheritedResponsibilityRolesPatch.addPatch(PermissionRoleForResponsibility.patch({
                    id: inheritedResponsibilityRole.id,
                    name: 'new name',
                    responsibilityId: 'new id',
                    responsibilityGroupId: 'new group id',
                    level: PermissionLevel.Full,
                    resources: new PatchMap([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                }));

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        inheritedResponsibilityRoles: inheritedResponsibilityRolesPatch,
                    }),
                });

                // act
                const response = await patchOrganization({
                    patch,
                    organization,
                    token,
                });

                // assert
                expect(response.body).toBeDefined();
                expect(response.body.privateMeta).not.toBeNull();

                // inherited responsibility roles
                expect(response.body.privateMeta!.inheritedResponsibilityRoles).toHaveLength(1);
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].id).toBe(inheritedResponsibilityRole.id);
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].resources.size).toBe(1);

                // other fields should not have changed
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].name).toBe('name1');
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].responsibilityId).toBe('responsibilityId');
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].responsibilityGroupId).toBe('responsibilityGroupId');
                expect(response.body.privateMeta!.inheritedResponsibilityRoles[0].level).toBe(PermissionLevel.None);
            });
        });

        describe('no full access to webshop', () => {
            let organization: Organization;
            let webshop: Webshop;
            let usersWithoutFullAccess: { user: User; token: Token }[];

            beforeAll(async () => {
                const createWebshopRole = PermissionRoleDetailed.create({
                    accessRights: [AccessRight.OrganizationCreateWebshops],
                });

                organization = await new OrganizationFactory({ roles: [createWebshopRole] }).create();
                webshop = await new WebshopFactory({ organizationId: organization.id }).create();

                const userWithReadAccess = await new UserFactory({
                    organization,
                    permissions: Permissions.create({ level: PermissionLevel.None, roles: [createWebshopRole], resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Read }),
                                ],
                            ])],
                    ]) }),
                })
                    .create();

                const userWithReadAccessToken = await Token.createToken(userWithReadAccess);

                const userWithWriteAccess = await new UserFactory({
                    organization,
                    permissions: Permissions.create({ level: PermissionLevel.None, roles: [createWebshopRole], resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Read }),
                                ],
                            ])],
                    ]) }),
                })
                    .create();

                const userWithWriteAccessToken = await Token.createToken(userWithReadAccess);

                const otherWebshop = await new WebshopFactory({ organizationId: organization.id }).create();

                const userWithFullAccessForOtherWebshop = await new UserFactory({
                    organization,
                    permissions: Permissions.create({ level: PermissionLevel.None, roles: [createWebshopRole], resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [otherWebshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ])],
                    ]) }),
                })
                    .create();

                const userWithFullAccessForOtherWebshopToken = await Token.createToken(userWithReadAccess);

                usersWithoutFullAccess = [
                    { user: userWithReadAccess, token: userWithReadAccessToken },
                    { user: userWithWriteAccess, token: userWithWriteAccessToken },
                    { user: userWithFullAccessForOtherWebshop, token: userWithFullAccessForOtherWebshopToken },
                ];
            });

            test('should not be able to put roles', async () => {
                const roleName = 'test role 1';

                const role1 = PermissionRoleDetailed.create({
                    name: roleName,
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                });

                const rolesPatch: PatchableArrayAutoEncoder<PermissionRoleDetailed> = new PatchableArray();

                rolesPatch.addPut(role1);

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        roles: rolesPatch,
                    }),
                });

                // act and assert

                for (const { token } of usersWithoutFullAccess) {
                    await expect(patchOrganization({
                        patch,
                        organization,
                        token,
                    })).rejects.toThrow('You do not have permissions to add roles');
                }
            });

            test('should not be able to patch roles', async () => {
                // arrange
                const role1 = PermissionRoleDetailed.create({});
                organization.privateMeta.roles = [role1, ...organization.privateMeta.roles];

                await organization.save();

                const rolesPatch: PatchableArrayAutoEncoder<PermissionRoleDetailed> = new PatchableArray();

                rolesPatch.addPatch(PermissionRoleDetailed.patch({
                    id: role1.id,
                    resources: new PatchMap([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                }));

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        roles: rolesPatch,
                    }),
                });

                // act and assert
                for (const { token } of usersWithoutFullAccess) {
                    await expect(patchOrganization({
                        patch,
                        organization,
                        token,
                    })).rejects.toThrow('You do not have permissions to edit roles');
                }
            });

            test('should not be able to put responsibilities', async () => {
                // arrange
                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                });

                const memberResponsibility = MemberResponsibility.create({
                    permissions: inheritedResponsibilityRole,
                });

                const responsibilitiesPatch: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();

                responsibilitiesPatch.addPut(memberResponsibility);

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        responsibilities: responsibilitiesPatch,
                    }),
                });

                // act and assert
                for (const { token } of usersWithoutFullAccess) {
                    await expect(patchOrganization({
                        patch,
                        organization,
                        token,
                    })).rejects.toThrow('You do not have permissions to add responsibilities');
                }
            });

            test('should not be able to patch responsibilities', async () => {
                // arrange
                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                });

                const memberResponsibility = MemberResponsibility.create({
                    permissions: inheritedResponsibilityRole,
                });

                organization.privateMeta.responsibilities = [memberResponsibility];

                await organization.save();

                const responsibilitiesPatch: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();

                responsibilitiesPatch.addPatch(MemberResponsibility.patch({
                    id: memberResponsibility.id,
                    permissions: PermissionRoleForResponsibility.patch({
                        id: inheritedResponsibilityRole.id,
                        resources: new PatchMap([
                            [PermissionsResourceType.Webshops,
                                new Map([
                                    [webshop.id,
                                        ResourcePermissions.create({ level: PermissionLevel.Full }),
                                    ],
                                ]),
                            ],
                        ]),
                    }),
                }));

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        responsibilities: responsibilitiesPatch,
                    }),
                });

                // act and assert
                for (const { token } of usersWithoutFullAccess) {
                    await expect(patchOrganization({
                        patch,
                        organization,
                        token,
                    })).rejects.toThrow('You do not have permissions to edit responsibilities');
                }
            });

            test('should not be able to put inherited responsibility roles', async () => {
                // arrange
                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                });

                const inheritedResponsibilityRolesPatch: PatchableArrayAutoEncoder<PermissionRoleForResponsibility> = new PatchableArray();

                inheritedResponsibilityRolesPatch.addPut(inheritedResponsibilityRole);

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        inheritedResponsibilityRoles: inheritedResponsibilityRolesPatch,
                    }),
                });

                // act and assert
                for (const { token } of usersWithoutFullAccess) {
                    await expect(patchOrganization({
                        patch,
                        organization,
                        token,
                    })).rejects.toThrow('You do not have permissions to add inherited responsibility roles');
                }
            });

            test('should not be able to patch inherited responsibility roles', async () => {
                // arrange
                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                });

                organization.privateMeta.inheritedResponsibilityRoles = [inheritedResponsibilityRole];

                await organization.save();

                const inheritedResponsibilityRolesPatch: PatchableArrayAutoEncoder<PermissionRoleForResponsibility> = new PatchableArray();

                inheritedResponsibilityRolesPatch.addPatch(PermissionRoleForResponsibility.patch({
                    id: inheritedResponsibilityRole.id,
                    resources: new PatchMap([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                    ]),
                }));

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        inheritedResponsibilityRoles: inheritedResponsibilityRolesPatch,
                    }),
                });

                // act and assert
                for (const { token } of usersWithoutFullAccess) {
                    await expect(patchOrganization({
                        patch,
                        organization,
                        token,
                    })).rejects.toThrow('You do not have permissions to edit inherited responsibility roles');
                }
            });
        });

        describe('full access to webshop but extra resource without access', () => {
            let organization: Organization;
            let webshop: Webshop;
            let token: Token;

            beforeAll(async () => {
                const createWebshopRole = PermissionRoleDetailed.create({
                    accessRights: [AccessRight.OrganizationCreateWebshops],
                });

                organization = await new OrganizationFactory({ roles: [createWebshopRole] }).create();
                webshop = await new WebshopFactory({ organizationId: organization.id }).create();
                const user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({ level: PermissionLevel.None, roles: [createWebshopRole], resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ])],
                    ]) }),
                })
                    .create();

                token = await Token.createToken(user);
            });

            test('should not be able to put roles', async () => {
                const roleName = 'test role 1';

                const otherGroup = await new GroupFactory({ organization }).create();

                const role1 = PermissionRoleDetailed.create({
                    name: roleName,
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                        [PermissionsResourceType.Groups, new Map([
                            [otherGroup.id,
                                ResourcePermissions.create({ level: PermissionLevel.Full }),
                            ],
                        ])],
                    ]),
                });

                const rolesPatch: PatchableArrayAutoEncoder<PermissionRoleDetailed> = new PatchableArray();

                rolesPatch.addPut(role1);

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        roles: rolesPatch,
                    }),
                });

                // act and assert
                await expect(patchOrganization({
                    patch,
                    organization,
                    token,
                })).rejects.toThrow('You do not have permissions to add roles');
            });

            test('should not be able to patch roles', async () => {
                // arrange
                const role1 = PermissionRoleDetailed.create({});
                organization.privateMeta.roles = [role1, ...organization.privateMeta.roles];

                await organization.save();

                const rolesPatch: PatchableArrayAutoEncoder<PermissionRoleDetailed> = new PatchableArray();

                const otherGroup = await new GroupFactory({ organization }).create();

                rolesPatch.addPatch(PermissionRoleDetailed.patch({
                    id: role1.id,
                    resources: new PatchMap([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                        [PermissionsResourceType.Groups, new Map([
                            [otherGroup.id,
                                ResourcePermissions.create({ level: PermissionLevel.Full }),
                            ],
                        ])],
                    ]),
                }));

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        roles: rolesPatch,
                    }),
                });

                // act and assert
                await expect(patchOrganization({
                    patch,
                    organization,
                    token,
                })).rejects.toThrow('You do not have permissions to edit roles');
            });

            test('should not be able to put responsibilities', async () => {
                // arrange
                const otherGroup = await new GroupFactory({ organization }).create();

                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                        [PermissionsResourceType.Groups, new Map([
                            [otherGroup.id,
                                ResourcePermissions.create({ level: PermissionLevel.Full }),
                            ],
                        ])],
                    ]),
                });

                const memberResponsibility = MemberResponsibility.create({
                    permissions: inheritedResponsibilityRole,
                });

                const responsibilitiesPatch: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();

                responsibilitiesPatch.addPut(memberResponsibility);

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        responsibilities: responsibilitiesPatch,
                    }),
                });

                // act and assert
                await expect(patchOrganization({
                    patch,
                    organization,
                    token,
                })).rejects.toThrow('You do not have permissions to add responsibilities');
            });

            test('should not be able to patch responsibilities', async () => {
                // arrange
                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                });

                const memberResponsibility = MemberResponsibility.create({
                    permissions: inheritedResponsibilityRole,
                });

                organization.privateMeta.responsibilities = [memberResponsibility];

                await organization.save();

                const responsibilitiesPatch: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();

                const otherGroup = await new GroupFactory({ organization }).create();

                responsibilitiesPatch.addPatch(MemberResponsibility.patch({
                    id: memberResponsibility.id,
                    permissions: PermissionRoleForResponsibility.patch({
                        id: inheritedResponsibilityRole.id,
                        resources: new PatchMap([
                            [PermissionsResourceType.Webshops,
                                new Map([
                                    [webshop.id,
                                        ResourcePermissions.create({ level: PermissionLevel.Full }),
                                    ],
                                ]),
                            ],
                            [PermissionsResourceType.Groups, new Map([
                                [otherGroup.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ])],
                        ]),
                    }),
                }));

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        responsibilities: responsibilitiesPatch,
                    }),
                });

                // act and assert
                await expect(patchOrganization({
                    patch,
                    organization,
                    token,
                })).rejects.toThrow('You do not have permissions to edit responsibilities');
            });

            test('should not be able to put inherited responsibility roles', async () => {
                // arrange
                const otherGroup = await new GroupFactory({ organization }).create();

                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                    resources: new Map([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                        [PermissionsResourceType.Groups, new Map([
                            [otherGroup.id,
                                ResourcePermissions.create({ level: PermissionLevel.Full }),
                            ],
                        ])],
                    ]),
                });

                const inheritedResponsibilityRolesPatch: PatchableArrayAutoEncoder<PermissionRoleForResponsibility> = new PatchableArray();

                inheritedResponsibilityRolesPatch.addPut(inheritedResponsibilityRole);

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        inheritedResponsibilityRoles: inheritedResponsibilityRolesPatch,
                    }),
                });

                // act and assert
                await expect(patchOrganization({
                    patch,
                    organization,
                    token,
                })).rejects.toThrow('You do not have permissions to add inherited responsibility roles');
            });

            test('should not be able to patch inherited responsibility roles', async () => {
                // arrange
                const inheritedResponsibilityRole = PermissionRoleForResponsibility.create({
                    responsibilityId: 'doesnotmatter',
                    responsibilityGroupId: 'doesnotmatter',
                });

                const otherGroup = await new GroupFactory({ organization }).create();

                organization.privateMeta.inheritedResponsibilityRoles = [inheritedResponsibilityRole];

                await organization.save();

                const inheritedResponsibilityRolesPatch: PatchableArrayAutoEncoder<PermissionRoleForResponsibility> = new PatchableArray();

                inheritedResponsibilityRolesPatch.addPatch(PermissionRoleForResponsibility.patch({
                    id: inheritedResponsibilityRole.id,
                    resources: new PatchMap([
                        [PermissionsResourceType.Webshops,
                            new Map([
                                [webshop.id,
                                    ResourcePermissions.create({ level: PermissionLevel.Full }),
                                ],
                            ]),
                        ],
                        [PermissionsResourceType.Groups, new Map([
                            [otherGroup.id,
                                ResourcePermissions.create({ level: PermissionLevel.Full }),
                            ],
                        ])],
                    ]),
                }));

                const patch = OrganizationStruct.patch({
                    id: organization.id,
                    privateMeta: OrganizationPrivateMetaData.patch({
                        inheritedResponsibilityRoles: inheritedResponsibilityRolesPatch,
                    }),
                });

                // act and assert
                await expect(patchOrganization({
                    patch,
                    organization,
                    token,
                })).rejects.toThrow('You do not have permissions to edit inherited responsibility roles');
            });
        });
    });

    describe('userMode organization', () => {
        beforeEach(async () => {
            TestUtils.setEnvironment('userMode', 'organization');
        });

        test("Can't set period that belongs to no organization", async () => {
            const initialPeriod = await new RegistrationPeriodFactory({}).create();
            const organization = await new OrganizationFactory({ }).create();

            organization.periodId = initialPeriod.id;
            await organization.save();

            const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const token = await Token.createToken(user);

            const newPeriod = await new RegistrationPeriodFactory({}).create();

            const newOrganizationPeriod = new OrganizationRegistrationPeriod();
            newOrganizationPeriod.organizationId = organization.id;
            newOrganizationPeriod.periodId = newPeriod.id;
            await newOrganizationPeriod.save();

            const patch = OrganizationStruct.patch({
                id: organization.id,
                period: OrganizationRegistrationPeriodStruct.patch({ id: newOrganizationPeriod.id }),
            });

            await expect(patchOrganization({ patch, organization, token })).rejects.toThrow(
                STExpect.simpleError({ code: 'invalid_field', field: 'period' }),
            );
        });

        test("Can't set period that belongs to other organization", async () => {
            const initialPeriod = await new RegistrationPeriodFactory({}).create();
            const organization = await new OrganizationFactory({ }).create();

            organization.periodId = initialPeriod.id;
            await organization.save();

            const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const token = await Token.createToken(user);

            const otherOrganization = await new OrganizationFactory({ }).create();
            const newPeriod = await new RegistrationPeriodFactory({ organization: otherOrganization }).create();
            const newOrganizationPeriod = new OrganizationRegistrationPeriod();
            newOrganizationPeriod.organizationId = otherOrganization.id;
            newOrganizationPeriod.periodId = newPeriod.id;
            await newOrganizationPeriod.save();

            const patch = OrganizationStruct.patch({
                id: organization.id,
                period: OrganizationRegistrationPeriodStruct.patch({ id: newOrganizationPeriod.id }),
            });

            await expect(patchOrganization({ patch, organization, token })).rejects.toThrow(
                STExpect.simpleError({ code: 'invalid_field', field: 'period' }),
            );
        });
    });
});
