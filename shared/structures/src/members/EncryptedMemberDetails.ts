import { AutoEncoder, BooleanDecoder, DateDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

// eslint bug thinks MemberDetails is not used
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetails } from "./MemberDetails";

export class MemberDetailsMeta extends AutoEncoder {
    /// Date of encryption
    @field({ decoder: DateDecoder })
    date: Date = new Date()

    /// Date when this was last encrypted by someone who owned the private key (or when it was first encrypted by someone else)
    /// This is used to remove old keys
    @field({ decoder: DateDecoder, version: 68, upgrade: function (this: MemberDetailsMeta) { return this.date } })
    ownerDate: Date = new Date()

    // Keep track of the filled tracks

    @field({ decoder: BooleanDecoder })
    hasMemberGeneral = false

    @field({ decoder: BooleanDecoder })
    hasParents = false

    @field({ decoder: BooleanDecoder })
    hasEmergency = false

    @field({ decoder: BooleanDecoder })
    hasRecords = false

    /**
     * Set to true when essential data is missing
     */
    get incomplete(): boolean {
        return !this.hasMemberGeneral
    }

    static createFor(details: MemberDetails): MemberDetailsMeta {
        return MemberDetailsMeta.create({
            hasMemberGeneral: details.lastName.length > 0 && details.birthDay !== null,
            hasParents: details.address !== null || details.parents.length > 0 || (details.age !== null && details.age > 18),
            hasEmergency: details.emergencyContacts.length > 0,
            hasRecords: details.records.length > 0
        })
    }
}


export class EncryptedMemberDetails extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * The public key that was used for this encryption
     */
    @field({ decoder: StringDecoder })
    publicKey: string

    @field({ decoder: StringDecoder })
    ciphertext: string

    /// Whether this was encrypted with the current organization public key
    @field({ decoder: BooleanDecoder })
    forOrganization = false

    /// Encryption author
    @field({ decoder: StringDecoder })
    authorId: string

    /// Encryption author
    @field({ decoder: MemberDetailsMeta })
    meta: MemberDetailsMeta
}