import { AutoEncoder, BooleanDecoder, IntegerDecoder, StringDecoder, field } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

export class MemberResponsibility extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;
    
    @field({ decoder: StringDecoder })
    name = ''

    @field({ decoder: StringDecoder })
    description = ''

    @field({ decoder: IntegerDecoder, nullable: true })
    minimumMembers: null | number = null

    @field({ decoder: IntegerDecoder, nullable: true })
    maximumMembers: null | number = null

    /**
     * Group full-admins can assign this responsibility to members
     */
    @field({ decoder: BooleanDecoder, optional: true})
    assignableByOrganizations = true
}
