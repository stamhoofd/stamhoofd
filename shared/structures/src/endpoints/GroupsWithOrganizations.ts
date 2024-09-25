import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { Group } from '../Group';
import { Organization } from '../Organization';

export class GroupsWithOrganizations extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(Group) })
    groups: Group[] = [];

    @field({ decoder: new ArrayDecoder(Organization) })
    organizations: Organization[] = [];
}
