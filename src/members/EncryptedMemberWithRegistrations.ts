import { field, StringDecoder } from '@simonbackx/simple-encoding';

import { EncryptedMember } from './EncryptedMember';

export class EncryptedMemberWithRegistrations extends EncryptedMember {
    @field({ decoder: StringDecoder })
    publicKey: string
}

