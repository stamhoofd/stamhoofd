import { AutoEncoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class WebshopTicketsQuery extends AutoEncoder {
    /**
     * Ticket that was last received (used to determine tickets with same updatedAt timestamp)
     */
    @field({ decoder: StringDecoder, optional: true })
    lastId?: string

    /**
     * Return all orders that were updated after (and including) this date. 
     * Only returns orders **equal** this date if afterNumber is not provided or if the number of those orders are also higher.
     */
    @field({ decoder: DateDecoder, optional: true })
    updatedSince?: Date
}