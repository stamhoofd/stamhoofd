import { Migration } from '@simonbackx/simple-database';
import { DocumentTemplate, Group } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    process.stdout.write('\n');
    console.log('Start updating year of document templates.');
    await migrateDocumentYears();

    return Promise.resolve();
});

export async function migrateDocumentYears() {
    let realUpdate = 0;
    const result = await SeedTools.loop({
        query: DocumentTemplate.select(),
        batchSize: 100,
        useTransactionPerBatch: true,
        action: async (document: DocumentTemplate) => {
            // check
            if (!document.year) {
            // by default use the year before creation
                let year: number = document.createdAt.getFullYear() - 1;

                const groups = document.privateSettings.groups;
                const groupIds: string[] = [...new Set(groups.map(g => g.group.id))];

                if (groupIds.length > 0) {
                    const query = Group.select().where(SQL.where('id', groupIds));
                    const groupModels = await query.fetch();

                    // count the number of groups per year
                    const yearMap = new Map<number, number>();

                    for (const group of groups) {
                        const model = groupModels.find(g => g.id === group.group.id);
                        if (!model) {
                            continue;
                        }

                        // Note: we need to use the cycle settings to find the correct start and end dates
                        const info = model.settings.cycleSettings.get(group.cycle);
                        if (info && group.cycle !== model.cycle) {
                            if (info.startDate) {
                                const y = Formatter.luxon(info.startDate).year;

                                const count = yearMap.get(y) ?? 0;
                                yearMap.set(y, count + 1);
                            } else {
                                // Missing info: don't use the wrong year
                            }
                        } else {
                            const y = Formatter.luxon(model.settings.startDate).year;
                            const count = yearMap.get(y) ?? 0;
                            yearMap.set(y, count + 1);
                        }
                    }

                    // find the year with the highest count
                    let topYear = 0;
                    let topCount = 0;

                    for (const [year, count] of yearMap) {
                        if (count > topCount) {
                            topYear = year;
                            topCount = count;
                        }
                    }

                    // use the year with the highest count
                    if (topCount > 0) {
                        year = topYear;
                    }
                }

                const creationYear = Formatter.luxon(document.createdAt).year;
                if (creationYear < year) {
                    // This should never log: if this logs we should fix the migration
                    console.error('FIXME: Unexpected document year ' + year + ' which is larger than creation year ' + creationYear + ' for ' + document.id);
                    year = creationYear;
                }

                document.year = year;
                if (await document.save({
                    forceSave: true,
                    skipMarkSaved: true,
                    skipSendEvents: true,
                })) {
                    realUpdate += 1;
                }
            }
        },
    });

    console.log('Migrated ' + realUpdate + ' document templates of ' + result.total + ' looped document templates');
};
