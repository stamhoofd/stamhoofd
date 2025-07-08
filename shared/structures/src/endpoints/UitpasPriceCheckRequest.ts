import { AutoEncoder, StringDecoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';

export class UitpasPriceCheckRequest extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    price: number;

    @field({ decoder: StringDecoder, nullable: true })
    uitpasEventId: string;

    @field({ decoder: StringDecoder, nullable: true })
    uitpasNumber: string;
}

export class UitpasPriceCheckResponse extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    price: number;
}
