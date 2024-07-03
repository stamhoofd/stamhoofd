import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

import { PermissionRoleDetailed } from "./Permissions";
import { User } from "./User";
import { OrganizationRecordsConfiguration } from "./members/OrganizationRecordsConfiguration";
import { DefaultAgeGroup } from "./DefaultAgeGroup";
import { MemberResponsibility } from "./MemberResponsibility";
import { RegistrationPeriod } from "./RegistrationPeriod";

export class PlatformPrivateConfig extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(PermissionRoleDetailed) })
    roles: PermissionRoleDetailed[] = []
}

export class OrganizationTag extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ''
}

export class MembershipTypeConfigPrice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;
    
    @field({ decoder: DateDecoder, nullable: true })
    startDate: Date|null = null

    @field({ decoder: IntegerDecoder })
    price = 0
    
    /**
     * If you set this, it will be possible to choose a custom start and end date within the startDate - endDate period
     */
    @field({ decoder: IntegerDecoder })
    pricePerDay = 0
}

export class MembershipTypeConfig extends AutoEncoder {
    @field({ decoder: DateDecoder })
    startDate = new Date()

    @field({ decoder: DateDecoder })
    endDate = new Date()

    @field({ decoder: DateDecoder, nullable: true })
    expireDate: Date|null = null

    @field({ decoder: IntegerDecoder })
    amountFree = 0

    @field({ decoder: new ArrayDecoder(MembershipTypeConfigPrice) })
    prices: MembershipTypeConfigPrice[] = [MembershipTypeConfigPrice.create({})]
    
}

export enum MembershipTypeBehaviour {
    /**
     * A membership that is valid for a certain period
     */
    Period = "Period",

    /**
     * A membership that is valid for a certain number of days
     */
    Days = "Days"
}

export class MembershipType extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ''

    @field({ decoder: StringDecoder })
    description = ''

    @field({ decoder: new EnumDecoder(MembershipTypeBehaviour) })
    behaviour = MembershipTypeBehaviour.Period

    /**
     * Settings per period
     */
    @field({ decoder: new MapDecoder(StringDecoder, MembershipTypeConfig) })
    periods: Map<string, MembershipTypeConfig> = new Map()

    /**
     * Only allow organizations with these tags to use this membership type
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    requiredTagIds: string[]|null = null;
}

export class PlatformConfig extends AutoEncoder {
    @field({ decoder: OrganizationRecordsConfiguration, version: 253 })
    recordsConfiguration = OrganizationRecordsConfiguration.create({})

    @field({ decoder: new ArrayDecoder(OrganizationTag), version: 260 })
    tags: OrganizationTag[] = []

    @field({ decoder: new ArrayDecoder(DefaultAgeGroup), version: 261 })
    defaultAgeGroups: DefaultAgeGroup[] = []

    @field({ decoder: new ArrayDecoder(MemberResponsibility), version: 262 })
    responsibilities: MemberResponsibility[] = []

    @field({ decoder: new ArrayDecoder(MembershipType), version: 268 })
    membershipTypes: MembershipType[] = []
}

export class Platform extends AutoEncoder {
    static instance: Platform|null = null

    @field({ decoder: PlatformConfig })
    config: PlatformConfig = PlatformConfig.create({})

    @field({ decoder: PlatformPrivateConfig, nullable: true })
    privateConfig: PlatformPrivateConfig|null = null;

    @field({ decoder: RegistrationPeriod })
    period: RegistrationPeriod = RegistrationPeriod.create({})

    /**
     * Keep admins accessible and in memory
     */
    admins?: User[]

    /**
     * Keep admins accessible and in memory
     */
    periods?: RegistrationPeriod[]

    /**
     * If you don't have permissions, privateConfig will be null, so there won't be any roles either
     */
    getRoles() {
        return this.privateConfig?.roles ?? []
    }

    static get shared(): Platform {
        if (!Platform.instance) {
            Platform.instance = Platform.create({})
        }
        return Platform.instance
    }

    static get optionalShared(): Platform | null {
        return Platform.instance
    }

    static clearShared() {
        Platform.instance = null
    }

    setShared() {
        Platform.instance = this
    }
}
