import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { Country, CountryDecoder } from './CountryDecoder';

export class City extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder })
    name: string

    @field({ decoder: StringDecoder })
    provinceId: string;

    @field({ decoder: StringDecoder, nullable: true })
    parentCityId: string | null = null;

    @field({ decoder: CountryDecoder })
    country: Country;
}