import { Database, SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { Formatter } from '@stamhoofd/utility';
import { SQLExpression, SQLExpressionOptions, SQLNamedExpression, SQLQuery, joinSQLQuery, normalizeSQLQuery } from './SQLExpression.js';
import { SQLAlias, SQLColumnExpression, SQLCount, SQLSelectAs, SQLSum, SQLTableExpression } from './SQLExpressions.js';
import { SQLJoin } from './SQLJoin.js';
import { SQLLogger } from './SQLLogger.js';
import { Orderable } from './SQLOrderBy.js';
import { SQLWhere, Whereable } from './SQLWhere.js';

class EmptyClass {}

export function parseTable(tableOrExpression: SQLNamedExpression | string, asNamespace?: string): SQLNamedExpression {
    if (typeof tableOrExpression === 'string') {
        return new SQLTableExpression(tableOrExpression, asNamespace);
    }
    else {
        return tableOrExpression;
    }
}

export type IterableSQLSelect<T extends object = SQLResultNamespacedRow> = AsyncIterableIterator<T, undefined> & {
    isDone: boolean;
    options: IterableSQLSelectOptions;
    maxQueries(maxQueries: number): IterableSQLSelect<T>;
};
export type IterableSQLSelectOptions = {
    /**
     * The loop will cancel after this amount of queries - but you can continue to loop over the results when starting a new for loop.
     */
    maxQueries?: number;
};

export type SQLNamedSelect<T extends object = SQLResultNamespacedRow> = SQLSelect<T> & { getName(): string };

export class SQLSelect<T extends object = SQLResultNamespacedRow> extends Whereable(Orderable(EmptyClass)) implements SQLExpression {
    _columns: SQLExpression[];
    _from: SQLNamedExpression;

    _limit: number | null = null;
    _offset: number | null = null;
    _groupBy: SQLExpression[] = [];
    _joins: (InstanceType<typeof SQLJoin>)[] = [];
    _max_execution_time: number | null = null;
    private _name: string | null = null;
    static slowQueryThresholdMs: number | null = null;
    _having: SQLWhere | null = null;

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
        this._where = this._where ? this._where.clone() : null;
        return c as any;
    }

    from(table: string, namespace: string): this;
    from(table: string): this;
    from(expression: SQLNamedExpression): this;
    from(tableOrExpression: SQLNamedExpression | string, namespace?: string): this {
        this._from = parseTable(tableOrExpression, namespace);

        return this;
    }

    select(...columns: (SQLExpression | string)[]): this {
        this._columns.push(...columns.map(c => typeof c === 'string' ? new SQLColumnExpression(c) : c));
        return this;
    }

    join(join: InstanceType<typeof SQLJoin>): this {
        // prevent duplicate joins (reference of join should be the same)
        if (!this._joins.includes(join)) {
            this._joins.push(join);
        }

        return this;
    }

    groupBy(...columns: SQLExpression[]): this {
        this._groupBy.push(...columns);
        return this;
    }

    having(where: SQLWhere): this {
        if (this._having) {
            this._having = this._having.and(where);
        }
        else {
            this._having = where;
        }

        return this;
    }

    setMaxExecutionTime(ms: number): this {
        this._max_execution_time = ms;
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (!this._from) {
            throw new Error('Forgot to define .from(...) for SQLSelect');
        }

        const query: SQLQuery[] = [
            'SELECT',
        ];

        if (this._max_execution_time !== null) {
            query.push('/*+ MAX_EXECUTION_TIME(' + this._max_execution_time + ') */');
        }

        // Create a clone since we are mutating the default namespaces
        const parentOptions = options;
        options = options ? { ...options } : {};
        options.defaultNamespace = this._from.getName();

        if (parentOptions?.defaultNamespace) {
            options.parentNamespace = parentOptions.defaultNamespace;
        }

        const columns = this._columns.map(c => c.getSQL(options));
        query.push(
            joinSQLQuery(columns, ', '),
        );

        query.push(
            'FROM',
        );

        query.push(this._from.getSQL(options));

        // Joins
        query.push(...this._joins.map(j => j.getSQL(options)));
        if (this._where) {
            const whereJoins = Formatter.uniqueArray(this._where.getJoins()).filter(j => !this._joins.includes(j));
            query.push(...whereJoins.map(j => j.getSQL(options)));
        }

        // Where
        if (this._where) {
            const always = this._where.isAlways;
            if (always === false) {
                throw new Error('Cannot use SQLSelect with a where that is not always true');
            }
            else if (always === null) {
                query.push('WHERE');
                query.push(this._where.getSQL(options));
            }
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

        if (this._having) {
            const always = this._having.isAlways;
            if (always === false) {
                throw new Error('Cannot use SQLSelect with a having that is not always true');
            }
            else if (always === null) {
                query.push('HAVING');
                query.push(this._having.getSQL(options));
            }
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

    /**
     * Returns true when it know all results will be included without filtering.
     * Returns false when it knows no single result will be included.
     * Null when it does not know.
     */
    get isAlways() {
        return this._where ? this._where.isAlways : true;
    }

    limit(limit: number | null, offset: number | null = null): this {
        this._limit = limit;
        this._offset = offset;
        return this;
    }

    async fetch(): Promise<T[]> {
        if (this._where && this._where.isAlways === false) {
            return [];
        }

        const { query, params } = normalizeSQLQuery(this.getSQL());

        // when debugging: log all queries
        // console.log(query, params);
        let rows: SQLResultNamespacedRow[];
        try {
            const [_rows] = await SQLLogger.log(Database.select(query, params, { nestTables: true }), query, params);
            rows = _rows;
        }
        catch (e) {
            console.error('Error executing SQL query', query, params, e);
            throw e;
        }

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
                throw new Error('Expected at least one result at ' + this._from.getName());
            }
            return null;
        }

        return rows[0];
    }

    async count(expression?: SQLExpression): Promise<number> {
        if (this._where && this._where.isAlways === false) {
            return 0;
        }

        this._columns = [
            new SQLSelectAs(
                new SQLCount(expression ?? null),
                new SQLAlias('c'),
            ),
        ];
        this._offset = null;
        this._limit = null;
        this._orderBy = null;

        const { query, params } = normalizeSQLQuery(this.getSQL());

        const [rows] = await SQLLogger.log(Database.select(query, params, { nestTables: true }), query, params);
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
        if (this._where && this._where.isAlways === false) {
            return 0;
        }

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
        // console.log(query, params);

        const [rows] = await SQLLogger.log(Database.select(query, params, { nestTables: true }), query, params);
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

    all(options: IterableSQLSelectOptions = {}): T extends { id: string } ? IterableSQLSelect<T> : never {
        if (this._orderBy) {
            throw new Error('Cannot use async iterator with custom order by. Results should be ordered by ID');
        }

        if (this._offset !== null) {
            throw new Error('Cannot use async iterator with offset');
        }

        if (!this._limit) {
            this._limit = 100;
        }

        const limit = this._limit;
        this.orderBy('id');

        let next: this | null = this.clone();
        const base = this;

        let stack: T[] = [];
        let stackIndex = 0;

        return {
            queryCount: 0,
            options,
            [Symbol.asyncIterator]() {
                return {
                    ...this,

                    // Reset the iterator
                    queryCount: 0,
                };
            },
            get isDone() {
                return !next && (stackIndex + 1) >= stack.length;
            },
            async next(): Promise<IteratorResult<T, undefined>> {
                stackIndex++;

                if (stackIndex < stack.length) {
                    return {
                        done: false,
                        value: stack[stackIndex],
                    };
                }

                if (!next) {
                    stack = []; // Clean up memory
                    return {
                        done: true,
                        value: undefined,
                    };
                }

                if (this.options.maxQueries !== undefined && this.queryCount >= this.options.maxQueries) {
                    // Stopping early
                    return {
                        done: true,
                        value: undefined,
                    };
                }

                stack = await next.fetch();
                next = null;
                this.queryCount += 1;

                if (stack.length === 0) {
                    return {
                        done: true,
                        value: undefined,
                    };
                }
                stackIndex = 0;

                if (stack.length >= limit) {
                    next = base.clone();
                    const lastResult = stack[stack.length - 1]!;
                    if (!('id' in lastResult)) {
                        throw new Error('Cannot use async iterator without ID column');
                    }

                    const lastId = lastResult.id;
                    if (typeof lastId !== 'string') {
                        throw new Error('Cannot use async iterator without string ID column');
                    }

                    next.andWhere('id', '>', lastId);
                }

                return {
                    done: false,
                    value: stack[stackIndex],
                };
            },
            maxQueries(maxQueries: number) {
                this.options.maxQueries = maxQueries;
                return this;
            },
        } as IterableSQLSelect<T> as any;
    }

    allBatched(options: IterableSQLSelectOptions = {}): T extends { id: string } ? IterableSQLSelect<T[]> : never {
        if (this._orderBy) {
            throw new Error('Cannot use async iterator with custom order by. Results should be ordered by ID');
        }

        if (this._offset !== null) {
            throw new Error('Cannot use async iterator with offset');
        }

        if (!this._limit) {
            this._limit = 100;
        }

        const limit = this._limit;
        this.orderBy('id');

        let next: this | null = this.clone();
        const base = this;

        return {
            queryCount: 0,
            options,
            [Symbol.asyncIterator]() {
                return {
                    ...this,

                    // Reset the iterator
                    queryCount: 0,
                };
            },
            get isDone() {
                return !next;
            },
            async next(): Promise<IteratorResult<T[], undefined>> {
                if (!next) {
                    return {
                        done: true,
                        value: undefined,
                    };
                }

                if (this.options.maxQueries !== undefined && this.queryCount >= this.options.maxQueries) {
                    // Stopping early
                    return {
                        done: true,
                        value: undefined,
                    };
                }

                const stack = await next.fetch();
                next = null;
                this.queryCount += 1;

                if (stack.length === 0) {
                    return {
                        done: true,
                        value: undefined,
                    };
                }

                if (stack.length >= limit) {
                    next = base.clone();
                    const lastResult = stack[stack.length - 1]!;
                    if (!('id' in lastResult)) {
                        throw new Error('Cannot use async iterator without ID column');
                    }

                    const lastId = lastResult.id;
                    if (typeof lastId !== 'string') {
                        throw new Error('Cannot use async iterator without string ID column');
                    }

                    next.andWhere('id', '>', lastId);
                }

                return {
                    done: false,
                    value: stack,
                };
            },
            maxQueries(maxQueries: number) {
                this.options.maxQueries = maxQueries;
                return this;
            },
        } as IterableSQLSelect<T[]> as any;
    }

    getName(): string | null {
        return this._name;
    }

    /**
     * By calling this method we make sure a name is set so we can return an SQLNamedSelect.
     * @param name name of the select
     * @returns an SQLNamedSelect
     */
    as(name: string): SQLNamedSelect {
        this._name = name;

        return this as SQLNamedSelect;
    }
}
