import { ArrayDecoder,AutoEncoder, BooleanDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

export class OrganizationEmail extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Name of this person / group
     */
    @field({ decoder: StringDecoder, nullable: true })
    name: string | null = null;

    @field({ decoder: StringDecoder })
    email: string;

    /**
     * Whether this e-mail might get used as a global default one when we could not find a different one
     */
    @field({ decoder: BooleanDecoder })
    default = false;

    /**
     * Only usable by users with full permissions
     */
    @field({ decoder: BooleanDecoder })
    restricted = false;
}