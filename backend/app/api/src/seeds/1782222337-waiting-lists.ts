import { Migration } from '@simonbackx/simple-database';
import { Group, Organization, RegistrationPeriod } from '@stamhoofd/models';
import { GroupSettings, GroupType, TranslatedString, WaitingListType } from '@stamhoofd/structures';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    const dryRun = false;
    await start(dryRun);

    if (dryRun) {
        throw new Error('Migration did not finish because of dryRun');
    }
});

async function start(dryRun: boolean) {
    await SeedTools.loop({
        query: Organization.select(),
        batchSize: 50,
        useTransactionPerBatch: true,
        action: async (organization: Organization) => {
            const groups: Group[] = await Group.select()
                .where('organizationId', organization.id)
                // only for current period
                .where('periodId', organization.periodId)
                .where('type', GroupType.Membership)
                .fetch();

            if (groups.length === 0) {
                return;
            }

            // const period = await OrganizationRegistrationPeriod.select().where('organizationId', organization.id).where('periodId', organization.periodId).first(true);
            const period = await RegistrationPeriod.getByID(organization.periodId, true);

            // handle group permissions
            for (const group of groups) {
                if (group.settings.waitingListType === WaitingListType.None) {
                    continue;
                }

                if (group.waitingListId) {
                    continue;
                }

                const newWaitingList = await createWaitingList(group, period, dryRun);
                group.waitingListId = newWaitingList.id;

                if (!dryRun) {
                    await group.save();
                }
            }
        },

    });
}

const cycleIfMigrated = -99;

async function createWaitingList(originalGroup: Group, period: RegistrationPeriod, dryRun: boolean) {
    const newWaitingList = new Group();
    newWaitingList.cycle = cycleIfMigrated;
    newWaitingList.type = GroupType.WaitingList;
    newWaitingList.organizationId = originalGroup.organizationId;
    newWaitingList.periodId = period.id;
    newWaitingList.settings = GroupSettings.create({
        name: TranslatedString.create($t(`%yh`) + ' ' + originalGroup.settings.name.toString()),
        period: period.getBaseStructure(),
        waitingListType: originalGroup.settings.waitingListType,
        preRegistrationsDate: originalGroup.settings.preRegistrationsDate,
    });

    if (!dryRun) {
        await newWaitingList.save();
    }

    return newWaitingList;
}
