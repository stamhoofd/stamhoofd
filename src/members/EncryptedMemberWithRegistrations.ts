import { ArrayDecoder,field } from '@simonbackx/simple-encoding';

import { EncryptedMember } from './EncryptedMember';
import { Registration } from './Registration';

export class EncryptedMemberWithRegistrations extends EncryptedMember {
    @field({ decoder: new ArrayDecoder(Registration) })
    registrations: Registration[]
}

