import { ArrayDecoder } from '@common/encoding';
import { column } from '@node/database';
import { QueryableModel } from '@stamhoofd/sql';
import {
    BelcotaxSubmissionContent,
    BelcotaxSubmissionIssue,
    BelcotaxSubmissionStatus,
    BelcotaxSubmission as BelcotaxSubmissionStruct,
} from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * A JSON-lines file sent to the Belcotax API for the documents of one template, and what Belcotax answered
 */
export class BelcotaxSubmission extends QueryableModel {
    static table = 'belcotax_submissions';

    @column({
        primary: true,
        type: 'string',
        beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'string' })
    templateId: string;

    /**
     * The organiser (and sender) of the fiches: 10 digits, without separators
     */
    @column({ type: 'string' })
    companyNumber: string;

    /**
     * Administrator who submitted, who also receives the result by email
     */
    @column({ type: 'string', nullable: true })
    userId: string | null = null;

    @column({ type: 'string' })
    submittedBy = '';

    @column({ type: 'string' })
    status = BelcotaxSubmissionStatus.Sending;

    @column({ type: 'string', nullable: true })
    bulkId: string | null = null;

    @column({ type: 'integer' })
    ficheCount = 0;

    @column({ type: 'integer' })
    deletedCount = 0;

    /**
     * Never contains the file itself: it holds national register numbers
     */
    @column({ type: 'json', decoder: BelcotaxSubmissionContent })
    content = BelcotaxSubmissionContent.create({});

    @column({ type: 'json', decoder: new ArrayDecoder(BelcotaxSubmissionIssue) })
    issues: BelcotaxSubmissionIssue[] = [];

    @column({ type: 'string', nullable: true })
    errorMessage: string | null = null;

    @column({ type: 'datetime', nullable: true })
    lastPolledAt: Date | null = null;

    @column({ type: 'datetime', nullable: true })
    finishedAt: Date | null = null;

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

    getStructure() {
        return BelcotaxSubmissionStruct.create({
            id: this.id,
            templateId: this.templateId,
            companyNumber: this.companyNumber,
            status: this.status,
            bulkId: this.bulkId,
            ficheCount: this.ficheCount,
            deletedCount: this.deletedCount,
            submittedBy: this.submittedBy,
            issues: this.issues,
            errorMessage: this.errorMessage,
            createdAt: this.createdAt,
            finishedAt: this.finishedAt,
        });
    }
}
