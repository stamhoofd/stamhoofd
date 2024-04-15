import { ArrayDecoder, field } from '@simonbackx/simple-encoding';

import { User } from '../User';
import { Member } from './Member';
import { Registration } from './Registration';

export class EncryptedMemberWithRegistrations extends Member {
    @field({ decoder: new ArrayDecoder(Registration) })
    registrations: Registration[]

    @field({ decoder: new ArrayDecoder(User), version: 32 })
    users: User[]
}