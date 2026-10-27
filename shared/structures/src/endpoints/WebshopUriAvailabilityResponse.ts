import { AutoEncoder, BooleanDecoder, field } from '@common/encoding';

export class WebshopUriAvailabilityResponse extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    available: boolean;
}
