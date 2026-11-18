import { SimpleError } from '@common/errors';
import { assertChainNotRevoked } from '@stamhoofd/certificate-revocation';
import { checkJudicialRecord } from '@stamhoofd/judicial-record-check';
import type { Member } from '@stamhoofd/models';
import { JudicialRecord, MemberResponsibilityRecord, Organization, Platform } from '@stamhoofd/models';
import { JUDICIAL_RECORD_MAX_COMMENT_LENGTH, JudicialRecordFile, JudicialRecordFileRemovedReason, JudicialRecordHelper, JudicialRecordReviewDetails, JudicialRecordReviewStatus, JudicialRecordStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { JudicialRecordFileStore } from './JudicialRecordFileStore.js';

export interface JudicialRecordDeliveryRequest {
    /** The member the extract was delivered for. */
    member: Member;

    /** The original pdf, exactly as it was received: untrusted input. */
    data: Uint8Array;

    /** How many days old the document may be, counted from the day it was drawn up. */
    maxAgeInDays: number;
}

export interface JudicialRecordReviewRequestWithReviewer {
    /** The member whose current record is being decided. */
    member: Member;

    outcome: JudicialRecordReviewStatus;

    /** The condition on a conditional acceptance, or the reason for a rejection. */
    comment: string | null;

    /** Copied onto the record, never referenced: the audit has to outlive the user. */
    reviewer: { id: string; name: string; email: string; organizationId: string | null };
}

/** Accepting a delivered judicial record extract for a member, and deciding one. */
export class JudicialRecordService {
    /**
     * Revocation is the only thing that refuses a delivery, because it is the only thing the
     * frontend could not already have shown. Every other check ran there too, and whoever delivered
     * the extract saw the result and chose to deliver anyway - so those become `UnderReview`, a
     * failed signature and an unreadable foreign extract included.
     */
    static async deliver(request: JudicialRecordDeliveryRequest): Promise<JudicialRecordStatus> {
        await this.assertExtractRequired(request.member);

        const { report, certificatePath } = await checkJudicialRecord({
            data: request.data,
            firstName: request.member.details.firstName,
            lastName: request.member.details.lastName,
            birthDay: request.member.details.birthDay,
            maxAgeInDays: request.maxAgeInDays,
        });

        if (certificatePath !== null) {
            await assertChainNotRevoked(certificatePath);
        }

        return await this.store(request.member, report.isPassed ? null : request.data);
    }

    /**
     * Writes the delivery as the member's current record. `data` is the document to keep for a reviewer, or
     * null when the automatic checks already approved it and there is nothing left for anyone to look at.
     *
     * The previous current row is superseded first, because the database allows one per member. A failure after
     * that leaves the member with no current record, so they are asked to deliver again - the safe direction.
     */
    private static async store(member: Member, data: Uint8Array | null): Promise<JudicialRecordStatus> {
        const identityHash = member.judicialIdentityHash;

        if (identityHash === null) {
            throw new Error('Cannot store a judicial record for a member without an identity hash');
        }

        const record = new JudicialRecord();
        record.id = uuidv4();
        record.memberId = member.id;
        record.identityHash = identityHash;

        if (data === null) {
            record.reviewStatus = JudicialRecordReviewStatus.Ok;

            // An automatic approval expires like a reviewer's does, and expiry runs from this date, so it is
            // set even though no person decided. A null here would make the approval permanent.
            record.reviewedAt = new Date();
        }
        else {
            record.reviewStatus = JudicialRecordReviewStatus.UnderReview;

            // Stored before the row that points at it: an object nothing references is swept up by retention,
            // while a record promising a document that was never written is a review nobody can carry out.
            record.file = JudicialRecordFile.create({
                reference: await JudicialRecordFileStore.store(record.id, data),
            });
        }

        await this.supersedeCurrentRecord(member.id);
        await record.save();

        return data === null
            ? JudicialRecordStatus.Ok
            : JudicialRecordStatus.UnderReview;
    }

    /**
     * Records a reviewer's decision on the member's current record and gets rid of the document.
     *
     * The document is removed before the decision is written: a record that still says `UnderReview` while its
     * object is already gone is a review that has to be redone, and a decision that is final while the document
     * is still in the bucket is the one outcome we promised the member cannot happen.
     */
    static async review(request: JudicialRecordReviewRequestWithReviewer): Promise<void> {
        if (request.outcome === JudicialRecordReviewStatus.UnderReview) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'UnderReview is not a decision',
                human: $t('Kies een beoordeling.'),
                field: 'reviewStatus',
                statusCode: 400,
            });
        }

        const comment = request.comment?.trim() ?? '';

        if (comment.length > JUDICIAL_RECORD_MAX_COMMENT_LENGTH) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'The review comment is too long',
                human: $t('Je opmerking is te lang.'),
                field: 'comment',
                statusCode: 400,
            });
        }

        if (request.outcome === JudicialRecordReviewStatus.ConditionallyAccepted && comment.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'A conditional acceptance needs its conditions',
                human: $t('Schrijf op onder welke voorwaarden dit lid mag werken met minderjarigen.'),
                field: 'comment',
                statusCode: 400,
            });
        }

        const record = await this.getCurrentRecord(request.member.id);

        const reference = record.file?.reference ?? null;

        if (reference !== null) {
            await JudicialRecordFileStore.remove(reference);

            record.file = JudicialRecordFile.create({
                reference: null,
                removedAt: new Date(),
                removedReason: JudicialRecordFileRemovedReason.Reviewed,
            });
        }

        record.reviewStatus = request.outcome;
        record.reviewedAt = new Date();
        record.reviewDetails = JudicialRecordReviewDetails.create({
            userId: request.reviewer.id,
            name: request.reviewer.name,
            email: request.reviewer.email,
            organizationId: request.reviewer.organizationId,
            comment: comment.length > 0 ? comment : null,
        });

        await record.save();
    }

    /** The member's current record, which is the only one a decision is ever recorded on. */
    static async getCurrentRecord(memberId: string): Promise<JudicialRecord> {
        const records = await JudicialRecord.select()
            .where('currentMemberId', memberId)
            .fetch();

        const record = records[0];

        if (!record) {
            throw new SimpleError({
                code: 'judicial_record_not_found',
                message: 'This member has no judicial record to review',
                human: $t('Er is geen uittreksel om te beoordelen.'),
                statusCode: 404,
            });
        }

        return record;
    }

    /**
     * The newer delivery is the one that gets reviewed, so the document of the one it replaces goes: nobody is
     * going to look at it, and keeping it would mean holding an extract we have no reason for any more.
     */
    private static async supersedeCurrentRecord(memberId: string): Promise<void> {
        for (const record of await JudicialRecord.select().where('currentMemberId', memberId).fetch()) {
            const reference = record.file?.reference ?? null;

            if (reference !== null) {
                await JudicialRecordFileStore.remove(reference);

                record.file = JudicialRecordFile.create({
                    reference: null,
                    removedAt: new Date(),
                    removedReason: JudicialRecordFileRemovedReason.Replaced,
                });
            }

            record.supersededAt = new Date();
            await record.save();
        }
    }

    private static async assertExtractRequired(member: Member): Promise<void> {
        const records = await MemberResponsibilityRecord.where({ memberId: member.id });
        const minimumAges = await this.getMinimumAges(records);

        const { status, description } = JudicialRecordHelper.getStatus({
            firstName: member.details.firstName,
            birthDay: member.details.birthDay,
            responsibilities: records.map(record => ({
                startDate: record.startDate,
                endDate: record.endDate,
                minimumAge: minimumAges.get(record.responsibilityId) ?? null,
            })),
        });

        if (status !== JudicialRecordStatus.Required) {
            throw new SimpleError({
                code: 'judicial_record_not_required',
                message: 'No judicial record extract is required for this member',
                human: $t('Er is geen uittreksel uit het strafregister nodig voor {name}. {reason}', {
                    name: member.details.firstName,
                    reason: description,
                }),
                statusCode: 400,
            });
        }
    }

    /**
     * Each record is resolved against its own organization instead of against one organization in
     * scope, because an extract is delivered from the member portal, which on a platform is in no
     * organization at all. Organizations define responsibilities with a `judicialRecordMinimumAge`
     * of their own, so a null scope would read one of those as no requirement and refuse a member
     * who does have to deliver.
     */
    private static async getMinimumAges(records: MemberResponsibilityRecord[]): Promise<Map<string, number | null>> {
        const platform = await Platform.getSharedStruct();
        const responsibilities = [...platform.config.responsibilities];

        const organizationIds = Formatter.uniqueArray(records.map(record => record.organizationId));

        if (organizationIds.length > 0) {
            for (const organization of await Organization.getByIDs(...organizationIds)) {
                responsibilities.push(...organization.privateMeta.responsibilities);
            }
        }

        return new Map(responsibilities.map(responsibility => [responsibility.id, responsibility.judicialRecordMinimumAge]));
    }
}
