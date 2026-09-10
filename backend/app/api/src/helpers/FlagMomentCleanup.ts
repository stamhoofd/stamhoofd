import { Member, MemberResponsibilityRecord, Organization, Platform, RegistrationPeriod } from '@stamhoofd/models';
import { MemberUserSyncer } from './MemberUserSyncer.js';

export class FlagMomentCleanup {
    /**
     * End organization-scoped responsibilities of members that are no longer registered, based on
     * MemberResponsibilityRecord.getAutoRemoveDate.
     */
    static async endResponsibilitiesOfUnregisteredMembers() {
        const now = new Date();

        // NOTE: query should always be in accordance with getAutoRemoveDate!

        // Platform-wide (default) responsibilities are only kept alive by registrations in groups linked to a
        // default age group. In organization mode this list is empty and that nuance does not apply.
        const platformResponsibilityIds = STAMHOOFD.userMode === 'platform'
            ? (await Platform.getShared()).config.responsibilities.map(r => r.id)
            : [];

        // All active, organization-scoped responsibility records
        const records = await MemberResponsibilityRecord.select()
            .where(MemberResponsibilityRecord.whereActive) // rule A
            .whereNot('organizationId', null) // rule B
            .fetch();

        if (records.length === 0) {
            return;
        }

        // Group records per member, so we load each member's registrations only once
        const recordsPerMember = new Map<string, MemberResponsibilityRecord[]>();
        for (const record of records) {
            const list = recordsPerMember.get(record.memberId);
            if (list) {
                list.push(record);
            } else {
                recordsPerMember.set(record.memberId, [record]);
            }
        }

        // Resolve the current period per organization (each organization can be in its own period)
        const periodPerOrganization = new Map<string, RegistrationPeriod | null>();
        const getCurrentPeriod = async (organizationId: string): Promise<RegistrationPeriod | null> => {
            const cached = periodPerOrganization.get(organizationId);
            if (cached !== undefined) {
                return cached;
            }
            const organization = await Organization.getByID(organizationId);
            const period = organization?.periodId ? (await RegistrationPeriod.getByID(organization.periodId)) ?? null : null;
            periodPerOrganization.set(organizationId, period);
            return period;
        };

        for (const [memberId, memberRecords] of recordsPerMember) {
            const member = await Member.getByIdWithRegistrationsAndGroups(memberId);
            if (!member) {
                continue;
            }

            let changed = false;
            for (const record of memberRecords) {
                // record.organizationId is guaranteed to be set (whereNot organizationId null)
                const currentPeriod = await getCurrentPeriod(record.organizationId!);
                if (!currentPeriod) {
                    continue; // organization has no current period -> skip
                }

                const autoRemoveDate = record.getBaseStructure().getAutoRemoveDate(member.registrations.map(r => r.getStructure()), currentPeriod, platformResponsibilityIds);
                if (autoRemoveDate === null || autoRemoveDate > now) {
                    continue;
                }

                record.endDate = now;
                await record.save();
                changed = true;
                console.log(`Ended responsibility ${record.id} of member ${memberId} in organization ${record.organizationId} (auto-remove date was ${autoRemoveDate.toISOString()})`);
            }

            if (changed) {
                await MemberUserSyncer.onChangeMember(member);
            }
        }
    }
}
