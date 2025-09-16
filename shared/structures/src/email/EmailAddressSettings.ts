import { AutoEncoder, BooleanDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { OrganizationSimple } from '../OrganizationSimple.js';

export class EmailAddressSettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    email: string;

    @field({ decoder: BooleanDecoder })
    unsubscribedMarketing: boolean;

    @field({ decoder: BooleanDecoder })
    unsubscribedAll: boolean;

    @field({ decoder: BooleanDecoder, ...NextVersion })
    hardBounce = false;

    @field({ decoder: BooleanDecoder, ...NextVersion })
    markedAsSpam = false;

    @field({ decoder: OrganizationSimple, nullable: true })
    organization: OrganizationSimple | null = null;
}
