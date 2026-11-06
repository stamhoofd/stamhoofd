import { SimpleError } from '@common/errors';
import { assertChainNotRevoked } from '@stamhoofd/certificate-revocation';
import { checkJudicialRecord } from '@stamhoofd/judicial-record-check';
import type { Member } from '@stamhoofd/models';
import { MemberResponsibilityRecord, Organization, Platform } from '@stamhoofd/models';
import { JudicialRecordDeliveryStatus, JudicialRecordHelper, JudicialRecordStatus } from '@stamhoofd/structures';
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
 * The five automatic checks are `@stamhoofd/judicial-record-check`, which runs them in the browser as
 * well. What is left here is what only the backend can do: establish that this member has to deliver
 * an extract at all, and ask the issuing authorities whether the certificates behind the signature
 * are still valid.
 *
 * Nothing is stored. Storing the document and the outcome arrives with the review flow.
 */
export class JudicialRecordService {
    /**
     * Only revocation refuses a delivery.
     *
     * Everything else the checks found was already shown to whoever delivered the extract, in the
     * step before this one, and they chose to deliver it anyway - a failed signature check included,
     * and an extract from another country that our checks cannot read as well. Refusing those here
     * would refuse something the member was already told about and deliberately sent in, so they
     * become `Manual` instead: a reviewer opens the document.
     *
     * A revoked certificate is different precisely because the frontend cannot see it. It never
     * reaches a reviewer, since the only way out of it is a new document from FOD Justitie.
     */
    static async deliver(request: JudicialRecordDeliveryRequest): Promise<JudicialRecordDeliveryStatus> {
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
            ? JudicialRecordDeliveryStatus.AutoOk
            : JudicialRecordDeliveryStatus.Manual;
    }

    /**
     * The same rule the member view shows: `JudicialRecordHelper.getRequirement`, over the
     * responsibilities this member holds. Derived rather than read from a column, so it stays
     * correct when a responsibility changes its minimum age.
     */
    private static async assertExtractRequired(member: Member): Promise<void> {
        const records = await MemberResponsibilityRecord.where({ memberId: member.id });
        const minimumAges = await this.getMinimumAges(records);

        const requirement = JudicialRecordHelper.getRequirement({
            firstName: member.details.firstName,
            birthDay: member.details.birthDay,
            responsibilities: records.map(record => ({
                startDate: record.startDate,
                endDate: record.endDate,
                minimumAge: minimumAges.get(record.responsibilityId) ?? null,
            })),
        });

        if (requirement.status !== JudicialRecordStatus.Required) {
            throw new SimpleError({
                code: 'judicial_record_not_required',
                message: 'No judicial record extract is required for this member',
                human: $t('Er is geen uittreksel uit het strafregister nodig voor {name}. {reason}', {
                    name: member.details.firstName,
                    reason: requirement.description,
                }),
                statusCode: 400,
            });
        }
    }

    /**
     * The minimum age of every responsibility these records point to, by responsibility id. Null
     * when the responsibility never asks for an extract, and absent when it no longer exists.
     *
     * Each record is resolved against its own organization rather than against one organization in
     * scope. An extract is delivered from the member portal, which on a platform is not inside an
     * organization at all, and organizations define responsibilities with a
     * `judicialRecordMinimumAge` of their own next to the platform ones. Looking at only the
     * platform ones there would read an organization-defined requirement as no requirement and
     * refuse a member who genuinely has to deliver.
     *
     * This is why the request has no organization: there is no scope that would answer this
     * correctly for every call path, and the records say which organizations to ask.
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
