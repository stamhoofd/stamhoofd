import { ArrayDecoder, AutoEncoder, DateDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { EncryptedMemberDetails } from './EncryptedMemberDetails';

export class EncryptedMember extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    firstName = ""

    @field({ decoder: new ArrayDecoder(EncryptedMemberDetails), version: 67 })
    encryptedDetails: EncryptedMemberDetails[] = []

    @field({ decoder: DateDecoder, version: 31 })
    createdAt: Date = new Date()

    @field({ decoder: DateDecoder, version: 31 })
    updatedAt: Date = new Date()
}

export const EncryptedMemberPatch = EncryptedMember.patchType()