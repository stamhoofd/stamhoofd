import { ObjectData } from '@common/encoding';
import { Database } from '@node/database';
import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, compileToSQLFilter, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';
import { TranslatedString, TranslatedStringDecoder } from '@stamhoofd/structures';
import { promises as fs } from 'fs';
import path from 'path';
import { SQLTranslatedString } from '../helpers/SQLTranslatedString.js';

const migrationFile = path.resolve(import.meta.dirname, '../../../../shared/models/src/migrations/1793320559-balance-items-translatable-name.sql');

/**
 * The migration is written against the `balance_items` table, which the test database already migrated.
 * Run the same statements against a copy of the old table layout instead.
 */
async function runMigrationOn(tableName: string) {
    const sql = await fs.readFile(migrationFile, { encoding: 'utf-8' });
    const statements = sql.replaceAll('`balance_items`', '`' + tableName + '`').split(';').map(s => s.trim()).filter(s => s.length > 0);
    expect(statements.length).toBeGreaterThan(1);

    for (const statement of statements) {
        await Database.statement(statement);
    }
}

describe('migration.balance-items-translatable-name', () => {
    const legacyItems: { name: string; description: string | null }[] = [
        { name: 'Kampgeld 2026', description: 'Weekend aan zee' },
        { name: 'Weekend "aan zee" \\ 100% fun', description: null },
        { name: 'Café ☕ 🎉 Ünïcødé', description: '' },
        { name: '', description: '{"nl": "Dit is geen vertaling"}' },
        { name: 'x'.repeat(2000), description: null },
    ];

    let tableName: string;

    beforeEach(async () => {
        tableName = 'balance_items_migration_test_' + Math.random().toString(36).substring(2, 15);
        await Database.statement(`CREATE TABLE \`${tableName}\` (
            \`id\` varchar(36) NOT NULL DEFAULT '',
            \`organizationId\` varchar(36) NOT NULL,
            \`name\` text NOT NULL,
            \`description\` text NULL,
            \`relations\` json NOT NULL,
            \`unitPrice\` int NOT NULL,
            PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`);

        for (const [index, item] of legacyItems.entries()) {
            await Database.insert('INSERT INTO `' + tableName + '` SET ?', [{
                id: 'item-' + index,
                organizationId: 'organization',
                name: item.name,
                description: item.description,
                relations: JSON.stringify({ value: {}, version: 425 }),
                unitPrice: 100,
            }]);
        }
    });

    afterEach(async () => {
        await Database.statement(`DROP TABLE IF EXISTS \`${tableName}\``);
    });

    it('converts both columns to NOT NULL json columns at the same position', async () => {
        await runMigrationOn(tableName);

        const [rows] = await Database.select('SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [tableName], { nestTables: false });
        const columns = rows as unknown as { COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string }[];
        expect(columns.map(c => c.COLUMN_NAME)).toEqual(['id', 'organizationId', 'name', 'description', 'relations', 'unitPrice']);

        const nameColumn = columns.find(c => c.COLUMN_NAME === 'name')!;
        expect(nameColumn.DATA_TYPE).toBe('json');
        expect(nameColumn.IS_NULLABLE).toBe('NO');

        const descriptionColumn = columns.find(c => c.COLUMN_NAME === 'description')!;
        expect(descriptionColumn.DATA_TYPE).toBe('json');
        expect(descriptionColumn.IS_NULLABLE).toBe('NO');
    });

    it('stores every existing value as an untranslated string that the model decodes unchanged, and turns null descriptions into empty strings', async () => {
        await runMigrationOn(tableName);

        const [result] = await Database.select('SELECT `id`, `name`, `description` FROM `' + tableName + '` ORDER BY `id`', [], { nestTables: false });
        const rows = result as unknown as { id: string; name: string; description: string | null }[];
        expect(rows).toHaveLength(legacyItems.length);

        for (const [index, item] of legacyItems.entries()) {
            const row = rows.find(r => r.id === 'item-' + index)!;

            for (const [column, legacy] of [['name', item.name], ['description', item.description ?? '']] as const) {
                const parsed = JSON.parse(row[column]!) as { value: unknown; version: number };
                expect(parsed).toEqual({ value: legacy, version: 0 });

                // Same path as the json column decoder of the BalanceItem model
                const decoded = TranslatedStringDecoder.decode(new ObjectData(parsed.value, { version: parsed.version }));
                expect(decoded).toEqual(TranslatedString.create(legacy));
                expect(decoded.isDefault).toBe(true);
                expect(decoded.toString()).toBe(legacy);
            }
        }
    });

    it('keeps the migrated names and descriptions filterable with the translated string expression', async () => {
        await runMigrationOn(tableName);

        const filters: SQLFilterDefinitions = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({
                expression: new SQLTranslatedString(SQL.column('name'), '$.value'),
                type: SQLValueType.String,
                nullable: false,
            }),
            description: createColumnFilter({
                expression: new SQLTranslatedString(SQL.column('description'), '$.value'),
                type: SQLValueType.String,
                nullable: false,
            }),
        };

        for (const [index, item] of legacyItems.entries()) {
            const results = await SQL.select().from(tableName).where(await compileToSQLFilter({ name: item.name }, filters)).fetch();
            expect(results.map(r => r[tableName]!.id), item.name).toEqual(['item-' + index]);
        }

        const withoutDescription = await SQL.select().from(tableName).where(await compileToSQLFilter({ description: '' }, filters)).fetch();
        expect(withoutDescription.map(r => r[tableName]!.id).sort()).toEqual(['item-1', 'item-2', 'item-4']);

        const seaside = await SQL.select().from(tableName).where(await compileToSQLFilter({ description: 'Weekend aan zee' }, filters)).fetch();
        expect(seaside.map(r => r[tableName]!.id)).toEqual(['item-0']);
    });

    it('writes new rows in the same format as the migrated rows', async () => {
        await runMigrationOn(tableName);

        // Mirrors what the json columns of the BalanceItem model write
        await Database.insert('INSERT INTO `' + tableName + '` SET ?', [{
            id: 'item-new',
            organizationId: 'organization',
            name: JSON.stringify({ value: { nl: 'Kampgeld', en: 'Camp fee' }, version: 426 }),
            description: JSON.stringify({ value: { nl: 'Weekend aan zee', en: 'Weekend at the seaside' }, version: 426 }),
            relations: JSON.stringify({ value: {}, version: 426 }),
            unitPrice: 100,
        }]);

        const filters: SQLFilterDefinitions = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({
                expression: new SQLTranslatedString(SQL.column('name'), '$.value'),
                type: SQLValueType.String,
                nullable: false,
            }),
        };

        const results = await SQL.select().from(tableName).where(await compileToSQLFilter({ name: { $in: ['Kampgeld', 'Camp fee'] } }, filters)).fetch();
        expect(results.map(r => r[tableName]!.id)).toEqual(['item-new']);
    });
});
