import { AutoEncoder, BooleanDecoder, DateDecoder, field, MapDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

import { Organization } from "../Organization";
// eslint bug thinks MemberDetails is not used
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetails } from "./MemberDetails";
import { ReviewTimes } from "./ReviewTime";

/**
 * @deprecated
 */
export class MemberDetailsMeta extends AutoEncoder {
    /// Date of encryption
    @field({ decoder: DateDecoder })
    date: Date = new Date()

    /// Date when this was last encrypted by someone who owned the private key (or when it was first encrypted by someone else)
    /// This is used to remove old keys
    @field({ decoder: DateDecoder, version: 68, upgrade: function (this: MemberDetailsMeta) { 
        throw new Error("Not supported in tests!")
        return this.date;  
    } })
    ownerDate: Date = new Date()

    // Keep track of the filled tracks
    @field({ decoder: BooleanDecoder })
    hasMemberGeneral = false

    @field({ decoder: BooleanDecoder })
    hasParents = false

    @field({ decoder: BooleanDecoder })
    hasEmergency = false

    /**
     * Only set to true when it has non-public ones
     */
    @field({ decoder: BooleanDecoder })
    hasRecords = false

    /**
     * Whether this change was made without having all the available data
     */
    @field({ decoder: BooleanDecoder, version: 70 })
    isRecovered = false

    /**
     * Keep track of when certain information was reviewed
     */
    @field({ decoder: ReviewTimes, nullable: true, version: 71 })
    reviewTimes = ReviewTimes.create({})

    /**
     * Only set to true when it has non-public ones
     */
    @field({ decoder: new MapDecoder(StringDecoder, DateDecoder), version: 128 })
    recordAnswerReviewTimes: Map<string, Date> = new Map()

    static createFor(details: MemberDetails): MemberDetailsMeta {
        const meta = MemberDetailsMeta.create({
            hasMemberGeneral: details.lastName.length > 0 && details.birthDay !== null,
            hasParents: details.parents.length > 0 && !details.parents.find(p => !p.address || !p.phone),
            hasEmergency: details.emergencyContacts.length > 0 && !details.emergencyContacts.find(p => !p.phone),
            hasRecords: false,
            isRecovered: details.isRecovered,
            reviewTimes: details.reviewTimes,
        })

        for (const answer of details.recordAnswers) {
            if (answer.reviewedAt) {
                meta.recordAnswerReviewTimes.set(answer.settings.id, answer.reviewedAt)
            }
        }

        return meta
    }

    merge(other: MemberDetailsMeta) {
        if (other.hasMemberGeneral) {
            this.hasMemberGeneral = true
        }

        if (other.hasParents) {
            this.hasParents = true
        }
        if (other.hasEmergency) {
            this.hasEmergency = true
        }

        if (other.hasRecords) {
            this.hasRecords = true
        }

        if (!other.isRecovered) {
            this.isRecovered = false
        }

        for (const [key, value] of other.recordAnswerReviewTimes) {
            const d = this.recordAnswerReviewTimes.get(key)
            if (d === undefined || d < value) {
                this.recordAnswerReviewTimes.set(key, value)
            }
        }

        this.reviewTimes.merge(other.reviewTimes)
    }

    isAccurateFor(details: MemberDetails) {
        const meta = MemberDetailsMeta.createFor(details)
        return this.doesMatch(meta)
    }

    doesMatch(other: MemberDetailsMeta) {
        if (this.hasMemberGeneral !== other.hasMemberGeneral) {
            return false
        }

        if (this.hasParents !== other.hasParents) {
            return false
        }

        if (this.hasEmergency !== other.hasEmergency) {
            return false
        }

        if (this.hasRecords !== other.hasRecords) {
            return false
        }

        if (this.isRecovered !== other.isRecovered) {
            return false
        }

        for (const time of this.reviewTimes.times) {
            const oTime = other.reviewTimes.getLastReview(time.name)
            if (!oTime || oTime.getTime() != time.reviewedAt.getTime()) {
                return false
            }
        }

        for (const oTime of other.reviewTimes.times) {
            const time = this.reviewTimes.getLastReview(oTime.name)
            if (!time || time.getTime() != oTime.reviewedAt.getTime()) {
                return false
            }
        }

        if (this.recordAnswerReviewTimes.size !== other.recordAnswerReviewTimes.size) {
            return false
        }

        for (const [key, value] of this.recordAnswerReviewTimes) {
            const o = other.recordAnswerReviewTimes.get(key)
            if (o === undefined || o.getTime() != value.getTime()) {
                return false
            }
        }

        return true
    }
}

/**
 * @deprecated
 */
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

    /**
     * Some data is public. For example: permissions to collect data and the firstName. In the future we might add
     * more options to make certain data public
     * This data is taken from the details before it is encrypted and stored separately.
     * Please note that the ciphertext should NOT include the same data to prevent known ciphertext attacks
     */
    @field({ decoder: MemberDetails, nullable: true, version: 72 })
    publicData: MemberDetails | null = null

    /// Whether this was encrypted with the current organization public key
    @field({ decoder: BooleanDecoder })
    forOrganization = false

    /// Encryption author
    @field({ decoder: StringDecoder })
    authorId: string

    /// Encryption author
    @field({ decoder: MemberDetailsMeta })
    meta: MemberDetailsMeta

    /**
     * Get the data of this member details that is stored non encrypted.
     * @param organization not used at the moment but we'll need it for future organization settings that defines this behaviour
     */
    static getPublicData(original: MemberDetails, organization: Organization): MemberDetails | null {
        const details = MemberDetails.create({})
        details.isRecovered = true
        details.dataPermissions = original.dataPermissions
        details.memberNumber = original.memberNumber

        // Keep all non-encrypted fields
        details.recordAnswers = original.recordAnswers

        // Deprecated
        details.records = []

        return details
    }
}