import { AutoEncoder, EnumDecoder,field, IntegerDecoder } from '@simonbackx/simple-encoding';

export enum SortDirection {
    Ascending = "Ascending",
    Descending = "Descending"
}

export class WebshopOrdersQuery extends AutoEncoder {
    @field({ decoder: IntegerDecoder, nullable: true, optional: true })
    afterNumber: number | null = null;

    @field({ decoder: new EnumDecoder(SortDirection), optional: true })
    sort = SortDirection.Ascending
}