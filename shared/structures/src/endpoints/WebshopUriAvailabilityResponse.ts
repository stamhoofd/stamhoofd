import { AutoEncoder, BooleanDecoder, field } from '@stamhoofd/common-encoding';

export class WebshopUriAvailabilityResponse extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    available: boolean;
}
