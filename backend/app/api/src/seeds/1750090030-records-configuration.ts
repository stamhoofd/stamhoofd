import { Migration } from '@simonbackx/simple-database';
import { Organization } from '@stamhoofd/models';

export async function startRecordsConfigurationMigration() {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    let c = 0;
    let id: string = '';

    while (true) {
        const rawOrganizations = await Organization.where({
            id: {
                value: id,
                sign: '>',
            },
        }, { limit: 100, sort: ['id'] });

        const organizations = await Organization.getByIDs(...rawOrganizations.map(o => o.id));

        for (const organization of organizations) {
            await organization.save();
            c++;

            if (c % 1000 === 0) {
                process.stdout.write('.');
            }
            if (c % 10000 === 0) {
                process.stdout.write('\n');
            }
        }

        if (organizations.length === 0) {
            break;
        }

        id = organizations[organizations.length - 1].id;
    }
}

export default new Migration(async () => {
    await startRecordsConfigurationMigration();
});
