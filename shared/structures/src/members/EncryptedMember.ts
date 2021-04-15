import { ArrayDecoder, AutoEncoder, DateDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { Sorter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { EncryptedMemberDetails, MemberDetailsMeta } from './EncryptedMemberDetails';

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

    getDetailsMeta(): MemberDetailsMeta | undefined {
        let meta: MemberDetailsMeta | undefined
        const newToOld = this.encryptedDetails.sort((a, b) => Sorter.byDateValue(a.meta.date, b.meta.date))
        for (const encryptedDetails of newToOld) {
            if (!encryptedDetails.meta.isRecovered && encryptedDetails.forOrganization) {
                // Organization still has full access to this member
                if (meta) {
                    // We already had recovered data, so we have access to it. Merge the newer meta in the older one
                    encryptedDetails.meta.merge(meta)
                }
                meta = encryptedDetails.meta
                break
            } else {
                if (encryptedDetails.forOrganization) {
                    // We have some recovered data
                    if (meta) {
                        // We already had recovered data, so we have access to it. Merge the newer meta in the older one
                        encryptedDetails.meta.merge(meta)
                    }
                    meta = encryptedDetails.meta
                }
            }
        }
        return meta
    }
}

export const EncryptedMemberPatch = EncryptedMember.patchType()