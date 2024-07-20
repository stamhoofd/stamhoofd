import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, IntegerDecoder, StringDecoder, field } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";
import { PermissionLevel } from "./Permissions";

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
     * @deprecated
     * Group full-admins can assign this responsibility to members
     */
    @field({ decoder: BooleanDecoder, optional: true})
    assignableByOrganizations = true

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

    @field({ decoder: new EnumDecoder(PermissionLevel), version: 276 })
    defaultPermissionLevel: PermissionLevel = PermissionLevel.None

    get isGroupBased() {
        return this.defaultAgeGroupIds !== null
    }
    
}
