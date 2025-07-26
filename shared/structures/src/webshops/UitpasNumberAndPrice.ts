import { AutoEncoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

export class UitpasNumberAndPrice extends AutoEncoder {
    @field({ decoder: StringDecoder })
    uitpasNumber: string;

    @field({ decoder: IntegerDecoder })
    price: number;

    @field({ decoder: StringDecoder, nullable: true })
    uitpasTariffId: string | null = null;
}
