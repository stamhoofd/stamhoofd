import { column } from '@node/database';
import { QueryableModel } from '@stamhoofd/sql';
import { JudicialRecordFile, JudicialRecordReviewDetails, JudicialRecordReviewStatus } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

/**
 * A delivered extract from the judicial record.
 *
 * One row per delivery, kept after it is superseded, so a reviewer can see that a member delivered before.
 * There is no organizationId on purpose: an approval is a fact about a person, so it holds for every
 * organization the member is registered in. The reviewing organization lives in `reviewDetails`, for the audit.
 */
export class JudicialRecord extends QueryableModel {
    static table = 'judicial_records';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    memberId: string;

    @column({ type: 'string' })
    reviewStatus = JudicialRecordReviewStatus.UnderReview;

    /** Null exactly while nobody has looked at it yet. */
    @column({ type: 'json', decoder: JudicialRecordReviewDetails, nullable: true })
    reviewDetails: JudicialRecordReviewDetails | null = null;

    @column({ type: 'datetime', nullable: true })
    reviewedAt: Date | null = null;

    @column({ type: 'json', decoder: JudicialRecordFile, nullable: true })
    file: JudicialRecordFile | null = null;

    /**
     * A copy of `members.judicialIdentityHash` as it stood when this row was written.
     *
     * Copied, never re-derived: the hash is defined by a generated column and nothing outside SQL computes it.
     * A member whose name or birth date changes no longer matches it, which is what asks them to deliver again.
     */
    @column({ type: 'string' })
    identityHash: string;

    /** Set when a newer delivery takes over. The database allows one row per member with this null. */
    @column({ type: 'datetime', nullable: true })
    supersededAt: Date | null = null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
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
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;
}
