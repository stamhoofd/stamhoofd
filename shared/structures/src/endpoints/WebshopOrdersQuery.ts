import { AutoEncoder, DateDecoder, EnumDecoder,field, IntegerDecoder } from '@simonbackx/simple-encoding';

export enum SortDirection {
    Ascending = "Ascending",
    Descending = "Descending"
}

export class WebshopOrdersQuery extends AutoEncoder {
    /**
     * Usage in combination with updatedSince is special!
     */
    @field({ decoder: IntegerDecoder, optional: true })
    afterNumber?: number

    /**
     * Return all orders that were updated after (and including) this date. 
     * Only returns orders **equal** this date if afterNumber is not provided or if the number of those orders are also higher.
     */
    @field({ decoder: DateDecoder, optional: true })
    updatedSince?: Date

    /**
     * @deprecated
     * You should always use Ascending. Descanding is dropped for performance reasons
     */
    @field({ decoder: new EnumDecoder(SortDirection), optional: true })
    sort?: SortDirection
}