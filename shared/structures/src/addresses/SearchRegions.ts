import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { City } from './City';
import { Country, CountryDecoder } from './CountryDecoder';
import { Province } from './Province';

export class SearchRegions extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(City) })
    cities: City[] = []

    @field({ decoder: new ArrayDecoder(Province) })
    provinces: Province[] = []

    @field({ decoder: new ArrayDecoder(CountryDecoder) })
    countries: Country[] = [];
}