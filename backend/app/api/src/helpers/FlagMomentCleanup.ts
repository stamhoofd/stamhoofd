import { Group, Member, MemberResponsibilityRecord, Organization, Platform, Registration, RegistrationPeriod } from '@stamhoofd/models';
import type { Registration as RegistrationStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
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
            .whereNot('organizationId', null) // rule A
            .where(MemberResponsibilityRecord.whereActive) // rule B
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

        const allMemberIds = [...recordsPerMember.keys()];
        for (let i = 0; i < allMemberIds.length; i += 100) {
            const memberIds = allMemberIds.slice(i, i + 100);
            const members = await Member.getByIDs(...memberIds);
            const registrationsPerMember = await this.getRegistrationsIncludingDeletedGroups(memberIds);

            for (const member of members) {
                const memberRecords = recordsPerMember.get(member.id) ?? [];
                const registrations = registrationsPerMember.get(member.id) ?? [];

                let changed = false;
                for (const record of memberRecords) {
                    // record.organizationId is guaranteed to be set (whereNot organizationId null)
                    const currentPeriod = await getCurrentPeriod(record.organizationId!);
                    if (!currentPeriod) {
                        continue; // organization has no current period -> skip
                    }

                    const autoRemoveDate = record.getBaseStructure().getAutoRemoveDate(registrations, currentPeriod, platformResponsibilityIds);
                    if (autoRemoveDate === null || autoRemoveDate > now) {
                        continue;
                    }

                    record.endDate = now;
                    await record.save();
                    changed = true;
                    console.log(`Ended responsibility ${record.id} of member ${member.id} in organization ${record.organizationId} (auto-remove date was ${autoRemoveDate.toISOString()})`);
                }

                if (changed) {
                    await MemberUserSyncer.onChangeMember(member);
                }
            }
        }
    }

    /**
     * Unlike Member.loadRegistrations, this keeps registrations in deleted groups: getAutoRemoveDate needs the group's deletedAt.
     */
    private static async getRegistrationsIncludingDeletedGroups(memberIds: string[]): Promise<Map<string, RegistrationStruct[]>> {
        const registrations = await Registration.select()
            .where('memberId', memberIds)
            .whereNot('registeredAt', null)
            .fetch();

        const groupIds = Formatter.uniqueArray(registrations.map(r => r.groupId));
        const groups = groupIds.length ? await Group.getByIDs(...groupIds) : [];
        const groupsById = new Map(groups.map(g => [g.id, g]));

        const result = new Map<string, RegistrationStruct[]>();
        for (const registration of registrations) {
            const group = groupsById.get(registration.groupId);
            if (!group) {
                continue;
            }
            const structure = registration.setRelation(Registration.group, group).getStructure();
            const list = result.get(registration.memberId);
            if (list) {
                list.push(structure);
            } else {
                result.set(registration.memberId, [structure]);
            }
        }
        return result;
    }
}
