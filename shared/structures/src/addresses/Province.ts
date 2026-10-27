import { AutoEncoder, field, StringDecoder } from '@common/encoding';

import { CountryDecoder } from './CountryDecoder.js';
import type { Country } from '@stamhoofd/types/Country';

export class Province extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: CountryDecoder })
    country: Country;
}
