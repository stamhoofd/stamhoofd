import { AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';

export class GroupSizeResponse extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    occupied: number;

    @field({ decoder: IntegerDecoder })
    maximum: number;
}
