import { ArrayDecoder,AutoEncoder, field } from '@simonbackx/simple-encoding';

import { Invite } from '../Invite';
import { User } from '../User';

export class OrganizationAdmins extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(User) })
    users: User[] = []

    @field({ decoder: new ArrayDecoder(Invite) })
    invites: Invite[] = []
}