import { ObjectData } from '@common/encoding';
import { Database } from '@node/database';
import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, compileToSQLFilter, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';
import { TranslatedString, TranslatedStringDecoder } from '@stamhoofd/structures';
import { convertEventNameToJson } from '@stamhoofd/models/migrations/1793234290-events-translatable-name.js';
import { SQLTranslatedString } from '../helpers/SQLTranslatedString.js';

// The test database already migrated the `events` table, so the migration runs against a copy of the old table layout
const runMigrationOn = convertEventNameToJson;

const nameFilters: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    name: createColumnFilter({
        expression: new SQLTranslatedString(SQL.column('name'), '$.value'),
        type: SQLValueType.String,
        nullable: false,
    }),
};

describe('migration.events-translatable-name', () => {
    const legacyNames = [
        'Zomerkamp 2026',
        'Weekend "aan zee" \\ 100% fun',
        'Café ☕ 🎉 Ünïcødé',
        '',
        '{"nl": "Dit is geen vertaling"}',
        'x'.repeat(2000),
    ];

    let tableName: string;

    beforeEach(async () => {
        tableName = 'events_migration_test_' + Math.random().toString(36).substring(2, 15);
        await Database.statement(`CREATE TABLE \`${tableName}\` (
            \`id\` varchar(36) NOT NULL DEFAULT '',
            \`typeId\` varchar(36) NOT NULL,
            \`name\` text NOT NULL,
            \`startDate\` datetime NOT NULL,
            \`meta\` json NOT NULL,
            PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`);

        for (const [index, name] of legacyNames.entries()) {
            await Database.insert('INSERT INTO `' + tableName + '` SET ?', [{
                id: 'event-' + index,
                typeId: 'type',
                name,
                startDate: new Date(2026, 0, 1),
                meta: JSON.stringify({ value: {}, version: 425 }),
            }]);
        }
    });

    afterEach(async () => {
        await Database.statement(`DROP TABLE IF EXISTS \`${tableName}\``);
    });

    it('converts the name column to a NOT NULL json column at the same position', async () => {
        await runMigrationOn(tableName);

        const [rows] = await Database.select('SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [tableName], { nestTables: false });
        const columns = rows as unknown as { COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string }[];
        expect(columns.map(c => c.COLUMN_NAME)).toEqual(['id', 'typeId', 'name', 'startDate', 'meta']);

        const nameColumn = columns.find(c => c.COLUMN_NAME === 'name')!;
        expect(nameColumn.DATA_TYPE).toBe('json');
        expect(nameColumn.IS_NULLABLE).toBe('NO');
    });

    it('stores every existing name as an untranslated value that the model decodes unchanged', async () => {
        await runMigrationOn(tableName);

        const [result] = await Database.select('SELECT `id`, `name` FROM `' + tableName + '` ORDER BY `id`', [], { nestTables: false });
        const rows = result as unknown as { id: string; name: string }[];
        expect(rows).toHaveLength(legacyNames.length);

        for (const [index, name] of legacyNames.entries()) {
            const row = rows.find(r => r.id === 'event-' + index)!;
            const parsed = JSON.parse(row.name) as { value: unknown; version: number };
            expect(parsed).toEqual({ value: name, version: 0 });

            // Same path as the json column decoder of the Event model
            const decoded = TranslatedStringDecoder.decode(new ObjectData(parsed.value, { version: parsed.version }));
            expect(decoded).toEqual(TranslatedString.create(name));
            expect(decoded.isDefault).toBe(true);
            expect(decoded.toString()).toBe(name);
        }
    });

    it('keeps the migrated names filterable and sortable with the translated string expression', async () => {
        await runMigrationOn(tableName);

        for (const [index, name] of legacyNames.entries()) {
            const results = await SQL.select().from(tableName).where(await compileToSQLFilter({ name }, nameFilters)).fetch();
            expect(results.map(r => r[tableName]!.id), name).toEqual(['event-' + index]);
        }

        const sorted = await SQL.select().from(tableName).orderBy(new SQLTranslatedString(SQL.column('name'), '$.value'), 'ASC').fetch();
        const sortedIds = sorted.map(r => r[tableName]!.id);
        expect(sortedIds).toHaveLength(legacyNames.length);

        // Only compare the names that start with a letter: the collation order of punctuation is not what is tested here
        expect(sortedIds.filter(id => !['event-1', 'event-4'].includes(id as string))).toEqual(['event-3', 'event-2', 'event-5', 'event-0']);
    });

    it('writes new rows in the same format as the migrated rows', async () => {
        await runMigrationOn(tableName);

        // Mirrors what the json column of the Event model writes
        await Database.insert('INSERT INTO `' + tableName + '` SET ?', [{
            id: 'event-new',
            typeId: 'type',
            name: JSON.stringify({ value: { nl: 'Bosspel', en: 'Forest game' }, version: 426 }),
            startDate: new Date(2026, 0, 1),
            meta: JSON.stringify({ value: {}, version: 426 }),
        }]);

        const results = await SQL.select().from(tableName).where(await compileToSQLFilter({ name: { $in: ['Bosspel', 'Forest game'] } }, nameFilters)).fetch();
        expect(results.map(r => r[tableName]!.id)).toEqual(['event-new']);
    });

    it('can be retried after a failure halfway and skips a table that is already converted', async () => {
        // Simulate a run that stopped after the temporary column was added and partially filled
        await Database.statement(`ALTER TABLE \`${tableName}\` ADD COLUMN \`nameJson\` json NULL AFTER \`typeId\``);
        await Database.statement(`UPDATE \`${tableName}\` SET \`nameJson\` = JSON_OBJECT('value', \`name\`, 'version', 0) WHERE \`id\` = 'event-0'`);

        await runMigrationOn(tableName);
        await runMigrationOn(tableName);

        const [result] = await Database.select('SELECT `id`, `name` FROM `' + tableName + '` ORDER BY `id`', [], { nestTables: false });
        const rows = result as unknown as { id: string; name: string }[];
        expect(rows.map(r => [r.id, JSON.parse(r.name)])).toEqual(legacyNames.map((name, index) => ['event-' + index, { value: name, version: 0 }]));
    });
});
