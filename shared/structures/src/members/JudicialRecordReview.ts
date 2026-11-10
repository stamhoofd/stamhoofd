import { AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, StringDecoder, field } from '@common/encoding';

/**
 * The outcome a reviewer gave a delivered extract, or that nobody has looked at it yet.
 *
 * Several of these collapse into one `JudicialRecordStatus`, which is the status the rest of the system acts on.
 * The distinction is kept here so a list can still be filtered on the specific outcome without that becoming a
 * second permanent wire enum alongside `JudicialRecordStatus`.
 */
export enum JudicialRecordReviewStatus {
    /** Delivered and waiting: nobody has looked at it. */
    UnderReview = 'UnderReview',

    /** Approved. */
    Ok = 'Ok',

    /** Approved, with conditions a reviewer wrote down. The member may act. */
    ConditionallyAccepted = 'ConditionallyAccepted',

    /** Refused for now. The member has to deliver another extract. */
    TemporarilyRejected = 'TemporarilyRejected',

    /** Refused. */
    PermanentlyRejected = 'PermanentlyRejected',
}

/** Why a stored extract is no longer there. */
export enum JudicialRecordFileRemovedReason {
    /** A reviewer decided, so the document is not needed any more. */
    Reviewed = 'Reviewed',

    /** Nobody reviewed it within the retention window. */
    Retention = 'Retention',

    /** The member delivered a newer one. */
    Replaced = 'Replaced',

    /** The member asked for it to be removed. */
    MemberRequest = 'MemberRequest',
}

/**
 * Who reviewed an extract, and what they decided.
 *
 * The reviewer's name, email and organization are copied rather than referenced: the audit has to stay readable
 * after that user is renamed, loses the permission or is deleted.
 */
export class JudicialRecordReviewDetails extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    userId: string | null = null;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    email = '';

    /**
     * The organization the reviewer acted for, null on the platform.
     *
     * Audit only. An approval is a fact about a person, so it is never scoped to this organization.
     */
    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null = null;

    /** The condition on a conditional acceptance, or the reason for a rejection. */
    @field({ decoder: StringDecoder, nullable: true })
    comment: string | null = null;
}

/**
 * A member's current judicial record, as much of it as deciding their status needs.
 *
 * `identityMatches` is answered by the database, which compares the record's identity hash against the member's.
 * The hash is never derived outside SQL, so this carries the answer rather than the inputs.
 */
export class MemberJudicialRecord extends AutoEncoder {
    @field({ decoder: new EnumDecoder(JudicialRecordReviewStatus) })
    reviewStatus: JudicialRecordReviewStatus;

    @field({ decoder: BooleanDecoder })
    identityMatches = true;

    /** When a reviewer decided, null while nobody has looked. */
    @field({ decoder: DateDecoder, nullable: true })
    reviewedAt: Date | null = null;
}

/** The stored extract, and why it is gone once it is. */
export class JudicialRecordFile extends AutoEncoder {
    /** Where the document is stored. Null once it has been removed. */
    @field({ decoder: StringDecoder, nullable: true })
    reference: string | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    removedAt: Date | null = null;

    @field({ decoder: new EnumDecoder(JudicialRecordFileRemovedReason), nullable: true })
    removedReason: JudicialRecordFileRemovedReason | null = null;
}
