import { Group, Member, MemberResponsibilityRecord, Organization, Platform, Registration } from '@stamhoofd/models';
import { SQL, SQLWhereExists } from '@stamhoofd/sql';
import { GroupType } from '@stamhoofd/structures';
import { MemberUserSyncer } from './MemberUserSyncer.js';

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
        if (STAMHOOFD.userMode === 'platform') {
            const platform = await Platform.getShared();
            const currentPeriodId = platform.periodId;
            const platformResponsibilityIds = platform.config.responsibilities.map(r => r.id);

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
                                SQL.where(
                                    SQL.column(Group.table, 'defaultAgeGroupId'),
                                    '!=',
                                    null,
                                ).or(
                                    SQL.column(MemberResponsibilityRecord.table, 'responsibilityId'),
                                    '!=',
                                    platformResponsibilityIds,
                                ),
                            ).where(
                                SQL.column(Group.table, 'deletedAt'),
                                null,
                            ),
                    ),
                )
                .fetch();
        }
        else {
            return await MemberResponsibilityRecord.select()
                .join(SQL.innerJoin(
                    SQL.table(Organization.table))
                    .where(
                        SQL.column(Organization.table, 'id'),
                        SQL.column(MemberResponsibilityRecord.table, 'organizationId'),
                    ),
                )
                .whereNot('organizationId', null)
                .whereNot(SQL.column(Organization.table, 'periodId'), null)
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
                                SQL.column(Organization.table, 'periodId'),
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
}
