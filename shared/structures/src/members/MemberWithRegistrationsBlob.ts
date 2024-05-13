import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { Organization } from '../Organization';
import { User } from '../User';
import { Member } from './Member';
import { Registration } from './Registration';

export class MemberWithRegistrationsBlob extends Member {
    @field({ decoder: new ArrayDecoder(Registration) })
    registrations: Registration[]

    @field({ decoder: new ArrayDecoder(User), version: 32 })
    users: User[]
}

export class MembersBlob extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(MemberWithRegistrationsBlob) })
    members: MemberWithRegistrationsBlob[] = []

    @field({ decoder: new ArrayDecoder(Organization) })
    organizations: Organization[] = []
}
