import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";
import { Image } from "./files/Image";
import { Group } from "./Group";
import { RichText } from "./RichText";
import { Address } from "./addresses/Address";

export class EventLocation extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ''

    @field({ decoder: Address, nullable: true })
    address: Address|null = null
}

export class EventMeta extends AutoEncoder {
    @field({ decoder: RichText })
    description = RichText.create({})

    @field({ decoder: BooleanDecoder })
    visible = true

    @field({ decoder: EventLocation, nullable: true })
    location: EventLocation|null = null

    /**
     * A valid membership is required for one of these default age groups
     * 
     * null = no restriction
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    defaultAgeGroupIds: string[]|null = null

    /**
     * A valid membership is required for one of these specific groups
     * (only if isGlobal is false)
     * 
     * null = no restriction
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    groupIds: string[]|null = null

    /**
     * A valid membership is required for an organization with one of these tags
     * 
     * null = no restriction (unless isGlobal is false)
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    organizationTagIds: string[]|null = null

    @field({ decoder: Image, nullable: true })
    coverPhoto: Image | null = null
}

export class Event extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ''

    @field({ decoder: StringDecoder })
    typeId = ''

    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string|null = null

    @field({ decoder: DateDecoder })
    startDate = new Date()

    @field({ decoder: DateDecoder })
    endDate = new Date()

    @field({ decoder: EventMeta })
    meta: EventMeta = EventMeta.create({})

    @field({ decoder: Group, nullable: true })
    group: Group|null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date()

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date()
}


export class EventWithRegistrations extends Event {
    // Include information about own members that are registered
}
