import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

// eslint bug thinks MemberDetails is not used
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetails } from "./MemberDetails";

/**
 * Keep a timestamp of when certain information was reviewed of a member
 */
export class ReviewTime extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name: string

    /**
     * Date that this section was reviewed
     */
    @field({ decoder: DateDecoder })
    reviewedAt: Date
}

export class ReviewTimes extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(ReviewTime) })
    times: ReviewTime[] = []

    markReviewed(name: "records" | "parents" | "emergencyContacts" | "details", date?: Date) {
        for (const time of this.times) {
            if (time.name === name) {
                if (date && date < time.reviewedAt) {
                    // Can't decrease time
                    return
                }
                time.reviewedAt = date ?? new Date()
                return
            }
        }
        this.times.push(ReviewTime.create({
            name,
            reviewedAt: date ?? new Date()
        }))
    }

    getLastReview(name: "records" | "parents" | "emergencyContacts" | "details"): Date | undefined {
        for (const time of this.times) {
            if (time.name === name) {
                return time.reviewedAt
            }
        }
    }

    merge(other: ReviewTimes) {
        for (const time of other.times) {
            this.markReviewed(time.name as any, time.reviewedAt)
        }
    }

    isOutdated(name: "records" | "parents" | "emergencyContacts" | "details", timeoutMs: number): boolean {
        const time = this.getLastReview(name)
        if (!time) {
            return true
        }
        if (time.getTime() < new Date().getTime() - timeoutMs) {
            return true
        }
        return false
    }
}


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
     * @deprecated
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
            hasRecords: details.records.length > 0,
            isRecovered: details.isRecovered,
            reviewTimes: details.reviewTimes
        })
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

        this.reviewTimes.merge(other.reviewTimes)
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