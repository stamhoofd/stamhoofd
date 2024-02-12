import { ArrayDecoder, AutoEncoder, BooleanDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

import { Image } from "./files/Image";

export class Sponsor extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true })
    url: string|null = null

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: Image, nullable: true })
    logo: Image|null = null

    @field({ decoder: Image, nullable: true, optional: true })
    banner: Image|null = null

    @field({ decoder: BooleanDecoder, optional: true })
    onTickets = false
}

export class SponsorConfig extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(Sponsor) })
    sponsors: Sponsor[] = []
}