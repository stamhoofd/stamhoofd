import { Group, Member, MemberResponsibilityRecord, Platform, Registration } from '@stamhoofd/models';
import { SQL, SQLWhereExists } from '@stamhoofd/sql';
import { GroupType } from '@stamhoofd/structures';
import { MemberUserSyncer } from './MemberUserSyncer';

export class FlagMomentCleanup {
    /**
     * End functions of old members who have no active registration for the current period.
     */
    static async endFunctionsOfUsersWithoutRegistration() {
        console.log('Start cleanup functions');
        const responsibilitiesToEnd = await this.getActiveMemberResponsibilityRecordsForOrganizationWithoutRegistrationInCurrentPeriod();

        const now = new Date();

        await Promise.all(responsibilitiesToEnd.map(async (responsibility) => {
            responsibility.endDate = now;
            await responsibility.save();
            console.log(`Ended responsibility with id ${responsibility.id}`);

            const member = await Member.getByID(responsibility.memberId);
            if (member) {
                await MemberUserSyncer.onChangeMember(member);
            }
        }));
    }

    static async getActiveMemberResponsibilityRecordsForOrganizationWithoutRegistrationInCurrentPeriod() {
        const currentPeriodId = (await Platform.getShared()).periodId;

        return await MemberResponsibilityRecord.select()
            .whereNot('organizationId', null)
            .where(
                MemberResponsibilityRecord.whereActive,
            )
            .whereNot(
                new SQLWhereExists(
                    SQL.select()
                        .from(Registration.table)
                        .join(
                            SQL.innerJoin(SQL.table(Group.table))
                                .where(
                                    SQL.column(Group.table, 'id'),
                                    SQL.column(Registration.table, 'groupId'),
                                ),
                        )
                        .where(
                            SQL.column(Registration.table, 'memberId'),
                            SQL.column(MemberResponsibilityRecord.table, 'memberId'),
                        ).where(
                            SQL.column(Registration.table, 'organizationId'),
                            SQL.column(MemberResponsibilityRecord.table, 'organizationId'),
                        ).where(
                            SQL.column(Registration.table, 'periodId'),
                            currentPeriodId,
                        ).where(
                            SQL.column(Registration.table, 'deactivatedAt'),
                            null,
                        ).whereNot(
                            SQL.column(Registration.table, 'registeredAt'),
                            null,
                        ).where(
                            SQL.column(Group.table, 'type'),
                            GroupType.Membership,
                        ).where(
                            SQL.column(Group.table, 'deletedAt'),
                            null,
                        ),
                ),
            )
            .fetch();
    }
}
