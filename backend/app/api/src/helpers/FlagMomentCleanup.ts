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
        // Platform-wide (default) responsibilities are only kept alive by registrations in groups linked to a
        // default age group. In organization mode this list is empty and that nuance does not apply.
        const platformResponsibilityIds = STAMHOOFD.userMode === 'platform'
            ? (await Platform.getShared()).config.responsibilities.map(r => r.id)
            : [];

        for await (const organizations of Organization.select().whereNot('periodId', null).limit(50).allBatched()) {
            const periods = await RegistrationPeriod.getByIDs(...Formatter.uniqueArray(organizations.map(o => o.periodId)));

            for (const organization of organizations) {
                const period = periods.find(p => p.id === organization.periodId);
                if (!period) {
                    continue;
                }
                await this.endResponsibilitiesForOrganization(organization.id, period, platformResponsibilityIds);
            }
        }
    }

    private static async endResponsibilitiesForOrganization(organizationId: string, currentPeriod: RegistrationPeriod, platformResponsibilityIds: string[]) {
        const now = new Date();

        const records = await MemberResponsibilityRecord.select()
            .where('organizationId', organizationId) // rule A
            .where(MemberResponsibilityRecord.whereActive) // rule B
            .fetch();

        if (records.length === 0) {
            return;
        }

        const memberIds = Formatter.uniqueArray(records.map(r => r.memberId));
        const registrationsPerMember = await this.getRegistrationsIncludingDeletedGroups(organizationId, currentPeriod.id, memberIds);

        const changedMemberIds = new Set<string>();
        for (const record of records) {
            const registrations = registrationsPerMember.get(record.memberId) ?? [];
            const autoRemoveDate = record.getBaseStructure().getAutoRemoveDate(registrations, currentPeriod, platformResponsibilityIds);
            if (autoRemoveDate === null || autoRemoveDate > now) {
                continue;
            }

            record.endDate = now;
            await record.save();
            changedMemberIds.add(record.memberId);
            console.log(`Ended responsibility ${record.id} of member ${record.memberId} in organization ${organizationId} (auto-remove date was ${autoRemoveDate.toISOString()})`);
        }

        if (changedMemberIds.size === 0) {
            return;
        }

        for (const member of await Member.getByIDs(...changedMemberIds)) {
            await MemberUserSyncer.onChangeMember(member);
        }
    }

    /**
     * Only loads the registrations getAutoRemoveDate can take into account (same organization and period).
     * Unlike Member.loadRegistrations, this keeps registrations in deleted groups: getAutoRemoveDate needs the group's deletedAt.
     */
    private static async getRegistrationsIncludingDeletedGroups(organizationId: string, periodId: string, memberIds: string[]): Promise<Map<string, RegistrationStruct[]>> {
        const registrations = await Registration.select()
            .where('organizationId', organizationId)
            .where('periodId', periodId)
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
