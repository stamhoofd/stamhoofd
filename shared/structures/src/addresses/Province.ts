import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { Country, CountryDecoder } from './CountryDecoder';

export class Province extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder })
    name: string

    @field({ decoder: CountryDecoder })
    country: Country;
}