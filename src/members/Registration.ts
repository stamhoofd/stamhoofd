import { AutoEncoder, BooleanDecoder,DateDecoder,field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { Payment } from './Payment';

export class Registration extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    /// You need to look up the group yourself in the organization
    @field({ decoder: StringDecoder })
    groupId: string

    @field({ decoder: IntegerDecoder })
    cycle: number

    /// Set registeredAt to null if the member is on the waiting list for now
    @field({ decoder: DateDecoder, nullable: true })
    registeredAt: Date | null = null

    @field({ decoder: DateDecoder, nullable: true })
    deactivatedAt: Date | null = null

    @field({ decoder: DateDecoder })
    createdAt: Date

    @field({ decoder: DateDecoder })
    updatedAt: Date

    @field({ decoder: BooleanDecoder, version: 16 })
    waitingList = false

    /// Payment can be null if the member is on a waiting list
    @field({ decoder: Payment, nullable: true })
    payment: Payment | null = null
}