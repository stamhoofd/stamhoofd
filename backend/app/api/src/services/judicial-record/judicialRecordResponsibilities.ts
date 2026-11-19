import type { Member, MemberResponsibilityRecord } from '@stamhoofd/models';
import { Organization, Platform } from '@stamhoofd/models';
import { JudicialRecordHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

/**
 * The `judicialRecordMinimumAge` of every responsibility the given records point at, by responsibility id.
 *
 * Each record is resolved against its own organization instead of against one organization in scope, because
 * an extract is delivered from the member portal, which on a platform is in no organization at all.
 * Organizations define responsibilities with a `judicialRecordMinimumAge` of their own, so a null scope would
 * read one of those as no requirement and refuse a member who does have to deliver.
 *
 * Lives outside both judicial record services because both need it, and importing one from the other would
 * close a cycle between storage and notification.
 */
export async function getJudicialRecordMinimumAges(records: MemberResponsibilityRecord[]): Promise<Map<string, number | null>> {
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

/**
 * The organizations whose own or inherited responsibilities ask this member for an extract today.
 *
 * Scopes the reviewer notification. An approval is a fact about the person and binds every organization, but
 * being asked for one is not: an organization that never asks has no reason to hear that a delivery is
 * waiting, and no business looking at the document.
 */
export function getRequiringOrganizationIds(member: Member, records: MemberResponsibilityRecord[], minimumAges: Map<string, number | null>, atDate = new Date()): string[] {
    const organizationIds = records
        .filter(record => record.organizationId !== null && JudicialRecordHelper.requiresExtract({
            responsibility: {
                startDate: record.startDate,
                endDate: record.endDate,
                minimumAge: minimumAges.get(record.responsibilityId) ?? null,
            },
            birthDay: member.details.birthDay,
            atDate,
        }))
        .map(record => record.organizationId!);

    return Formatter.uniqueArray(organizationIds);
}
