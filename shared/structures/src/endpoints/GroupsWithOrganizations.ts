import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { Group } from '../Group.js';
import { Organization } from '../Organization.js';

export class GroupsWithOrganizations extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(Group) })
    groups: Group[] = [];

    @field({ decoder: new ArrayDecoder(Organization) })
    organizations: Organization[] = [];
}
