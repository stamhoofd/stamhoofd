import { AutoEncoder, DateDecoder, StringDecoder, field } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

export class MemberResponsibilityRecord extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    memberId: string;

    @field({ decoder: StringDecoder })
    organizationId: string;

    @field({ decoder: StringDecoder })
    responsibilityId: string;

    @field({ decoder: DateDecoder})
    startDate: Date = new Date()

    @field({ decoder: DateDecoder, nullable: true })
    endDate: Date | null = null
}
