import { AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { VATExcemptReason } from '../BalanceItem.js';
import { StamhoofdFilterDecoder } from '../filters/FilteredRequest.js';
import type { StamhoofdFilter } from '../filters/StamhoofdFilter.js';

export class ChargeRequest extends AutoEncoder {
    @field({ decoder: StringDecoder, field: 'description' })
    @field({ decoder: StringDecoder, field: 'name', ...NextVersion })
    name: string;

    @field({ decoder: StringDecoder, nullable: true, ...NextVersion })
    description: string | null = null;

    @field({ decoder: NumberDecoder })
    price: number;

    @field({ decoder: NumberDecoder, nullable: true })
    amount: number | null;

    @field({ decoder: IntegerDecoder, nullable: true, ...NextVersion })
    VATPercentage: number | null = null;

    @field({ decoder: BooleanDecoder, ...NextVersion })
    VATIncluded = true;

    @field({ decoder: new EnumDecoder(VATExcemptReason), nullable: true, ...NextVersion })
    VATExcempt: VATExcemptReason | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    dueAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null;

    @field({ decoder: StamhoofdFilterDecoder, nullable: true })
    filter: StamhoofdFilter | null = null;
}
