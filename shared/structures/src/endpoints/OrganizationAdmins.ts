import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { UserWithMembers } from '../UserWithMembers.js';

export class OrganizationAdmins extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(UserWithMembers) })
    users: UserWithMembers[] = [];
}
