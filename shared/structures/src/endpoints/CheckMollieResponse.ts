import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { Organization } from '../Organization.js';
import { MollieProfile } from '../OrganizationPrivateMetaData.js';

export class CheckMollieResponse extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(MollieProfile) })
    profiles: MollieProfile[] = [];

    @field({ decoder: Organization })
    organization: Organization;
}
