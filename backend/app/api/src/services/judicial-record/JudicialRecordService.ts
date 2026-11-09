import { SimpleError } from '@common/errors';
import { assertChainNotRevoked } from '@stamhoofd/certificate-revocation';
import { checkJudicialRecord } from '@stamhoofd/judicial-record-check';
import type { Member } from '@stamhoofd/models';
import { MemberResponsibilityRecord, Organization, Platform } from '@stamhoofd/models';
import { JudicialRecordHelper, JudicialRecordStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export interface JudicialRecordDeliveryRequest {
    /** The member the extract was delivered for. */
    member: Member;

    /** The original pdf, exactly as it was received: untrusted input. */
    data: Uint8Array;

    /** How many days old the document may be, counted from the day it was drawn up. */
    maxAgeInDays: number;
}

/**
 * Accepting a delivered judicial record extract for a member.
 *
 * Nothing is stored. Storing the document and the outcome arrives with the review flow.
 */
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

        return report.isPassed
            ? JudicialRecordStatus.Ok
            : JudicialRecordStatus.UnderReview;
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
