import { ArrayDecoder,field } from '@simonbackx/simple-encoding';

import { User } from '../User';
import { EncryptedMember } from './EncryptedMember';
import { Registration } from './Registration';

export class EncryptedMemberWithRegistrations extends EncryptedMember {
    @field({ decoder: new ArrayDecoder(Registration) })
    registrations: Registration[]

    @field({ decoder: new ArrayDecoder(User), version: 32 })
    users: User[]
}

export const EncryptedMemberWithRegistrationsPatch = EncryptedMemberWithRegistrations.patchType()