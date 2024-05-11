import { AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

export class Registration extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4()  })
    id: string

    /// You need to look up the group yourself in the organization
    @field({ decoder: StringDecoder })
    groupId: string

    @field({ decoder: StringDecoder, version: 250 })
    organizationId: string

    @field({ decoder: IntegerDecoder })
    cycle: number

    /// Set registeredAt to null if the member is on the waiting list for now
    @field({ decoder: DateDecoder, nullable: true })
    registeredAt: Date | null = null

    /// Keep spot for this member temporarily
    @field({ decoder: DateDecoder, nullable: true })
    reservedUntil: Date | null = null

    @field({ decoder: DateDecoder, nullable: true })
    deactivatedAt: Date | null = null

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date()

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date()

    @field({ decoder: BooleanDecoder, version: 16 })
    waitingList = false

    @field({ decoder: BooleanDecoder, version: 20 })
    canRegister = false

    @field({ decoder: IntegerDecoder, optional: true })
    price = 0

    @field({ decoder: IntegerDecoder, optional: true })
    pricePaid = 0

    /// Payment can be null if the member is on a waiting list
    // @field({ decoder: Payment, nullable: true })
    // payment: Payment | null = null
}
