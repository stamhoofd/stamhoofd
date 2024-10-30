import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { Organization } from '../Organization.js';
import { NewUser } from '../User.js';

export class CreateOrganization extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization;

    /**
     * The first (administrator) user of this organization
     */
    @field({ decoder: NewUser })
    user: NewUser;

    @field({ decoder: StringDecoder, nullable: true, version: 24 })
    registerCode: string | null = null;
}
