import { AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { VATExcemptReason } from '../BalanceItem.js';
import { StamhoofdFilterDecoder } from '../filters/FilteredRequest.js';
import type { StamhoofdFilter } from '../filters/StamhoofdFilter.js';

export class ChargeRequest extends AutoEncoder {
    @field({ decoder: StringDecoder, field: 'description' })
    @field({ decoder: StringDecoder, field: 'name', version: 416 })
    name: string;

    @field({ decoder: StringDecoder, nullable: true, version: 416 })
    description: string | null = null;

    @field({ decoder: NumberDecoder })
    price: number;

    @field({ decoder: NumberDecoder, nullable: true })
    amount: number | null;

    @field({ decoder: IntegerDecoder, nullable: true, version: 416 })
    VATPercentage: number | null = null;

    @field({ decoder: BooleanDecoder, version: 416 })
    VATIncluded = true;

    @field({ decoder: new EnumDecoder(VATExcemptReason), nullable: true, version: 416 })
    VATExcempt: VATExcemptReason | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    dueAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null;

    @field({ decoder: StamhoofdFilterDecoder, nullable: true })
    filter: StamhoofdFilter | null = null;
}
