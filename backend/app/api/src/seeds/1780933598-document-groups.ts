import { Migration } from '@simonbackx/simple-database';
import { DocumentTemplate, Group, RegistrationPeriod, V1GroupMigrationData } from '@stamhoofd/models';
import { GroupType, NamedObject } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
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

    let totalGroups = 0;
    let totalNotFound = 0;

    await SeedTools.loop({
        batchSize: 100,
        query: DocumentTemplate.select(),
        useTransactionPerBatch: true,
        action: async (template: DocumentTemplate) => {
            const groups = template.privateSettings.groups;

            for (const group of groups) {
                totalGroups += 1;
                const newGroup = await getNewGroup(group.group.id, group.cycle, template.id);

                // it is possible that the group was deleted
                if (newGroup) {
                    const period = await RegistrationPeriod.getByID(newGroup.periodId);

                    group.group = NamedObject.create({
                        id: newGroup.id,
                        name: newGroup.settings.name.toString(),
                        description: newGroup.type === GroupType.Membership && period ? getPeriodName(period) : (Formatter.dateRange(newGroup.settings.startDate, newGroup.settings.endDate)),
                    });

                    await template.save({ forceSave: true });
                } else {
                    totalNotFound += 1;
                    console.log(`Group not found, id: ${group.group.id}, cycle: ${group.cycle}`);
                }
            }
        },
    });

    console.log('Finished updating groups on document templates:');
    // check if reasonable amount of groups had been found
    console.log(`totalGroups: ${totalGroups}, totalNotFound: ${totalNotFound} (${totalNotFound / totalGroups * 100}%)`);
});

// see get name on period structure (same logic)
function getPeriodName(period: RegistrationPeriod) {
    if (period.customName) {
        return period.customName;
    }

    if (Formatter.year(period.endDate) === Formatter.year(period.startDate)) {
        return $t(`%7Z`) + ' ' + Formatter.year(period.startDate);
    }

    return $t(`%7Z`) + ' ' + Formatter.year(period.startDate) + ' - ' + Formatter.year(period.endDate);
}

async function getNewGroup(oldGroupId: string, cycle: number, templateId: string) {
    try {
        const migrationData = await V1GroupMigrationData.select()
            .where('oldGroupId', oldGroupId)
            .where('oldCycle', cycle)
            // the group could have been deleted
            .first(false);

        if (!migrationData) {
            return null;
        }

        const newGroupId: string = migrationData.newGroupId;

        return await Group.getByID(newGroupId);
    } catch (e) {
        console.error(`oldGroupId: ${oldGroupId}, cycle: ${cycle}, templateId: ${templateId}`);
        throw e;
    }
}
