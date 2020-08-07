import { AutoEncoder,BooleanDecoder,DateDecoder,field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding"

import { EncryptedMember } from "./EncryptedMember"

export class RegistrationWithEncryptedMember extends AutoEncoder  {
    @field({ decoder: StringDecoder })
    id: string

    /// You need to look up the group yourself in the organization
    @field({ decoder: StringDecoder })
    groupId: string

    @field({ decoder: IntegerDecoder })
    cycle: number

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

    @field({ decoder: BooleanDecoder, version: 20 })
    canRegister = false

    @field({ decoder: EncryptedMember })
    member: EncryptedMember
}