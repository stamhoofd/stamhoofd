import { ArrayDecoder, AutoEncoder, DateDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { Sorter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { EncryptedMemberDetails, MemberDetailsMeta } from './EncryptedMemberDetails';
import { MemberDetails } from './MemberDetails';

export class EncryptedMember extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * @deprecated
     * Slowly migrate towards a non-encrypted member in the future
     */
    @field({ decoder: StringDecoder })
    firstName = ""

    @field({ decoder: new ArrayDecoder(EncryptedMemberDetails), version: 67 })
    encryptedDetails: EncryptedMemberDetails[] = []

    /**
     * Non encrypted information
     */
    @field({ decoder: MemberDetails, version: 148, nullable: true })
    nonEncryptedDetails: MemberDetails | null = null

    @field({ decoder: DateDecoder, version: 31 })
    createdAt: Date = new Date()

    @field({ decoder: DateDecoder, version: 31 })
    updatedAt: Date = new Date()
}

export const EncryptedMemberPatch = EncryptedMember.patchType()