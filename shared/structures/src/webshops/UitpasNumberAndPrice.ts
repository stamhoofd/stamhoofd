import { AutoEncoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';

export class UitpasNumberAndPrice extends AutoEncoder {
    @field({ decoder: StringDecoder })
    uitpasNumber: string;

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    price: number;

    @field({ decoder: StringDecoder, nullable: true })
    uitpasTariffId: string | null = null;
}
