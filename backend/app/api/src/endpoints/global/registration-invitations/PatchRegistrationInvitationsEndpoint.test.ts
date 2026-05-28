import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, OrganizationFactory, RegistrationFactory, RegistrationInvitationFactory, Token, UserFactory } from '@stamhoofd/models';
import type { RegistrationInvitation as RegistrationInvitationStruct } from '@stamhoofd/structures';
import { PermissionLevel, Permissions, PermissionsResourceType, RegistrationInvitationRequest, ResourcePermissions, TranslatedString } from '@stamhoofd/structures';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { PatchRegistrationInvitationsEndpoint } from './PatchRegistrationInvitationsEndpoint.js';

describe('Endpoint.PatchRegistrationInvitationsEndpoint', () => {
    const endpoint = new PatchRegistrationInvitationsEndpoint();

    const patchInvitations = async ({ patch, organization, user }: { patch: PatchableArrayAutoEncoder<RegistrationInvitationRequest>; organization: Organization; user: User | null }) => {
        const request = Request.buildJson('PATCH', '/registration-invitations', organization.getApiHost(), patch);
        if (user) {
            const token = await Token.createToken(user);
            request.headers.authorization = 'Bearer ' + token.accessToken;
        }
        return await testServer.test<RegistrationInvitationStruct[]>(endpoint, request);
    };

    describe('Put invitation', () => {
        test('Happy path', async () => {
            const organization = await new OrganizationFactory({}).create();
            const groupName = 'test groep';
            const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
            const resources = new Map();

            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]]),
            );

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources,
                }),
            }).create();

            const member = await new MemberFactory({
                organization, user,
                firstName: 'John',
                lastName: 'Doe',
                birthDay: { year: 1994, month: 6, day: 24 },
            }).create();

            const patch: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();

            patch.addPut(RegistrationInvitationRequest.create({
                groupId: group.id,
                memberId: member.id,
            }));

            const response = await patchInvitations({
                patch,
                organization,
                user,
            });

            // assert
            expect(response.body).toBeDefined();
            expect(response.body).toHaveLength(1);
            expect(response.body[0].group.id).toBe(group.id);
            expect(response.body[0].group.name.toString()).toBe(groupName);
            expect(response.body[0].member.id).toBe(member.id);
            expect(response.body[0].member.firstName).toBe(member.firstName);
            expect(response.body[0].member.lastName).toBe(member.lastName);
        });

        test('Should fail if no write access to group', async () => {
            const organization = await new OrganizationFactory({}).create();
            const groupName = 'test groep';
            const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
            const resources = new Map();

            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        // read access!
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources,
                }),
            }).create();

            const member = await new MemberFactory({
                organization, user,
                firstName: 'John',
                lastName: 'Doe',
                birthDay: { year: 1994, month: 6, day: 24 },
            }).create();

            const patch: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();

            patch.addPut(RegistrationInvitationRequest.create({
                groupId: group.id,
                memberId: member.id,
            }));

            // assert
            await expect(patchInvitations({
                patch,
                organization,
                user,
            })).rejects.toThrow('Je hebt geen toegangsrechten om iemand uit te nodigen voor deze groep.');
        });

        test('Should fail if no read access to member', async () => {
            const organization = await new OrganizationFactory({}).create();
            const groupName = 'test groep';
            const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
            const resources = new Map();

            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]]),
            );

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources,
                }),
            }).create();

            const member = await new MemberFactory({
                organization,
                firstName: 'John',
                lastName: 'Doe',
                birthDay: { year: 1994, month: 6, day: 24 },
            }).create();

            const patch: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();

            patch.addPut(RegistrationInvitationRequest.create({
                groupId: group.id,
                memberId: member.id,
            }));

            // assert
            await expect(patchInvitations({
                patch,
                organization,
                user,
            })).rejects.toThrow('Je hebt geen toegangsrechten om dit lid uit te nodigen.');
        });

        test('Should fail if already registered', async () => {
            const organization = await new OrganizationFactory({}).create();
            const groupName = 'test groep';
            const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
            const resources = new Map();

            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]]),
            );

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources,
                }),
            }).create();

            const member = await new MemberFactory({
                organization, user,
                firstName: 'John',
                lastName: 'Doe',
                birthDay: { year: 1994, month: 6, day: 24 },
            }).create();

            await new RegistrationFactory({ member, group }).create();

            const patch: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();

            patch.addPut(RegistrationInvitationRequest.create({
                groupId: group.id,
                memberId: member.id,
            }));

            // assert
            await expect(patchInvitations({
                patch,
                organization,
                user,
            })).rejects.toThrow('The member is already registered for this group');
        });
    });

    describe('Patch invitation', () => {
        test('Should not be supported', async () => {
            const organization = await new OrganizationFactory({}).create();
            const groupName = 'test groep';
            const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
            const resources = new Map();

            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]]),
            );

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources,
                }),
            }).create();

            const member = await new MemberFactory({
                organization, user,
                firstName: 'John',
                lastName: 'Doe',
                birthDay: { year: 1994, month: 6, day: 24 },
            }).create();

            const patch: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();

            patch.addPatch(RegistrationInvitationRequest.patch({
                id: 'does not matter',
                groupId: group.id,
                memberId: member.id,
            }));

            // assert
            await expect(patchInvitations({
                patch,
                organization,
                user,
            })).rejects.toThrow('Patching invitations is not supported. Only puts and deletes are supported.');
        });
    });

    describe('Delete invitation', () => {
        test('Happy path', async () => {
            const organization = await new OrganizationFactory({}).create();
            const groupName = 'test groep';
            const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
            const resources = new Map();

            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]]),
            );

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources,
                }),
            }).create();

            const member = await new MemberFactory({
                organization,
                user,
                firstName: 'John',
                lastName: 'Doe',
                birthDay: { year: 1994, month: 6, day: 24 },
            }).create();

            const invitation = await new RegistrationInvitationFactory({ member, group, organization }).create();

            const patch: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();

            patch.addDelete(invitation.id);

            const response = await patchInvitations({
                patch,
                organization,
                user,
            });

            // assert
            expect(response.body).toBeDefined();
            expect(response.body).toHaveLength(0);
        });

        test('Should be able to delete if access to group but not to member', async () => {
            const organization = await new OrganizationFactory({}).create();
            const groupName = 'test groep';
            const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
            const resources = new Map();

            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]]),
            );

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources,
                }),
            }).create();

            // user has no access to this member
            const member = await new MemberFactory({
                organization,
                firstName: 'John',
                lastName: 'Doe',
                birthDay: { year: 1994, month: 6, day: 24 },
            }).create();

            const invitation = await new RegistrationInvitationFactory({ member, group, organization }).create();

            const patch: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();

            patch.addDelete(invitation.id);

            const response = await patchInvitations({
                patch,
                organization,
                user,
            });

            // assert
            expect(response.body).toBeDefined();
            expect(response.body).toHaveLength(0);
        });

        test('Should fail if no write access to group', async () => {
            const organization = await new OrganizationFactory({}).create();
            const groupName = 'test groep';
            const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
            const resources = new Map();

            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources,
                }),
            }).create();

            const member = await new MemberFactory({
                organization, user,
                firstName: 'John',
                lastName: 'Doe',
                birthDay: { year: 1994, month: 6, day: 24 },
            }).create();

            const invitation = await new RegistrationInvitationFactory({ member, group, organization }).create();

            const patch: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();

            patch.addDelete(invitation.id);

            await expect(patchInvitations({
                patch,
                organization,
                user,
            })).rejects.toThrow('Je hebt geen toegangsrechten om deze uitnodiging te verwijderen.');
        });
    });
});
