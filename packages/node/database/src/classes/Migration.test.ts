import path from 'path';
import { Database, DatabaseInstance } from './Database.js';
import { Migration } from './Migration.js';

describe('Migration.runAll', () => {
    // A second database, like a service that has access to more than one.
    const databaseName = 'simple-database-tests-migrations';
    const folder = path.join(import.meta.dirname, '../../tests/scoped-migrations');
    const migrationFile = '1773930130-scoped-test-table.sql';
    let other: DatabaseInstance;
    let ranSuccessfully: boolean;

    async function withoutSelectedDatabase(handler: (instance: DatabaseInstance) => Promise<void>): Promise<void> {
        const instance = new DatabaseInstance({ database: null });
        try {
            await handler(instance);
        }
        finally {
            await instance.end();
        }
    }

    async function getTables(instance: DatabaseInstance): Promise<string[]> {
        const [rows] = await instance.select(
            'SELECT TABLE_NAME as name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
            [],
            { nestTables: false },
        );
        return rows.map(row => row.name as string);
    }

    beforeAll(async () => {
        await withoutSelectedDatabase(async (instance) => {
            await instance.statement(`DROP DATABASE IF EXISTS ${instance.escapeId(databaseName)}`);
            await instance.statement(`CREATE DATABASE ${instance.escapeId(databaseName)} DEFAULT CHARACTER SET = \`utf8mb4\``);
        });
        other = new DatabaseInstance({ database: databaseName });

        ranSuccessfully = await Migration.runAll(folder, { database: other });
    });

    afterAll(async () => {
        await other.end();
        await withoutSelectedDatabase(async (instance) => {
            await instance.statement(`DROP DATABASE IF EXISTS ${instance.escapeId(databaseName)}`);
        });
    });

    test('Runs the migrations on the database it is given, and on no other', async () => {
        expect(ranSuccessfully).toBe(true);
        expect(await getTables(other)).toEqual(expect.arrayContaining(['migrations', 'scopedTestModels']));
        expect(await getTables(DatabaseInstance.default)).not.toContain('scopedTestModels');
    });

    test('Keeps the migration history in the database the migrations ran on', async () => {
        const [rows] = await other.select('SELECT file FROM migrations', [], { nestTables: false });
        expect(rows.map(row => row.file as string)).toContain(migrationFile);

        const [defaultRows] = await Database.select('SELECT file FROM migrations WHERE file = ?', [migrationFile], { nestTables: false });
        expect(defaultRows).toHaveLength(0);
    });

    test('Runs nothing a second time, so it can run against a database that is up to date', async () => {
        expect(await Migration.runAll(folder, { database: other })).toBe(true);

        const [rows] = await other.select('SELECT count(*) as c FROM migrations WHERE file = ?', [migrationFile], { nestTables: false });
        expect(rows[0].c).toEqual(1);
    });

    test('Restores the previous database afterwards', () => {
        expect(Database.instance).toBe(DatabaseInstance.default);
    });
});
