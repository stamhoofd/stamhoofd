import { AutoEncoder, DateDecoder, IntegerDecoder, StringDecoder, field } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

export class MemberPlatformMembership extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    memberId: string;

    @field({ decoder: StringDecoder })
    membershipTypeId: string;

    @field({ decoder: StringDecoder })
    organizationId: string;

    @field({ decoder: StringDecoder })
    periodId: string;

    @field({ decoder: DateDecoder })
    startDate = new Date()

    @field({ decoder: DateDecoder })
    endDate = new Date()

    @field({ decoder: DateDecoder, nullable: true })
    expireDate: Date|null = null

    @field({ decoder: StringDecoder, nullable: true })
    invoiceItemDetailId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    invoiceId: string | null = null;

    @field({ decoder: IntegerDecoder })
    price = 0;

    @field({ decoder: DateDecoder })
    createdAt = new Date()

    @field({ decoder: DateDecoder })
    updatedAt = new Date()
}
