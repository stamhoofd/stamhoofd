import { AutoEncoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

export class GenericBalance extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * The organization that should receive the outstanding balance
     */
    @field({ decoder: StringDecoder })
    organizationId: string;

    @field({ decoder: IntegerDecoder, version: 354 })
    amountPaid = 0;

    @field({ decoder: IntegerDecoder, field: 'amount' })
    @field({ decoder: IntegerDecoder, version: 354 })
    amountOpen = 0;

    @field({ decoder: IntegerDecoder })
    amountPending = 0;
}
