import { AutoEncoder, DateDecoder, field, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { StamhoofdFilterDecoder } from '../filters/FilteredRequest.js';
import { StamhoofdFilter } from '../filters/StamhoofdFilter.js';

export class ChargeRequest extends AutoEncoder {
    @field({ decoder: StringDecoder })
    description: string;

    @field({ decoder: NumberDecoder })
    price: number;

    @field({ decoder: NumberDecoder, nullable: true })
    amount: number | null;

    @field({ decoder: DateDecoder, nullable: true })
    dueAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null;

    @field({ decoder: StamhoofdFilterDecoder, nullable: true })
    filter: StamhoofdFilter | null = null;
}
