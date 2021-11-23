import { AutoEncoder, BooleanDecoder, field } from "@simonbackx/simple-encoding";

export class WebshopUriAvailabilityResponse extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    available: boolean;
}
