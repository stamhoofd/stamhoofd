import { Database } from '@simonbackx/simple-database';
import { SQL } from '../src/SQL.js';
import { SQLAlias, SQLCount, SQLMin, SQLSelectAs } from '../src/SQLExpressions.js';
import { SQLWhereOr } from '../src/SQLWhere.js';
import { doesQueryMatch } from './utils/index.js';

const table = 'sql_delete_test';

describe('SQLDelete', () => {
    describe('query generation', () => {
        it('generates a single-table delete with a where clause', () => {
            const query = SQL.delete()
                .from(SQL.table(table))
                .where(SQL.column('id'), '5');

            doesQueryMatch(query.getSQL(), {
                query: 'DELETE FROM `sql_delete_test` WHERE `sql_delete_test`.`id` = ?',
                params: ['5'],
            });
        });

        it('generates a delete without a where clause', () => {
            const query = SQL.delete().from(SQL.table(table));

            doesQueryMatch(query.getSQL(), {
                query: 'DELETE FROM `sql_delete_test`',
                params: [],
            });
        });

        it('combines multiple where conditions with AND', () => {
            const query = SQL.delete()
                .from(SQL.table(table))
                .where(SQL.column('groupA'), 'x')
                .where(SQL.column('groupB'), 3);

            doesQueryMatch(query.getSQL(), {
                query: 'DELETE FROM `sql_delete_test` WHERE `sql_delete_test`.`groupA` = ? AND `sql_delete_test`.`groupB` = ?',
                params: ['x', 3],
            });
        });

        it('names the target table when joining (multi-table delete)', () => {
            const query = SQL.delete()
                .from(SQL.table(table, 'd'))
                .join(
                    SQL.join(SQL.table(table, 'k'))
                        .where(SQL.column('k', 'groupA'), SQL.column('d', 'groupA'))
                        .where(SQL.column('k', 'id'), '<', SQL.column('d', 'id')),
                );

            doesQueryMatch(query.getSQL(), {
                query: 'DELETE `d` FROM `sql_delete_test` `d` JOIN `sql_delete_test` `k` ON `k`.`groupA` = `d`.`groupA` AND `k`.`id` < `d`.`id`',
                params: [],
            });
        });

        it('uses the plain table name as the target when the joined FROM has no alias', () => {
            const query = SQL.delete()
                .from(SQL.table(table))
                .join(
                    SQL.leftJoin(SQL.table('other', 'o'))
                        .where(SQL.column('o', 'refId'), SQL.column(table, 'id')),
                )
                .where(SQL.column('o', 'id'), null);

            doesQueryMatch(query.getSQL(), {
                query: 'DELETE `sql_delete_test` FROM `sql_delete_test` LEFT JOIN `other` `o` ON `o`.`refId` = `sql_delete_test`.`id` WHERE `o`.`id` IS NULL',
                params: [],
            });
        });

        it('current and parent namespace in joins', () => {
            const query = SQL.delete()
                .from(SQL.table(table))
                .join(
                    SQL.leftJoin(SQL.table('other', 'o'))
                        .where(SQL.column('refId'), SQL.parentColumn('id')),
                )
                .where(SQL.column('o', 'id'), null);

            doesQueryMatch(query.getSQL(), {
                query: 'DELETE `sql_delete_test` FROM `sql_delete_test` LEFT JOIN `other` `o` ON `o`.`refId` = `sql_delete_test`.`id` WHERE `o`.`id` IS NULL',
                params: [],
            });
        });

        it('current and parent namespace in joins without alias', () => {
            const query = SQL.delete()
                .from(SQL.table(table))
                .join(
                    SQL.leftJoin(SQL.table('other'))
                        .where(SQL.column('refId'), SQL.parentColumn('id')),
                )
                .where(SQL.column('other', 'id'), null);

            doesQueryMatch(query.getSQL(), {
                query: 'DELETE `sql_delete_test` FROM `sql_delete_test` LEFT JOIN `other` ON `other`.`refId` = `sql_delete_test`.`id` WHERE `other`.`id` IS NULL',
                params: [],
            });
        });
    });

    describe('execution', () => {
        beforeAll(async () => {
            await Database.statement('DROP TABLE IF EXISTS `' + table + '`');
            await Database.statement(
                'CREATE TABLE `' + table + '` ('
                + '`id` bigint unsigned NOT NULL AUTO_INCREMENT,'
                + '`groupA` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,'
                + '`groupB` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,'
                + 'PRIMARY KEY (`id`)'
                + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;',
            );
        });

        afterEach(async () => {
            await Database.delete('DELETE FROM `' + table + '`');
        });

        afterAll(async () => {
            await Database.statement('DROP TABLE IF EXISTS `' + table + '`');
        });

        const insert = async (groupA: string, groupB: string) => {
            await SQL.insert(table).columns('groupA', 'groupB').values([groupA, groupB]).insert();
        };

        const countRows = async () => {
            return (await SQL.select().from(SQL.table(table)).fetch()).length;
        };

        it('deletes only the matching rows and reports affectedRows', async () => {
            await insert('a', '1');
            await insert('b', '1');
            await insert('a', '2');

            const result = await SQL.delete()
                .from(SQL.table(table))
                .where(SQL.column('groupA'), 'a')
                .delete();

            expect(result.affectedRows).toBe(2);
            expect(await countRows()).toBe(1);
        });

        it('deletes every row when there is no where clause', async () => {
            await insert('a', '1');
            await insert('b', '2');

            await SQL.delete().from(SQL.table(table)).delete();

            expect(await countRows()).toBe(0);
        });

        it('returns affectedRows 0 without running a query when the where is always false', async () => {
            await insert('a', '1');

            const result = await SQL.delete()
                .from(SQL.table(table))
                .where(new SQLWhereOr([]))
                .delete();

            expect(result.affectedRows).toBe(0);
            expect(await countRows()).toBe(1);
        });

        it('deletes rows through a join (multi-table delete)', async () => {
            await insert('keep', 'x'); // id 1
            await insert('drop', 'x'); // id 2 - references id 1 via groupB

            // Delete rows that have another row with a smaller id and the same groupB.
            const result = await SQL.delete()
                .from(SQL.table(table, 'd'))
                .join(
                    SQL.join(SQL.table(table, 'k'))
                        .where(SQL.column('k', 'groupB'), SQL.column('d', 'groupB'))
                        .where(SQL.column('k', 'id'), '<', SQL.column('d', 'id')),
                )
                .delete();

            expect(result.affectedRows).toBe(1);
            const rows = await SQL.select().from(SQL.table(table)).fetch();
            expect(rows).toHaveLength(1);
            expect(rows[0][table].groupA).toBe('keep');
        });

        it('collapses any number of duplicates via a materialized derived-table join', async () => {
            // Regression: a plain self-join delete leaves duplicates for 3+ copies (and deletes nothing
            // for 4+), because MySQL refuses to delete a row that is also a join reference. Materializing
            // the affected groups into a derived table first makes the delete correct for any copy count.
            for (const copies of [2, 3, 4, 5]) {
                for (let i = 0; i < copies; i++) {
                    await insert('dup', 'same');
                }
                await insert('unique', 'other'); // must never be deleted

                const duplicateGroups = SQL.select(
                    SQL.column('groupA'),
                    SQL.column('groupB'),
                    new SQLSelectAs(new SQLMin(SQL.column('id')), new SQLAlias('keepId')),
                )
                    .from(SQL.table(table))
                    .groupBy(SQL.column('groupA'), SQL.column('groupB'))
                    .having(SQL.where(new SQLCount(), '>', 1));

                await SQL.delete()
                    .from(SQL.table(table, 'd'))
                    .join(
                        SQL.join(duplicateGroups.as('g'))
                            .where(SQL.column('g', 'groupA'), SQL.column('d', 'groupA'))
                            .where(SQL.column('g', 'groupB'), SQL.column('d', 'groupB'))
                            .where(SQL.column('d', 'id'), '>', SQL.column('g', 'keepId')),
                    )
                    .delete();

                // One 'dup' row survives + the untouched 'unique' row = 2 rows.
                expect(await countRows()).toBe(2);

                await Database.delete('DELETE FROM `' + table + '`');
            }
        });
    });
});
