
import { AutoEncoder, AutoEncoderPatchType, field, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { AccessRight, getPermissionLevelNumber, LoadedPermissions, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions } from './Permissions';
import { Platform } from './Platform';

export class UserPermissions extends AutoEncoder {
    @field({ decoder: Permissions, nullable: true })
    globalPermissions: Permissions | null = null

    @field({ decoder: new MapDecoder(StringDecoder, Permissions) })
    organizationPermissions: Map<string, Permissions> = new Map()

    get platform(): LoadedPermissions|null {
        return this.forPlatform(Platform.shared)
    }

    forPlatform(platform: Platform): LoadedPermissions|null {
        if (!this.globalPermissions) {
            return null;
        }

        const platformRoles = platform.getRoles()
        return LoadedPermissions.from(this.globalPermissions, platformRoles)
    }

    forOrganization(organization: {id: string, meta: {tags: string[]}, privateMeta?: {roles: PermissionRoleDetailed[]}|null}, platform?: Platform|null): LoadedPermissions|null {
        let base: ResourcePermissions|null = null
        const organizationRoles = organization?.privateMeta?.roles ?? []
        if (platform) {
            const platformPermissions = this.forPlatform(platform);

            if (platformPermissions) {
                const tags = organization.meta.tags.length === 0 ? [""] : organization.meta.tags

                for (const tag of tags) {
                    const rp = platformPermissions.getMergedResourcePermissions(PermissionsResourceType.OrganizationTags, tag);
                    if (rp) {
                        const pp = Permissions.create({
                            level: rp.level,
                        })

                        if (rp.hasAccess(PermissionLevel.Full)) {
                            return LoadedPermissions.from(pp, organizationRoles)
                        }
                        base = base ? base.merge(rp) : rp
                    }
                }
            }
        }

        const specific = this.forWithoutInherit(organization.id, organizationRoles)

        if (base) {
            const p = LoadedPermissions.from(
                Permissions.create({
                    level: base.level,
                }),
                organizationRoles
            )

            if (!specific) {
                return p
            }
            
            return specific.merge(p)
        }

        return specific
    }

    forWithoutInherit(organizationId: string, organizationRoles: PermissionRoleDetailed[]): LoadedPermissions|null {
        const permissions = this.organizationPermissions.get(organizationId) ?? null
        if (!permissions) {
            return null;
        }
        return LoadedPermissions.from(permissions, organizationRoles)
    }

    convertPlatformPatch(patch: AutoEncoderPatchType<Permissions>|null): AutoEncoderPatchType<UserPermissions> {
        if (!this.globalPermissions) {
            const clonedPatch = UserPermissions.patch({
                globalPermissions: patch === null ? null : Permissions.create({}).patch(patch)
            })
            return clonedPatch
        }
        return UserPermissions.patch({
            globalPermissions: patch
        })
    }

    convertPatch(patch: AutoEncoderPatchType<Permissions>|null, organizationId: string): AutoEncoderPatchType<UserPermissions> {
        if (!this.organizationPermissions.get(organizationId)) {
            const clonedPatch = UserPermissions.patch({})
            clonedPatch.organizationPermissions.set(organizationId, patch === null ? null : Permissions.create({}).patch(patch))
            return clonedPatch
        }
        const clonedPatch = UserPermissions.patch({})
        clonedPatch.organizationPermissions.set(organizationId, patch)
        return clonedPatch
    }

    get isEmpty(): boolean {
        return this.globalPermissions === null && this.organizationPermissions.size === 0
    }

    static limitedPatch(old: UserPermissions|null, patch: UserPermissions|AutoEncoderPatchType<UserPermissions>|null, organizationId: string): UserPermissions|null {
        if (patch === null) {
            return old;
        }
        
        if (patch.isPatch()) {
            // Only allow to set the permissions for the organization in scope
            if (patch.organizationPermissions.get(organizationId) !== undefined) {
                const clonedPatch = UserPermissions.patch({})
                clonedPatch.organizationPermissions.set(organizationId, patch.organizationPermissions.get(organizationId))
                const updated = old ? old.patch(clonedPatch) : UserPermissions.create({}).patch(clonedPatch)

                if (updated.isEmpty) {
                    return null;
                }
                return updated
            }
        } else {
            // Only allow to set the permissions for the organization in scope
            if (patch.organizationPermissions.get(organizationId)) {
                const clonedPatch = UserPermissions.patch({})
                clonedPatch.organizationPermissions.set(organizationId, patch.organizationPermissions.get(organizationId))
                const updated = old ? old.patch(clonedPatch) : UserPermissions.create({}).patch(clonedPatch)

                if (updated.isEmpty) {
                    return null;
                }
                return updated
            }
        }
        
        return old
    }

    static limitedAdd(old: UserPermissions|null, add: UserPermissions, organizationId: string): UserPermissions|null {
        if (add.organizationPermissions.get(organizationId)) {
            const cloned = old ? old.clone() : UserPermissions.create({});
            const realAdd = add.organizationPermissions.get(organizationId) as Permissions
            const realOld = cloned ? cloned.organizationPermissions.get(organizationId) : null
            
            if (!realOld) {
                cloned.organizationPermissions.set(organizationId, realAdd)
                return cloned;
            }

            realOld.add(realAdd)
            return cloned
        }
        return old
    }
}
