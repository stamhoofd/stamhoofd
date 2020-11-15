import { AutoEncoder, EnumDecoder,field, IntegerDecoder } from '@simonbackx/simple-encoding';

export enum SortDirection {
    Ascending = "Ascending",
    Descending = "Descending"
}

export class WebshopOrdersQuery extends AutoEncoder {
    @field({ decoder: IntegerDecoder, optional: true })
    afterNumber?: number

    @field({ decoder: new EnumDecoder(SortDirection), optional: true })
    sort = SortDirection.Ascending
}