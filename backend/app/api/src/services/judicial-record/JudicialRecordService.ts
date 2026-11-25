import { SimpleError } from '@common/errors';
import { assertChainNotRevoked } from '@stamhoofd/certificate-revocation';
import { checkJudicialRecord } from '@stamhoofd/judicial-record-check';
import type { Member } from '@stamhoofd/models';
import { MemberResponsibilityRecord, Organization, Platform } from '@stamhoofd/models';
import { JudicialRecordHelper, JudicialRecordStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

/**
 * A month, as the member is told when they request one. The member portal counts the same thirty days
 * before it offers to deliver.
 */
export const JUDICIAL_RECORD_MAX_AGE_IN_DAYS = 30;

/**
 * Accepting a delivered judicial record extract for a member.
 */
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

        return report.isPassed ? JudicialRecordStatus.Ok : JudicialRecordStatus.UnderReview;
    }

    private static async assertExtractRequired(member: Member): Promise<void> {
        const records = await MemberResponsibilityRecord.where({ memberId: member.id });
        const minimumAges = await this.getMinimumAges(records);

        const { status, description } = JudicialRecordHelper.getForMember({
            firstName: member.details.firstName,
            birthDay: member.details.birthDay,
            responsibilities: records.map((record) => ({
                startDate: record.startDate,
                endDate: record.endDate,
                minimumAge: minimumAges.get(record.responsibilityId) ?? null,
            })),
        });

        if (status !== JudicialRecordStatus.Required) {
            throw new SimpleError({
                code: 'judicial_record_not_required',
                message: 'No judicial record extract is required for this member',
                human: $t(
                    'Er is geen uittreksel uit het strafregister nodig voor {name}. {reason}',
                    {
                        name: member.details.firstName,
                        reason: description,
                    },
                ),
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
    private static async getMinimumAges(
        records: MemberResponsibilityRecord[],
    ): Promise<Map<string, number | null>> {
        const platform = await Platform.getSharedStruct();
        const responsibilities = [...platform.config.responsibilities];

        const organizationIds = Formatter.uniqueArray(
            records.map((record) => record.organizationId),
        );

        if (organizationIds.length > 0) {
            for (const organization of await Organization.getByIDs(...organizationIds)) {
                responsibilities.push(...organization.privateMeta.responsibilities);
            }
        }

        return new Map(
            responsibilities.map((responsibility) => [
                responsibility.id,
                responsibility.judicialRecordMinimumAge,
            ]),
        );
    }
}
