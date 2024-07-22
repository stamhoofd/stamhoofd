import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, IntegerDecoder, StringDecoder, field } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";
import { PermissionLevel, PermissionRoleForResponsibility, PermissionsResourceType, ResourcePermissions } from "./Permissions";
import { Group } from "./Group";

export class MemberResponsibility extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;
    
    @field({ decoder: StringDecoder })
    name = ''

    @field({ decoder: StringDecoder })
    description = ''

    @field({ decoder: IntegerDecoder, nullable: true })
    minimumMembers: null | number = null

    @field({ decoder: IntegerDecoder, nullable: true })
    maximumMembers: null | number = null

    /**
     * Whether this is a national responsibility or not
     */
    @field({ decoder: BooleanDecoder, optional: true})
    organizationBased = true

    /**
     * Limit this responsibility to specific organizations
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true, version: 273})
    organizationTagIds: string[]|null = null


    /**
     * Whether this responsibility should be assigned to a specific group (or more) of a specific organization
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true, version: 273})
    defaultAgeGroupIds: string[]|null = null

    /**
     * Automatically grant the following permissions
     */
    @field({ decoder: PermissionRoleForResponsibility, nullable: true, version: 279 })
    permissions: PermissionRoleForResponsibility|null = null

    /**
     * Automatically grant limited permissions to the group associated with this responsibility
     */
    @field({ decoder: new EnumDecoder(PermissionLevel), version: 279 })
    groupPermissionLevel: PermissionLevel = PermissionLevel.None

    get isGroupBased() {
        return this.defaultAgeGroupIds !== null
    }

    createDefaultPermissions(group: Group|null) {
        return PermissionRoleForResponsibility.create({
            name: this.name + (group ? ` van ${group.settings.name}` : ''), 
            responsibilityId: this.id, 
            responsibilityGroupId: group?.id ?? null
        })
    }

    getPermissions(groupId: string|null) {
        const r = this.permissions?.clone() ?? PermissionRoleForResponsibility.create({
            id: this.id,
            name: this.name,
            level: PermissionLevel.None,
            responsibilityId: this.id,
            responsibilityGroupId: groupId,
            resources: new Map()
        }); 

        r.name = this.name
        r.id = this.id + (groupId ? '-'+groupId : '')
        r.responsibilityId = this.id
        r.responsibilityGroupId = groupId

        if (groupId && this.groupPermissionLevel !== PermissionLevel.None) {
            const map: Map<string, ResourcePermissions> = new Map()
            map.set(groupId, ResourcePermissions.create({level: this.groupPermissionLevel}))
            r.resources.set(PermissionsResourceType.Groups, map)
        }

        return r
    }
    
}

export class PlatformResponsibility extends MemberResponsibility {
   // todo

}
