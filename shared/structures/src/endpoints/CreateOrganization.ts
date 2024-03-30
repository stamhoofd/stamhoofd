import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { Organization } from '../Organization';
import { NewUser } from '../User';

export class CreateOrganization extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization

    /**
     * The first (administrator) user of this organization
     */
    @field({ decoder: NewUser })
    user: NewUser

    @field({ decoder: StringDecoder, nullable: true, version: 24 })
    registerCode: string | null = null
}