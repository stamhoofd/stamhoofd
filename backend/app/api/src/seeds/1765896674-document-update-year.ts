import { Migration } from '@simonbackx/simple-database';
import { DocumentTemplate, Group } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';

export async function migrateDocumentYears() {
    let c = 0;
    const totalDocuments = await DocumentTemplate.select().count();

    for await (const document of DocumentTemplate.select().all()) {
        c++;
        if (c % 1000 === 0) {
            console.log('Processed', c, 'of', totalDocuments);
        }

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

                for (const group of groupModels) {
                    const startYear = group.settings.startDate.getFullYear();
                    const endYear = group.settings.endDate.getFullYear();

                    for (let y = startYear; y <= endYear; y++) {
                        const count = yearMap.get(y) ?? 0;
                        yearMap.set(y, count + 1);
                    }
                }

                // find the year with the highest count
                let topYear = 0;
                let topCount = 0;
                const yearBeforeCreation = document.createdAt.getFullYear() - 1;

                for (const [year, count] of yearMap) {
                    if (count > topCount
                        // prefer the year before creation
                        || (count === topCount && year === yearBeforeCreation)
                        // next prefer the most recent year
                        || (topYear !== yearBeforeCreation && year > topYear)
                    ) {
                        topYear = year;
                        topCount = count;
                    }
                }

                // use the year with the highest count
                if (topCount > 0) {
                    year = topYear;
                }
            }

            document.year = year;
            await document.save();
        }
    }
};

export default new Migration(async () => {
    process.stdout.write('\n');
    console.log('Start updating year of document templates.');
    await migrateDocumentYears();

    return Promise.resolve();
});
