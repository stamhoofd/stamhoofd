import { AutoEncoder, AutoEncoderPatchType, field, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { AccessRightHelper } from './AccessRight.js';
import { LoadedPermissions } from './LoadedPermissions.js';
import { MemberResponsibility } from './MemberResponsibility.js';
import { PermissionLevel } from './PermissionLevel.js';
import { PermissionRoleDetailed, PermissionRoleForResponsibility } from './PermissionRole.js';
import { Permissions } from './Permissions.js';
import { PermissionsResourceType } from './PermissionsResourceType.js';
import { Platform } from './Platform.js';

export type OrganizationForPermissionCalculation = {
    id: string;
    meta: {
        tags: string[];
    };
    privateMeta?: {
        roles: PermissionRoleDetailed[];
        responsibilities: MemberResponsibility[];
        inheritedResponsibilityRoles: PermissionRoleForResponsibility[];
    } | null;
};

export class UserPermissions extends AutoEncoder {
    @field({ decoder: Permissions, nullable: true })
    globalPermissions: Permissions | null = null;

    @field({ decoder: new MapDecoder(StringDecoder, Permissions) })
    organizationPermissions: Map<string, Permissions> = new Map();

    // Current list of groups

    get platform(): LoadedPermissions | null {
        return this.forPlatform(Platform.shared);
    }

    forPlatform(platform: Platform): LoadedPermissions | null {
        if (!this.globalPermissions) {
            return null;
        }

        const platformRoles = platform.getRoles();
        const base = LoadedPermissions.from(
            this.globalPermissions,
            platformRoles,
            [],
            platform.config.responsibilities,
        );

        if (base.hasFullAccess()) {
            // Since the prohibited organization level access rights are not automatically
            // inherited if you have full access, we'll need to add them manually for full platform admins
            base.add(
                LoadedPermissions.create({
                    level: PermissionLevel.Full,
                    accessRights: [...AccessRightHelper.prohibitedOrganizationLevelAccessRights()],
                }),
            );
        }

        return base;
    }

    forOrganization(organization: OrganizationForPermissionCalculation, platform?: Platform | null): LoadedPermissions | null {
        const base: LoadedPermissions = LoadedPermissions.create({});

        if (platform) {
            const platformPermissions = this.forPlatform(platform);

            if (platformPermissions) {
                const tags = organization.meta.tags.length === 0 ? [''] : organization.meta.tags;

                for (const tag of tags) {
                    const rp = platformPermissions.getMergedResourcePermissions(PermissionsResourceType.OrganizationTags, tag);
                    if (rp) {
                        base.add(rp);
                    }
                }
            }
        }

        const specific = this.forWithoutInherit(organization);

        if (!specific) {
            if (base.isEmpty) {
                return null;
            }
            return base;
        }
        specific.add(base);
        return specific;
    }

    forWithoutInherit(organization: OrganizationForPermissionCalculation): LoadedPermissions | null {
        const permissions = this.organizationPermissions.get(organization.id) ?? null;
        if (!permissions) {
            return null;
        }
        const organizationRoles = organization?.privateMeta?.roles ?? [];
        const inheritedResponsibilityRoles = organization?.privateMeta?.inheritedResponsibilityRoles ?? [];
        const allResponsibilities = [...Platform.shared.config.responsibilities, ...(organization?.privateMeta?.responsibilities ?? [])];

        // Clone all external data to avoid mutating them because of the removeAccessRights call
        const result = LoadedPermissions.from(permissions.clone(), organizationRoles.map(r => r.clone()), inheritedResponsibilityRoles.map(r => r.clone()), allResponsibilities.map(r => r.clone()));

        // Some access rights are not allowed to be used directly in the organization permissions
        // they can only be passed from the platform permissions towards the organization permissions as access rights for tags (e.g. review event notifications)
        // So these access rights need to be filtered out here
        result.removeAccessRights(AccessRightHelper.prohibitedOrganizationLevelAccessRights());

        return result;
    }

    convertPlatformPatch(patch: AutoEncoderPatchType<Permissions> | null): AutoEncoderPatchType<UserPermissions> {
        if (!this.globalPermissions) {
            const clonedPatch = UserPermissions.patch({
                globalPermissions: patch === null ? null : Permissions.create({}).patch(patch),
            });
            return clonedPatch;
        }
        return UserPermissions.patch({
            globalPermissions: patch,
        });
    }

    convertPatch(patch: AutoEncoderPatchType<Permissions> | null, organizationId: string): AutoEncoderPatchType<UserPermissions> {
        if (!this.organizationPermissions.get(organizationId)) {
            const clonedPatch = UserPermissions.patch({});
            const p = patch === null ? null : Permissions.create({}).patch(patch);
            clonedPatch.organizationPermissions.set(organizationId, p);
            return clonedPatch;
        }
        const clonedPatch = UserPermissions.patch({});
        clonedPatch.organizationPermissions.set(organizationId, patch);
        return clonedPatch;
    }

    clearEmptyPermissions() {
        if (this.globalPermissions && this.globalPermissions.isEmpty) {
            this.globalPermissions = null;
        }

        for (const [organizationId, permissions] of this.organizationPermissions) {
            if (permissions.isEmpty) {
                this.organizationPermissions.delete(organizationId);
            }
        }
    }

    get isEmpty(): boolean {
        return this.globalPermissions === null && this.organizationPermissions.size === 0;
    }

    static limitedPatch(old: UserPermissions | null, patch: UserPermissions | AutoEncoderPatchType<UserPermissions> | null, organizationId: string): UserPermissions | null {
        if (patch === null) {
            return old;
        }

        if (patch.isPatch()) {
            // Only allow to set the permissions for the organization in scope
            if (patch.organizationPermissions.get(organizationId) !== undefined) {
                const clonedPatch = UserPermissions.patch({});
                clonedPatch.organizationPermissions.set(organizationId, patch.organizationPermissions.get(organizationId));

                const updated = old ? old.patch(clonedPatch) : UserPermissions.create({}).patch(clonedPatch);

                // Maintain responsibilities (not editable with a limited patch)
                const n = updated.organizationPermissions.get(organizationId);
                const o = old?.organizationPermissions.get(organizationId)?.responsibilities;
                if (n) {
                    n.responsibilities = o ?? [];
                }
                else {
                    if (o && o.length) {
                        // Keep responsibilities
                        const kept = Permissions.create({
                            responsibilities: o,
                        });
                        updated.organizationPermissions.set(organizationId, kept);
                    }
                }

                if (updated.isEmpty) {
                    return null;
                }
                return updated;
            }
        }
        else {
            // Only allow to set the permissions for the organization in scope
            if (patch.organizationPermissions.get(organizationId) !== undefined) {
                const clonedPatch = UserPermissions.patch({});
                clonedPatch.organizationPermissions.set(organizationId, patch.organizationPermissions.get(organizationId));
                const updated = old ? old.patch(clonedPatch) : UserPermissions.create({}).patch(clonedPatch);

                // Maintain responsibilities (not editable with a limited patch)
                const n = updated.organizationPermissions.get(organizationId);
                const o = old?.organizationPermissions.get(organizationId)?.responsibilities;
                if (n) {
                    n.responsibilities = o ?? [];
                }
                else {
                    if (o && o.length) {
                        // Keep responsibilities
                        const kept = Permissions.create({
                            responsibilities: o,
                        });
                        updated.organizationPermissions.set(organizationId, kept);
                    }
                }

                if (updated.isEmpty) {
                    return null;
                }
                return updated;
            }
        }

        return old;
    }

    static limitedAdd(old: UserPermissions | null, add: UserPermissions, organizationId: string): UserPermissions | null {
        if (add.organizationPermissions.get(organizationId)) {
            const cloned = old ? old.clone() : UserPermissions.create({});
            const realAdd = add.organizationPermissions.get(organizationId) as Permissions;
            const realOld = cloned ? cloned.organizationPermissions.get(organizationId) : null;

            if (!realOld) {
                cloned.organizationPermissions.set(organizationId, realAdd);
                return cloned;
            }

            realOld.add(realAdd);
            return cloned;
        }
        return old;
    }

    static add(old: UserPermissions | null, add: UserPermissions): UserPermissions | null {
        const cloned = old ? old.clone() : UserPermissions.create({});

        if (add.globalPermissions) {
            if (cloned.globalPermissions) {
                cloned.globalPermissions.add(add.globalPermissions);
            }
            else {
                cloned.globalPermissions = add.globalPermissions;
            }
        }

        for (const [organizationId, permissions] of add.organizationPermissions) {
            if (cloned.organizationPermissions.get(organizationId)) {
                cloned.organizationPermissions.get(organizationId)!.add(permissions);
            }
            else {
                cloned.organizationPermissions.set(organizationId, permissions);
            }
        }

        return cloned;
    }
}
