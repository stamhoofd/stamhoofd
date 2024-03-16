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

    @field({ decoder: IntegerDecoder, version: 231 })
    value: number = 0

    @field({ decoder: IntegerDecoder, nullable: true, version: 231 })
    invoiceValue: number|null = null
}

export class RegisterCode extends AutoEncoder {
    @field({ decoder: StringDecoder })
    code: string

    @field({ decoder: StringDecoder })
    description: string

    @field({ decoder: StringDecoder, nullable: true })
    customMessage: string|null = null

    @field({ decoder: StringDecoder, nullable: true })
    organizationName: string|null

    @field({ decoder: IntegerDecoder })
    value: number = 0
}