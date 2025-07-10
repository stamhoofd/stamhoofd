import { AutoEncoder, StringDecoder, field, IntegerDecoder, ArrayDecoder } from '@simonbackx/simple-encoding';

export class UitpasPriceCheckRequest extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    basePrice: number;

    /**
     * The reduced price in the non-official flow is an estimate, the response will have the effective price for this UiTPAS number
     * The reduced price can thus only be null when doing a static check (using uitpasEventId and without UiTPAS number) (e.g. when configuring the webshop)
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    reducedPrice: number | null;

    @field({ decoder: StringDecoder, nullable: true })
    uitpasEventId: string | null;

    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    uitpasNumbers: string[] | null;
}

export class UitpasPriceCheckResponse extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(IntegerDecoder) })
    prices: number[];
}
