import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { City } from './City.js';
import { Country, CountryDecoder } from './CountryDecoder.js';
import { Province } from './Province.js';

export class SearchRegions extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(City) })
    cities: City[] = [];

    @field({ decoder: new ArrayDecoder(Province) })
    provinces: Province[] = [];

    @field({ decoder: new ArrayDecoder(CountryDecoder) })
    countries: Country[] = [];
}
