import { Database, Migration } from '@simonbackx/simple-database';

/**
 * If the charset of the leads table is not converted this results
 * in foreign keys constraint errors in other migrations.
 *
 * todo: will we keep the leads table after the migration?
 */
export default new Migration(async () => {
    process.stdout.write('\n');

    if (STAMHOOFD.userMode === 'platform' && (STAMHOOFD.environment === 'production' || STAMHOOFD.environment === 'staging')) {
        console.log('Skipped update leads charset for userMode platform in production.');
        return Promise.resolve();
    }

    const hasTable = await tableExists('leads');
    console.log('Has leads table: ' + hasTable);

    if (hasTable) {
        await convertTable('leads');
    }

    return Promise.resolve();
});

async function tableExists(tableName: string): Promise<boolean> {
    const [rows] = await Database.select(
        `
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = ?
        `,
        [tableName],
    );

    const count = rows[0]['']['count'];

    if (typeof count !== 'number') {
        throw new Error('count is not a number');
    }

    return count > 0;
}

async function convertTable(name: string): Promise<void> {
    await Database.beginTransaction(async () => {
        await Database.statement('set foreign_key_checks=0;');

        console.log('Start converting charset of table: ' + name);
        await Database.statement('ALTER TABLE `' + name + '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;');

        await Database.statement('set foreign_key_checks=1;');
    });
}
