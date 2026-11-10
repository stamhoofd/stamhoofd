import { AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, StringDecoder, field } from '@common/encoding';

import { JudicialRecordReviewDetails, JudicialRecordReviewStatus } from '../members/JudicialRecordReview.js';

/**
 * The outcome a reviewer recorded for a delivered extract.
 *
 * `UnderReview` is refused by the endpoint rather than left out of the decoder: the five outcomes are one enum
 * on the wire, and a second one holding four of them would have to be kept in step with it forever.
 */
export class JudicialRecordReviewRequest extends AutoEncoder {
    @field({ decoder: new EnumDecoder(JudicialRecordReviewStatus) })
    reviewStatus: JudicialRecordReviewStatus;

    /** The condition on a conditional acceptance, or the reason for a rejection. */
    @field({ decoder: StringDecoder, nullable: true })
    comment: string | null = null;
}

/**
 * A delivered extract as the reviewer sees it.
 *
 * Separate from `MemberJudicialRecord` because it carries what only a reviewer may read: who decided before,
 * and what they wrote down. The member blob carries the status alone.
 */
export class JudicialRecordReviewView extends AutoEncoder {
    @field({ decoder: new EnumDecoder(JudicialRecordReviewStatus) })
    reviewStatus: JudicialRecordReviewStatus;

    /** Null exactly while nobody has looked at it yet. */
    @field({ decoder: JudicialRecordReviewDetails, nullable: true })
    reviewDetails: JudicialRecordReviewDetails | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    reviewedAt: Date | null = null;

    /** Whether there is still a document to fetch. A decision removes it, and so does the retention window. */
    @field({ decoder: BooleanDecoder })
    hasDocument = false;

    /** When the extract was delivered, so a reviewer can see how long it has been waiting. */
    @field({ decoder: DateDecoder })
    deliveredAt: Date;
}
