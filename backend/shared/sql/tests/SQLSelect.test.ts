import { column, Database } from '@simonbackx/simple-database';
import { QueryableModel } from '../src/QueryableModel.js';
import { SQL } from '../src/SQL.js';
import { SQLSelect } from '../src/SQLSelect.js';
import { createTableDefinition } from './utils/index.js';

const table = 'sql_select_iterator_test';

class IteratorTestModel extends QueryableModel {
    static table = table;

    @column({ primary: true, type: 'string' })
    organizationId!: string;

    @column({ type: 'string' })
    name!: string;
}

describe('SQLSelect', () => {
    describe('all and allBatched', () => {
        const ids = Array.from({ length: 25 }, (_, i) => 'org-' + String(i).padStart(3, '0'));

        beforeAll(async () => {
            await Database.statement('DROP TABLE IF EXISTS `' + table + '`');
            await Database.statement(createTableDefinition(table, {
                organizationId: { type: 'varchar' },
                name: { type: 'varchar' },
            }));
            for (const id of ids) {
                await Database.insert('INSERT INTO `' + table + '` SET ?', [{ organizationId: id, name: 'name ' + id }]);
            }
        });

        afterAll(async () => {
            await Database.statement('DROP TABLE IF EXISTS `' + table + '`');
            await Database.end();
        });

        function select() {
            return new SQLSelect(row => row[table] as { organizationId: string; name: string }, SQL.wildcard()).from(table);
        }

        it('loops over all rows using a custom primary key', async () => {
            const visited: string[] = [];
            for await (const row of select().primaryKey('organizationId').limit(10).all()) {
                visited.push(row.organizationId);
            }
            expect(visited).toEqual(ids);
        });

        it('loops over all batches using a custom primary key', async () => {
            const batches: string[][] = [];
            for await (const batch of select().primaryKey('organizationId').limit(10).allBatched()) {
                batches.push(batch.map(row => row.organizationId));
            }
            expect(batches.map(b => b.length)).toEqual([10, 10, 5]);
            expect(batches.flat()).toEqual(ids);
        });

        it('throws when the default primary key column is missing', async () => {
            const iterator = select().limit(10).all();
            await expect(async () => {
                for await (const _ of iterator) {
                    // noop
                }
            }).rejects.toThrow();
        });

        it('uses the primary key of a queryable model', async () => {
            const visited: string[] = [];
            for await (const model of IteratorTestModel.select().limit(10).all()) {
                visited.push(model.organizationId);
            }
            expect(visited).toEqual(ids);

            const batched: string[] = [];
            for await (const batch of IteratorTestModel.select().limit(10).allBatched()) {
                batched.push(...batch.map(m => m.organizationId));
            }
            expect(batched).toEqual(ids);
        });
    });
});
