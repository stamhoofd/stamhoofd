import { column } from '@node/database';
import { QueryableModel } from '@stamhoofd/sql';
import {
    JudicialRecordFile,
    JudicialRecordReviewDetails,
    JudicialRecordReviewDecision,
} from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

/**
 * A delivered extract from the judicial record.
 *
 * One row per member, enforced by the database: a new delivery replaces the one before it rather than being
 * added next to it, so "the member's record" is never a question of which row is the latest.
 *
 * There is no organizationId on purpose: an approval is a fact about a person, so it holds for every
 * organization the member is registered in. The reviewing organization lives in `reviewDetails`, for the audit.
 */
export class JudicialRecord extends QueryableModel {
    static table = 'judicial_records';

    @column({
        primary: true,
        type: 'string',
        beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    memberId: string;

    @column({ type: 'string' })
    reviewDecision = JudicialRecordReviewDecision.UnderReview;

    /** Null exactly while nobody has looked at it yet. */
    @column({ type: 'json', decoder: JudicialRecordReviewDetails, nullable: true })
    reviewDetails: JudicialRecordReviewDetails | null = null;

    @column({ type: 'datetime', nullable: true })
    reviewedAt: Date | null = null;

    @column({ type: 'json', decoder: JudicialRecordFile, nullable: true })
    file: JudicialRecordFile | null = null;

    /**
     * A copy of `members.identityHash` as it stood when this row was written.
     *
     * Copied from the member rather than re-derived, so the two can only ever disagree because the member changed.
     * A member whose name or birth date changes no longer matches it, which is what asks them to deliver again.
     */
    @column({ type: 'string' })
    identityHash: string;

    @column({
        type: 'datetime',
        beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime',
        beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;
}
