import { SimpleError } from '@common/errors';
import { assertChainNotRevoked } from '@stamhoofd/certificate-revocation';
import { checkJudicialRecord } from '@stamhoofd/judicial-record-check';
import type { Member } from '@stamhoofd/models';
import {
    JudicialRecord,
    MemberResponsibilityRecord,
    Organization,
    Platform,
} from '@stamhoofd/models';
import type { Platform as PlatformStruct } from '@stamhoofd/structures';
import {
    hasJudicialRecordFeature,
    JUDICIAL_RECORD_MAX_COMMENT_LENGTH,
    JudicialRecordFile,
    JudicialRecordFileRemovedReason,
    JudicialRecordHelper,
    JudicialRecordReviewDecision,
    JudicialRecordReviewDetails,
    JudicialRecordStatus,
} from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { JudicialRecordFileStore } from './JudicialRecordFileStore.js';

/**
 * A month, as the member is told when they request one. The member portal counts the same thirty days
 * before it offers to deliver.
 */
export const JUDICIAL_RECORD_MAX_AGE_IN_DAYS = 31;

export interface JudicialRecordReviewRequestWithReviewer {
    /** The member whose current record is being decided. */
    member: Member;

    outcome: JudicialRecordReviewDecision;

    /** The condition on a conditional acceptance, or the reason for a rejection. */
    comment: string | null;

    /** Copied onto the record, never referenced: the audit has to outlive the user. */
    reviewer: { id: string; name: string; email: string; organizationId: string | null };
}

/** Accepting a delivered judicial record extract for a member, and deciding one. */
export class JudicialRecordService {
    static async deliver(member: Member, data: Uint8Array): Promise<JudicialRecordStatus> {
        await this.assertExtractRequired(member);

        const { report, certificatePath } = await checkJudicialRecord({
            data,
            firstName: member.details.firstName,
            lastName: member.details.lastName,
            birthDay: member.details.birthDay,
            maxAgeInDays: JUDICIAL_RECORD_MAX_AGE_IN_DAYS,
        });

        if (certificatePath !== null) {
            await assertChainNotRevoked(certificatePath);
        }

        return await this.store(member, report.isPassed ? null : data);
    }

    /**
     * Writes the delivery as the member's record. `data` is the document to keep for a reviewer, or null when
     * the automatic checks already approved it and there is nothing left for anyone to look at.
     *
     * A member has one record, so the one before it goes first. A failure after that leaves the member without
     * a record, so they are asked to deliver again - the safe direction.
     */
    private static async store(member: Member, data: Uint8Array | null): Promise<JudicialRecordStatus> {
        await this.removeCurrentRecord(member.id);

        const record = new JudicialRecord();
        record.id = uuidv4();
        record.memberId = member.id;

        if (data === null) {
            record.reviewDecision = JudicialRecordReviewDecision.Ok;

            // An automatic approval expires like a reviewer's does, and expiry runs from this date, so it is
            // set even though no person decided. A null here would make the approval permanent.
            record.reviewedAt = new Date();
        }
        else {
            record.reviewDecision = JudicialRecordReviewDecision.UnderReview;

            // Stored before the row that points at it: an object nothing references is swept up by retention,
            // while a record promising a document that was never written is a review nobody can carry out.
            record.file = JudicialRecordFile.create({
                reference: await JudicialRecordFileStore.store(record.id, data),
            });
        }

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
        if (request.outcome === JudicialRecordReviewDecision.UnderReview) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'UnderReview is not a decision',
                human: $t('Kies een beoordeling.'),
                field: 'reviewDecision',
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

        if (request.outcome === JudicialRecordReviewDecision.ConditionallyAccepted && comment.length === 0) {
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

        record.reviewDecision = request.outcome;
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

    /** The member's record, the one a decision is recorded on. */
    static async getCurrentRecord(memberId: string): Promise<JudicialRecord> {
        const records = await JudicialRecord.select()
            .where('memberId', memberId)
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
     * The newer delivery is the one that gets reviewed, so the one it replaces goes, document and all: nobody
     * is going to look at it, and keeping it would mean holding an extract we have no reason for any more.
     */
    private static async removeCurrentRecord(memberId: string): Promise<void> {
        for (const record of await JudicialRecord.select().where('memberId', memberId).fetch()) {
            const reference = record.file?.reference ?? null;

            if (reference !== null) {
                await JudicialRecordFileStore.remove(reference);
            }

            await record.delete();
        }
    }

    private static async assertExtractRequired(member: Member): Promise<void> {
        const records = await MemberResponsibilityRecord.where({ memberId: member.id });
        const platform = await Platform.getSharedStruct();
        const organizations = await this.getOrganizations(records);

        this.assertFeatureEnabled(platform, organizations);

        const minimumAges = this.getMinimumAges(platform, organizations);

        const { status, description } = JudicialRecordHelper.getForMember({
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
     * The flag is asked of the platform and of every organization the member holds a responsibility
     * in, because an extract is delivered from the member portal, which is in no organization at all.
     * `JudicialRecordHelper.asksForExtract` is the wrong question here: whether any responsibility
     * asks for an extract is already answered per record, against the member's own responsibilities.
     */
    private static assertFeatureEnabled(
        platform: PlatformStruct,
        organizations: Organization[],
    ): void {
        const hasFeature =
            hasJudicialRecordFeature({ platform }) ||
            organizations.some((organization) =>
                hasJudicialRecordFeature({
                    platform,
                    organization: organization.getBaseStructureWithPrivateMeta(),
                }),
            );

        if (!hasFeature) {
            throw new SimpleError({
                code: 'judicial_record_feature_disabled',
                message: 'The judicial record feature is not enabled',
                human: $t('Uittreksels uit het strafregister kunnen nog niet bezorgd worden.'),
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
    private static async getOrganizations(
        records: MemberResponsibilityRecord[],
    ): Promise<Organization[]> {
        const organizationIds = Formatter.uniqueArray(
            records.map((record) => record.organizationId),
        );

        if (organizationIds.length === 0) {
            return [];
        }

        return await Organization.getByIDs(...organizationIds);
    }

    private static getMinimumAges(
        platform: PlatformStruct,
        organizations: Organization[],
    ): Map<string, number | null> {
        const responsibilities = [
            ...platform.config.responsibilities,
            ...organizations.flatMap((organization) => organization.privateMeta.responsibilities),
        ];

        return new Map(
            responsibilities.map((responsibility) => [
                responsibility.id,
                responsibility.judicialRecordMinimumAge,
            ]),
        );
    }
}
