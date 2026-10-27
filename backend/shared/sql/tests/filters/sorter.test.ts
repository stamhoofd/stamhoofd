import { SortItemDirection } from '@stamhoofd/filters/SortList';
import type { SQLSortDefinitions } from '../../src/filters/SQLSorter.js';
import { applySQLSorter } from '../../src/filters/SQLSorter.js';
import { SQL } from '../../src/SQL.js';
import { normalizeSQLQuery } from '../../src/SQLExpression.js';
import { SQLOrderBy } from '../../src/SQLOrderBy.js';

describe('SQL sorter registries', () => {
    it('applies permissions, ordering, joins and selected columns', async () => {
        const checkPermission = vi.fn(async () => {});
        const join = SQL.join(SQL.table('related')).where(SQL.column('related', 'id'), SQL.column('items', 'relatedId'));
        const definitions: SQLSortDefinitions<{ id: string }> = new Map([
            ['related.name', {
                getValue: object => object.id,
                toSQL: direction => new SQLOrderBy({ column: SQL.column('related', 'name'), direction }),
                join,
                select: [SQL.column('related', 'name')],
                checkPermission,
            }],
        ]);
        const query = SQL.select().from('items');
        await applySQLSorter(query, [{ key: 'related.name', order: SortItemDirection.DESC }], definitions);
        expect(checkPermission).toHaveBeenCalledOnce();
        expect(query._joins).toEqual([join]);
        expect(query._orderBy?.getSQL()).toEqual({ query: 'ORDER BY `related`.`name` DESC', params: [] });
        expect(normalizeSQLQuery(query.getSQL()).query).toContain('`related`.`name`');
    });

    it('rejects absent keys and empty sort lists', async () => {
        const definitions: SQLSortDefinitions = new Map();
        for (const key of ['missing', 'constructor', 'toString', '__proto__']) {
            await expect(applySQLSorter(SQL.select().from('items'), [{ key, order: SortItemDirection.ASC }], definitions))
                .rejects.toThrow('Unknown sort key ' + key);
        }
        await expect(applySQLSorter(SQL.select().from('items'), [], definitions)).rejects.toThrow('No sort passed');
    });

    it('accepts explicitly registered special names', async () => {
        const definitions: SQLSortDefinitions<string> = new Map([
            ['__proto__', {
                getValue: value => value,
                toSQL: direction => new SQLOrderBy({ column: SQL.column('items', 'id'), direction }),
            }],
        ]);
        const query = SQL.select().from('items');
        await applySQLSorter(query, [{ key: '__proto__', order: SortItemDirection.ASC }], definitions);
        expect(query._orderBy?.getSQL()).toEqual({ query: 'ORDER BY `items`.`id` ASC', params: [] });
    });
});
