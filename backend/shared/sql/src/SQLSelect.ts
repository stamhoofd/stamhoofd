import { Database, SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery, normalizeSQLQuery } from './SQLExpression';
import { SQLAlias, SQLColumnExpression, SQLCount, SQLSelectAs, SQLSum, SQLTableExpression } from './SQLExpressions';
import { SQLJoin } from './SQLJoin';
import { Orderable } from './SQLOrderBy';
import { Whereable } from './SQLWhere';

class EmptyClass {}

export function parseTable(tableOrExpressiongOrNamespace: SQLExpression | string, table?: string): SQLExpression {
    if (table !== undefined && typeof tableOrExpressiongOrNamespace === 'string') {
        return new SQLTableExpression(tableOrExpressiongOrNamespace, table);
    }
    else if (typeof tableOrExpressiongOrNamespace === 'string') {
        return new SQLTableExpression(tableOrExpressiongOrNamespace);
    }
    else {
        return tableOrExpressiongOrNamespace;
    }
}

export class SQLSelect<T = SQLResultNamespacedRow> extends Whereable(Orderable(EmptyClass)) implements SQLExpression {
    _columns: SQLExpression[];
    _from: SQLExpression;

    _limit: number | null = null;
    _offset: number | null = null;
    _groupBy: SQLExpression[] = [];
    _joins: (InstanceType<typeof SQLJoin>)[] = [];
    _max_execution_time: number | null = null;

    _transformer: ((row: SQLResultNamespacedRow) => T) | null = null;

    constructor(...columns: (SQLExpression | string)[]);
    constructor(transformer: ((row: SQLResultNamespacedRow) => T), ...columns: (SQLExpression | string)[]);
    constructor(...columns: (SQLExpression | string | ((row: SQLResultNamespacedRow) => T))[]) {
        super();

        if (typeof columns[0] === 'function') {
            this._transformer = columns.shift() as any;
        }
        this._columns = columns.map(c => typeof c === 'string' ? new SQLColumnExpression(c) : c) as any;
    }

    clone(): this {
        const c = new SQLSelect(...this._columns);
        Object.assign(c, this);
        return c as any;
    }

    from(namespace: string, table: string): this;
    from(table: string): this;
    from(expression: SQLExpression): this;
    from(tableOrExpressiongOrNamespace: SQLExpression | string, table?: string): this {
        this._from = parseTable(tableOrExpressiongOrNamespace, table);

        return this;
    }

    join(join: InstanceType<typeof SQLJoin>): this {
        this._joins.push(join);
        return this;
    }

    groupBy(...columns: SQLExpression[]): this {
        this._groupBy.push(...columns);
        return this;
    }

    setMaxExecutionTime(ms: number): this {
        this._max_execution_time = ms;
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        const query: SQLQuery[] = [
            'SELECT',
        ];

        if (this._max_execution_time !== null) {
            query.push('/*+ MAX_EXECUTION_TIME(' + this._max_execution_time + ') */');
        }

        options = options ?? {};
        options.defaultNamespace = (this._from as any).namespace ?? (this._from as any).table ?? undefined;

        const columns = this._columns.map(c => c.getSQL(options));
        query.push(
            joinSQLQuery(columns, ', '),
        );

        query.push(
            'FROM',
        );

        query.push(this._from.getSQL(options));

        query.push(...this._joins.map(j => j.getSQL(options)));

        if (this._where) {
            query.push('WHERE');
            query.push(this._where.getSQL(options));
        }

        if (this._groupBy.length > 0) {
            query.push('GROUP BY');
            query.push(
                joinSQLQuery(
                    this._groupBy.map(c => c.getSQL(options)),
                    ', ',
                ),
            );
        }

        if (this._orderBy) {
            query.push(this._orderBy.getSQL(options));
        }

        if (this._limit !== null) {
            query.push('LIMIT ' + this._limit);
            if (this._offset !== null && this._offset !== 0) {
                query.push('OFFSET ' + this._offset);
            }
        }

        return joinSQLQuery(query, ' ');
    }

    limit(limit: number | null, offset: number | null = null): this {
        this._limit = limit;
        this._offset = offset;
        return this;
    }

    async fetch(): Promise<T[]> {
        const { query, params } = normalizeSQLQuery(this.getSQL());

        // when debugging: log all queries
        // console.log(query, params);
        const [rows] = await Database.select(query, params, { nestTables: true });

        // Now map aggregated queries to the correct namespace
        for (const row of rows) {
            if (row['']) {
                for (const column in row['']) {
                    const splitted = column.split('__');
                    if (splitted.length <= 1) {
                        console.warn('Aggregated column without namespace', column);
                        continue;
                    }
                    const namespace = splitted[0];
                    const name = splitted[1];
                    row[namespace] = row[namespace] ?? {};
                    row[namespace][name] = row[''][column];
                }
                delete row[''];
            }
        }

        if (this._transformer) {
            return rows.map(this._transformer);
        }
        return rows as T[];
    }

    first(required: false): Promise<T | null>;
    first(required: true): Promise<T>;
    async first(required = true): Promise<T | null> {
        const rows = await this.limit(1).fetch();
        if (rows.length === 0) {
            if (required) {
                throw new Error('Required ' + this._from);
            }
            return null;
        }

        return rows[0];
    }

    async count(): Promise<number> {
        this._columns = [
            new SQLSelectAs(
                new SQLCount(),
                new SQLAlias('c'),
            ),
        ];
        this._offset = null;
        this._limit = null;
        this._orderBy = null;

        const { query, params } = normalizeSQLQuery(this.getSQL());
        // console.log(query, params);

        const [rows] = await Database.select(query, params, { nestTables: true });
        if (rows.length === 1) {
            const row = rows[0];
            if ('' in row) {
                const namespaced = row[''];
                if ('c' in namespaced) {
                    const value = namespaced['c'];
                    if (typeof value === 'number' && Number.isInteger(value)) {
                        return value;
                    }
                }
            }
        }
        console.warn('Invalid count SQL response', rows);
        return 0;
    }

    async sum(expression: SQLExpression): Promise<number> {
        this._columns = [
            new SQLSelectAs(
                new SQLSum(expression),
                new SQLAlias('c'),
            ),
        ];
        this._offset = null;
        this._limit = null;
        this._orderBy = null;

        const { query, params } = normalizeSQLQuery(this.getSQL());
        console.log(query, params);

        const [rows] = await Database.select(query, params, { nestTables: true });
        if (rows.length === 1) {
            const row = rows[0];
            if ('' in row) {
                const namespaced = row[''];
                if ('c' in namespaced) {
                    const value = namespaced['c'];
                    if (typeof value === 'number' && Number.isInteger(value)) {
                        return value;
                    }
                }
            }
        }
        console.warn('Invalid sum SQL response', rows);
        return 0;
    }
}
