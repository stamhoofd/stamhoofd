import { AccessRight, AccessRightHelper } from './AccessRight.js';
import { MemberResponsibility } from './MemberResponsibility.js';
import { MemberResponsibilityRecordBase } from './members/MemberResponsibilityRecord.js';
import { PermissionLevel } from './PermissionLevel.js';
import { PermissionRole, PermissionRoleDetailed, PermissionRoleForResponsibility } from './PermissionRole.js';
import { Permissions } from './Permissions.js';
import { PermissionsResourceType } from './PermissionsResourceType.js';
import { Platform, PlatformConfig, PlatformPrivateConfig } from './Platform.js';
import { ResourcePermissions } from './ResourcePermissions.js';
import type { OrganizationForPermissionCalculation } from './UserPermissions.js';
import { UserPermissions } from './UserPermissions.js';

/**
 * Build the resources map that grants platform level permissions per organization tag.
 * The empty string key means 'all tags'.
 */
function createTagResources(tagPermissions: Record<string, ResourcePermissions>) {
    return new Map([
        [PermissionsResourceType.OrganizationTags, new Map(Object.entries(tagPermissions))],
    ]);
}

/**
 * A user that only received permissions at the platform level, limited to specific organization tags.
 */
function createUserWithTagPermissions(tagPermissions: Record<string, ResourcePermissions>, organizationPermissions?: Record<string, Permissions>) {
    return UserPermissions.create({
        globalPermissions: Permissions.create({
            resources: createTagResources(tagPermissions),
        }),
        organizationPermissions: new Map(Object.entries(organizationPermissions ?? {})),
    });
}

function createPlatform(options?: { responsibilities?: MemberResponsibility[]; roles?: PermissionRoleDetailed[] }) {
    return Platform.create({
        config: PlatformConfig.create({
            responsibilities: options?.responsibilities ?? [],
        }),
        privateConfig: PlatformPrivateConfig.create({
            roles: options?.roles ?? [],
        }),
    });
}

function createOrganization(options?: { id?: string; tags?: string[]; roles?: PermissionRoleDetailed[]; responsibilities?: MemberResponsibility[] }): OrganizationForPermissionCalculation {
    return {
        id: options?.id ?? 'organization-1',
        meta: {
            tags: options?.tags ?? [],
        },
        privateMeta: {
            roles: options?.roles ?? [],
            responsibilities: options?.responsibilities ?? [],
            inheritedResponsibilityRoles: [],
        },
    };
}

describe('Unit.UserPermissions', () => {
    describe('forPlatform', () => {
        test('returns null for a user without global permissions', () => {
            const userPermissions = UserPermissions.create({});
            expect(userPermissions.forPlatform(createPlatform())).toBeNull();
        });

        test('grants the prohibited organization level access rights to full platform admins', () => {
            const prohibited = AccessRightHelper.prohibitedOrganizationLevelAccessRights();

            // Sanity check: without prohibited rights this test would be meaningless
            expect(prohibited.length).toBeGreaterThan(0);

            const userPermissions = UserPermissions.create({
                globalPermissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            });

            const result = userPermissions.forPlatform(createPlatform());

            expect(result).not.toBeNull();
            expect(result!.hasFullAccess()).toBe(true);

            for (const right of prohibited) {
                expect(result!.accessRights).toContain(right);
                expect(result!.hasAccessRight(right)).toBe(true);
            }
        });

        test('does not grant the prohibited organization level access rights to platform users without full access', () => {
            const userPermissions = UserPermissions.create({
                globalPermissions: Permissions.create({
                    level: PermissionLevel.Write,
                }),
            });

            const result = userPermissions.forPlatform(createPlatform());

            expect(result).not.toBeNull();
            expect(result!.hasFullAccess()).toBe(false);

            for (const right of AccessRightHelper.prohibitedOrganizationLevelAccessRights()) {
                expect(result!.accessRights).not.toContain(right);
                expect(result!.hasAccessRight(right)).toBe(false);
            }
        });
    });

    describe('forOrganization', () => {
        test('inherits the platform level permissions of a matching tag by default', () => {
            const userPermissions = createUserWithTagPermissions({
                'tag-a': ResourcePermissions.create({
                    level: PermissionLevel.Write,
                    accessRights: [AccessRight.MemberManageNRN],
                }),
            });
            const platform = createPlatform();
            const organization = createOrganization({ tags: ['tag-a'] });

            for (const result of [
                userPermissions.forOrganization(organization, platform),
                userPermissions.forOrganization(organization, platform, { inheritFromPlatform: true }),
            ]) {
                expect(result).not.toBeNull();
                expect(result!.hasWriteAccess()).toBe(true);
                expect(result!.hasFullAccess()).toBe(false);
                expect(result!.hasAccessRight(AccessRight.MemberManageNRN)).toBe(true);
            }
        });

        test('does not inherit the platform level permissions when inheritFromPlatform is false', () => {
            const userPermissions = createUserWithTagPermissions({
                'tag-a': ResourcePermissions.create({
                    level: PermissionLevel.Write,
                    accessRights: [AccessRight.MemberManageNRN],
                }),
            });
            const platform = createPlatform();
            const organization = createOrganization({ tags: ['tag-a'] });

            // Same user and same organization as the test above, which does get access
            expect(userPermissions.forOrganization(organization, platform, { inheritFromPlatform: false })).toBeNull();
        });

        test('does not inherit the permissions of a tag the organization does not have', () => {
            const userPermissions = createUserWithTagPermissions({
                'tag-a': ResourcePermissions.create({
                    level: PermissionLevel.Write,
                }),
            });

            expect(
                userPermissions.forOrganization(createOrganization({ tags: ['tag-b'] }), createPlatform()),
            ).toBeNull();
        });

        test('applies platform permissions granted on the empty tag to an organization without tags', () => {
            const userPermissions = createUserWithTagPermissions({
                // The empty string means 'all organization tags'
                '': ResourcePermissions.create({
                    level: PermissionLevel.Read,
                }),
            });
            const platform = createPlatform();

            const untagged = userPermissions.forOrganization(createOrganization({ tags: [] }), platform);
            expect(untagged).not.toBeNull();
            expect(untagged!.hasReadAccess()).toBe(true);
            expect(untagged!.hasWriteAccess()).toBe(false);

            // ...and to tagged organizations too
            const tagged = userPermissions.forOrganization(createOrganization({ tags: ['tag-a'] }), platform);
            expect(tagged).not.toBeNull();
            expect(tagged!.hasReadAccess()).toBe(true);
        });

        test('does not apply platform permissions of a specific tag to an organization without tags', () => {
            const userPermissions = createUserWithTagPermissions({
                'tag-a': ResourcePermissions.create({
                    level: PermissionLevel.Read,
                }),
            });

            expect(
                userPermissions.forOrganization(createOrganization({ tags: [] }), createPlatform()),
            ).toBeNull();
        });

        test('merges the permissions of all matching tags', () => {
            const userPermissions = createUserWithTagPermissions({
                'tag-a': ResourcePermissions.create({
                    level: PermissionLevel.Read,
                    accessRights: [AccessRight.MemberManageNRN],
                }),
                'tag-b': ResourcePermissions.create({
                    level: PermissionLevel.Write,
                    accessRights: [AccessRight.OrganizationEventNotificationReviewer],
                }),
                'tag-c': ResourcePermissions.create({
                    level: PermissionLevel.Full,
                }),
            });

            const result = userPermissions.forOrganization(
                createOrganization({ tags: ['tag-a', 'tag-b'] }),
                createPlatform(),
            );

            expect(result).not.toBeNull();

            // The highest level of all matching tags wins, the tag the organization doesn't have is ignored
            expect(result!.hasWriteAccess()).toBe(true);
            expect(result!.hasFullAccess()).toBe(false);

            expect(result!.hasAccessRight(AccessRight.MemberManageNRN)).toBe(true);
            expect(result!.hasAccessRight(AccessRight.OrganizationEventNotificationReviewer)).toBe(true);
        });

        test('returns null when there are no inherited and no organization specific permissions', () => {
            const userPermissions = UserPermissions.create({
                globalPermissions: Permissions.create({}),
            });

            expect(
                userPermissions.forOrganization(createOrganization({ tags: ['tag-a'] }), createPlatform()),
            ).toBeNull();
        });

        test('merges the organization specific permissions with the inherited permissions', () => {
            const userPermissions = createUserWithTagPermissions(
                {
                    'tag-a': ResourcePermissions.create({
                        level: PermissionLevel.Read,
                        accessRights: [AccessRight.OrganizationEventNotificationReviewer],
                    }),
                },
                {
                    'organization-1': Permissions.create({
                        level: PermissionLevel.Write,
                    }),
                },
            );
            const platform = createPlatform();
            const organization = createOrganization({ id: 'organization-1', tags: ['tag-a'] });

            const result = userPermissions.forOrganization(organization, platform);
            expect(result).not.toBeNull();

            // Write comes from the organization specific permissions, Read from the tag
            expect(result!.hasWriteAccess()).toBe(true);

            // Prohibited organization level access rights survive when they are inherited from the platform
            expect(result!.hasAccessRight(AccessRight.OrganizationEventNotificationReviewer)).toBe(true);

            // Without inheriting, only the organization specific permissions remain
            const withoutInherit = userPermissions.forOrganization(organization, platform, { inheritFromPlatform: false });
            expect(withoutInherit).not.toBeNull();
            expect(withoutInherit!.hasWriteAccess()).toBe(true);
            expect(withoutInherit!.hasAccessRight(AccessRight.OrganizationEventNotificationReviewer)).toBe(false);
        });
    });

    describe('forWithoutInherit', () => {
        test('returns null when the user has no permissions for the organization', () => {
            const userPermissions = createUserWithTagPermissions({
                'tag-a': ResourcePermissions.create({
                    level: PermissionLevel.Full,
                }),
            });

            expect(
                userPermissions.forWithoutInherit(createOrganization({ tags: ['tag-a'] }), createPlatform()),
            ).toBeNull();
        });

        test('resolves responsibilities from the platform and ignores platform level tag permissions', () => {
            const responsibility = MemberResponsibility.create({
                id: 'responsibility-1',
                name: 'Functienaam',
                permissions: PermissionRoleForResponsibility.create({
                    responsibilityId: 'responsibility-1',
                    level: PermissionLevel.Write,
                    accessRights: [AccessRight.MemberManageNRN],
                }),
            });

            const userPermissions = createUserWithTagPermissions(
                {
                    'tag-a': ResourcePermissions.create({
                        level: PermissionLevel.Full,
                    }),
                },
                {
                    'organization-1': Permissions.create({
                        responsibilities: [
                            MemberResponsibilityRecordBase.create({
                                responsibilityId: responsibility.id,
                                memberId: 'member-1',
                                groupId: null,
                                startDate: new Date(0),
                                endDate: null,
                            }),
                        ],
                    }),
                },
            );

            const platform = createPlatform({ responsibilities: [responsibility] });
            const organization = createOrganization({ id: 'organization-1', tags: ['tag-a'] });

            const result = userPermissions.forWithoutInherit(organization, platform);
            expect(result).not.toBeNull();

            // The responsibility of the platform is resolved
            expect(result!.hasWriteAccess()).toBe(true);
            expect(result!.hasAccessRight(AccessRight.MemberManageNRN)).toBe(true);

            // ...but the full access of the tag is not inherited
            expect(result!.hasFullAccess()).toBe(false);

            // While forOrganization does inherit it
            expect(userPermissions.forOrganization(organization, platform)!.hasFullAccess()).toBe(true);
        });

        test('removes prohibited organization level access rights from organization roles', () => {
            const role = PermissionRoleDetailed.create({
                id: 'role-1',
                name: 'Rolnaam',
                level: PermissionLevel.Read,
                accessRights: [AccessRight.OrganizationEventNotificationReviewer, AccessRight.MemberManageNRN],
            });

            const userPermissions = UserPermissions.create({
                organizationPermissions: new Map([
                    ['organization-1', Permissions.create({
                        roles: [PermissionRole.create({ id: role.id, name: role.name })],
                    })],
                ]),
            });

            const result = userPermissions.forWithoutInherit(
                createOrganization({ id: 'organization-1', roles: [role] }),
                createPlatform(),
            );

            expect(result).not.toBeNull();
            expect(result!.hasReadAccess()).toBe(true);
            expect(result!.hasAccessRight(AccessRight.MemberManageNRN)).toBe(true);
            expect(result!.hasAccessRight(AccessRight.OrganizationEventNotificationReviewer)).toBe(false);

            // The original role is not altered
            expect(role.accessRights).toEqual([AccessRight.OrganizationEventNotificationReviewer, AccessRight.MemberManageNRN]);
        });
    });
});
