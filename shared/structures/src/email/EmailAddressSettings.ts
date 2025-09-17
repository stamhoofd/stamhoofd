import { AutoEncoder, BooleanDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { OrganizationSimple } from '../OrganizationSimple.js';

export class EmailAddressSettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    email: string;

    @field({ decoder: BooleanDecoder })
    unsubscribedMarketing: boolean;

    @field({ decoder: BooleanDecoder })
    unsubscribedAll: boolean;

    @field({ decoder: BooleanDecoder, version: 385 })
    hardBounce = false;

    @field({ decoder: BooleanDecoder, version: 385 })
    markedAsSpam = false;

    @field({ decoder: OrganizationSimple, nullable: true })
    organization: OrganizationSimple | null = null;
}
