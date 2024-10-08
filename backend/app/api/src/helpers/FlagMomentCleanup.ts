import { MemberResponsibilityRecord, Platform, Registration } from '@stamhoofd/models';
import { SQL, SQLWhereExists, SQLWhereSign } from '@stamhoofd/sql';

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
        }));
    }

    static async getActiveMemberResponsibilityRecordsForOrganizationWithoutRegistrationInCurrentPeriod() {
        const currentPeriodId = (await Platform.getShared()).periodId;

        const now = new Date();

        return await MemberResponsibilityRecord.select()
            .whereNot('organizationId', null)
            .where(
                SQL.where('startDate', SQLWhereSign.LessEqual, now)
                    .or('startDate', null),
            )
            .where(
                SQL.where('endDate', SQLWhereSign.GreaterEqual, now)
                    .or('endDate', null),
            )
            .whereNot(
                new SQLWhereExists(
                    SQL.select()
                        .from(Registration.table)
                        .where('memberId', SQL.column(MemberResponsibilityRecord.table, 'memberId'))
                        .where('organizationId', SQL.column(MemberResponsibilityRecord.table, 'organizationId'))
                        .where('periodId', currentPeriodId)
                        .where('deactivatedAt', null)
                        .where('waitingList', 0),
                ),
            )
            .fetch();
    }
}
