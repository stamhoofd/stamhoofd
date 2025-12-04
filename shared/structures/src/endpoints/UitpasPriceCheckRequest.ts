import { AutoEncoder, StringDecoder, field, IntegerDecoder, ArrayDecoder } from '@simonbackx/simple-encoding';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';

export class UitpasPriceCheckRequest extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    basePrice: number;

    /**
     * The reduced price in the non-official flow is an estimate, the response will have the effective price for this UiTPAS number
     * The reduced price can thus only be null when doing a static check (using uitpasEventUrl and without UiTPAS number) (e.g. when configuring the webshop)
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, nullable: true })
    reducedPrice: number | null;

    @field({ decoder: StringDecoder, nullable: true })
    uitpasEventUrl: string | null;

    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    uitpasNumbers: string[] | null;
}

export class UitpasPriceCheckResponse extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(IntegerDecoder) })
    prices: number[];
}
