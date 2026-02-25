import { Database, SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { PlainObject } from '@simonbackx/simple-encoding';
import { StamhoofdFilter } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { compileToSQLFilter, SQLFilterDefinitions } from '../../src/filters/SQLFilter.js';
import { SQL } from '../../src/SQL.js';
import { NormalizedSQLQuery, SQLQuery } from '../../src/SQLExpression.js';
import { SQLScalarValue } from '../../src/SQLExpressions.js';
import { SQLWhereAnd } from '../../src/SQLWhere.js';

export async function testError({ filter, filters, error }: { filter: StamhoofdFilter; filters: SQLFilterDefinitions; error: string }) {
    await expect(
        compileToSQLFilter(filter, filters),
    ).rejects.toThrow(error);
}

/**
 * Only compares the WHERE clause of the query.
 */
export async function test({ filter, filters, query }: { filter: StamhoofdFilter; filters: SQLFilterDefinitions; query: SQLQuery }) {
    const where = await compileToSQLFilter(filter, filters);
    if (where.isAlways === false) {
        doesQueryMatch('', query);
        return;
    }

    if (where.isAlways === true) {
        doesQueryMatch('true', query);
        return;
    }

    const sql = where.getSQL({
        defaultNamespace: 'default',
        parentNamespace: 'parent',
    });
    doesQueryMatch(sql, query);
}

/**
 * Use to also test joins. This will use `test_table` as the table name in your query.
 */
export async function testSelect({ filter, filters, query }: { filter: StamhoofdFilter; filters: SQLFilterDefinitions; query: SQLQuery }) {
    const where = await compileToSQLFilter(filter, filters);

    if (where.isAlways === false) {
        doesQueryMatch('', query);
        return;
    }

    const select = SQL.select().from('test_table').where(where);

    let sql: SQLQuery;
    try {
        sql = select.getSQL();
    }
    catch (e) {
        console.error('Error in testSelect:', e);
        console.error('testSelect', select, where, (where instanceof SQLWhereAnd ? where.children : where));

        throw e;
    }
    doesQueryMatch(sql, query);
}

export async function testMultiple({ testFilters, filters, query }: { testFilters: StamhoofdFilter[]; filters: SQLFilterDefinitions; query: SQLQuery }) {
    for (const filter of testFilters) {
        await test({
            filter,
            filters,
            query,
        });
    }
}

export async function testMultipleErrors({ testFilters, filters, error }: { testFilters: StamhoofdFilter[]; filters: SQLFilterDefinitions; error: string }) {
    for (const filter of testFilters) {
        await testError({
            filter,
            filters,
            error,
        });
    }
}

export function doesQueryMatch(query: SQLQuery, withQuery: SQLQuery) {
    const str1 = typeof query === 'string' ? query : query.query;
    const str2 = typeof withQuery === 'string' ? withQuery : withQuery.query;

    const params1 = typeof query === 'string' ? [] : query.params;
    const params2 = typeof withQuery === 'string' ? [] : withQuery.params;

    expect(str1).toBe(str2);
    expect(params1).toEqual(params2);
}

export type TableDefinition = Record<string, { type: 'varchar' | 'test' | 'json' | 'datetime' | 'int' | 'int unsigned'; nullable?: boolean }>;

export function createTableDefinition(tableName: string, definition: TableDefinition): string {
    const columns = Object.entries(definition).map(([name, { type, nullable }]) => {
        const stringType = type === 'varchar' ? 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci' : type;
        return `\`${name}\` ${stringType}${nullable ? '' : ' NOT NULL'}`;
    }).join(',\n');
    return `CREATE TABLE \`${tableName}\` (\n${columns}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`;
}

let didAdd = false;
function closeDatabaseAfterTests() {
    if (didAdd) {
        return;
    }
    didAdd = true;

    TestUtils.addAfterAll(async () => {
        try {
            await Database.end();
        }
        catch (error) {
            console.error('Failed to close database connection after tests:', error);
        }
    });
}

/**
 * Tests actual MySQL behaviour, for complex queries that depend on MySQL behaviour.
 *
 * Creates a table, inserts a row with provided data. Then runs a query with the provided filter and checks if the row matches the expected query.
 *
 * Snapshots the query.
 */
export async function testMatch({ tableDefinition, rows, doMatch, doNotMatch, filters }: { doMatch?: StamhoofdFilter[]; doNotMatch?: StamhoofdFilter[]; tableDefinition: TableDefinition; rows: Record<string, SQLScalarValue | null | PlainObject>[]; filters: SQLFilterDefinitions }) {
    const tableName = 'test_table_' + Math.random().toString(36).substring(2, 15);
    const createTableSQL = createTableDefinition(tableName, tableDefinition);

    closeDatabaseAfterTests();

    try {
        await Database.statement(createTableSQL);
    }
    catch (error) {
        console.error('Failed to create test table:', error);
        throw error;
    }

    // Insert test rows
    for (const row of rows) {
        const mappedValues = {};
        for (const [key, value] of Object.entries(row)) {
            if (value === null) {
                mappedValues[key] = null;
            }
            else if (typeof value === 'object' && !(value instanceof Date)) {
                mappedValues[key] = JSON.stringify(value);
            }
            else {
                mappedValues[key] = value;
            }
        }

        try {
            await Database.insert('INSERT INTO `' + tableName + '` SET ?', [mappedValues]);
        }
        catch (insertError) {
            console.error('Failed to insert row:', insertError, row);
            throw insertError;
        }
    }

    // Run queries
    try {
        for (const filter of doMatch ?? []) {
            const where = await compileToSQLFilter(filter, filters);
            const select = SQL.select().from(tableName).where(where);

            let results: SQLResultNamespacedRow[];
            try {
                results = await select.fetch();
            }
            catch (e) {
                console.error('SQL error for filter:', filter, 'on table:', tableName, 'with where:', select.getSQL(), e);
                throw e;
            }
            if (results.length !== rows.length) {
                console.error('Unexpected results for filter:', filter, 'on table:', tableName, 'with where:', select.getSQL(), results);
            }
            expect(results).toHaveLength(rows.length);
            const query = select.getSQL() as NormalizedSQLQuery;
            expect({
                query: query.query.replaceAll('`' + tableName + '`', '`test_table`'),
                params: query.params,
            }).toMatchSnapshot('SQL Query for filter: ' + JSON.stringify(filter));
        }

        for (const filter of doNotMatch ?? []) {
            const where = await compileToSQLFilter(filter, filters);
            const select = SQL.select().from(tableName).where(where);

            let results: SQLResultNamespacedRow[];
            try {
                results = await select.fetch();
            }
            catch (e) {
                console.error('SQL error for filter:', filter, 'on table:', tableName, 'with where:', select.getSQL(), e);
                throw e;
            }
            if (results.length > 0) {
                console.error('Unexpected results for filter:', filter, 'on table:', tableName, 'with where:', select.getSQL(), results);
            }
            expect(results).toHaveLength(0);

            if (!select._where || !select._where.isAlwaysFalse) {
                const query = select.getSQL() as NormalizedSQLQuery;
                expect({
                    query: query.query.replaceAll('`' + tableName + '`', '`test_table`'),
                    params: query.params,
                }).toMatchSnapshot('SQL Query for not match filter: ' + JSON.stringify(filter));
            }
            else {
                expect('always false').toMatchSnapshot('SQL Query for not match filter: ' + JSON.stringify(filter));
            }
        }
    }
    finally {
        try {
            await Database.statement(`DROP TABLE IF EXISTS \`${tableName}\``);
        }
        catch (dropError) {
            console.error('Failed to drop table after error:', dropError);
        }
    }
}
