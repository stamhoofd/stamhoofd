import { AutoEncoder, field, StringDecoder } from "@simonbackx/simple-encoding";

export class MemberSummary extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    firstName: string

    @field({ decoder: StringDecoder })
    lastName: string

    @field({ decoder: StringDecoder, nullable: true })
    email: string | null = null

    @field({ decoder: StringDecoder })
    organizationName: string

    @field({ decoder: StringDecoder })
    organizationId: string
}