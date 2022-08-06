import { AnyDecoder, ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { User } from '../User';

export class OrganizationAdmins extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(User) })
    users: User[] = []

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(AnyDecoder), optional: true })
    invites: never[] = []
}