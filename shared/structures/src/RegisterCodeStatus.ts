import { ArrayDecoder, AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";

export class UsedRegisterCode extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder })
    organizationName: string

    @field({ decoder: DateDecoder })
    createdAt: Date

    @field({ decoder: IntegerDecoder, nullable: true })
    creditValue: number | null = null
}

export class RegisterCodeStatus extends AutoEncoder {
    @field({ decoder: StringDecoder })
    code: string

    @field({ decoder: new ArrayDecoder(UsedRegisterCode) })
    usedCodes: UsedRegisterCode[] = []
}