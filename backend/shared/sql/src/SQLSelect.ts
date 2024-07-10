import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery, normalizeSQLQuery } from "./SQLExpression";
import { SQLOrderBy, addOrderByHelpers } from "./SQLOrderBy";
import { SQLWhere, addWhereHelpers } from "./SQLWhere";
import {Database, SQLResultNamespacedRow} from "@simonbackx/simple-database"
import {SQLJoin} from './SQLJoin'
import { SQLAlias, SQLCount, SQLSelectAs, SQLSum, SQLWildcardSelectExpression } from "./SQLExpressions";

class SelectBase implements SQLExpression {
    _columns: SQLExpression[]
    _from: SQLExpression;

    _limit: number|null = null;
    _offset: number|null = null;

    _where: SQLWhere|null = null;
    _orderBy: SQLOrderBy|null = null;
    _joins: (InstanceType<typeof SQLJoin>)[] = [];

    constructor(...columns: SQLExpression[]) {
        this._columns = columns;
    }

    clone(): this {
        const c = new SQLSelect(...this._columns)
        Object.assign(c, this);
        return c as any;
    }

    from(table: SQLExpression): this {
        this._from = table;
        return this;
    }

    join(join: InstanceType<typeof SQLJoin>): this {
        this._joins.push(join);
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        const query: SQLQuery[] = [
            'SELECT'
        ]

        options = options ?? {}
        options.defaultNamespace = (this._from as any).namespace ?? (this._from as any).table ?? undefined;

        const columns = this._columns.map(c => c.getSQL(options))
        query.push(
            joinSQLQuery(columns, ', ')
        )

        query.push(
            'FROM' 
        )

        query.push(this._from.getSQL(options));

        query.push(...this._joins.map(j => j.getSQL(options)))

        if (this._where) {
            query.push('WHERE')
            query.push(this._where.getSQL(options))
        }

        if (this._orderBy) {
            query.push(this._orderBy.getSQL(options))
        }


        if (this._limit !== null) {
            query.push('LIMIT ' + this._limit)
            if (this._offset !== null && this._offset !== 0) {
                query.push('OFFSET ' + this._offset)
            }
        }
        
        return joinSQLQuery(query, ' ');
    }

    limit(limit: number|null, offset: number|null = null): this {
        this._limit = limit;
        this._offset = offset;
        return this;
    }

    async fetch(): Promise<SQLResultNamespacedRow[]> {
        const {query, params} = normalizeSQLQuery(this.getSQL())

        console.log(query, params);
        const [rows] = await Database.select(query, params, {nestTables: true});

        // Now map aggregated queries to the correct namespace
        for (const row of rows) {
            if (row['']) {
                for (const column in row['']) {
                    const splitted = column.split('__');
                    if (splitted.length <= 1) {
                        console.warn('Aggregated column without namespace', column)
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
        return rows;
    }

    first(required: false): Promise<SQLResultNamespacedRow|null>
    first(required: true): Promise<SQLResultNamespacedRow>
    async first(required = true): Promise<SQLResultNamespacedRow|null>  {
        const rows = await this.limit(1).fetch();
        if (rows.length === 0) {
            if (required) {
                throw new Error('Required ' + this._from)
            }
            return null;
        }
        return rows[0]
    }

    async count(): Promise<number> {
        this._columns = [
            new SQLSelectAs(
                new SQLCount(), 
                new SQLAlias('c')
            )
        ]
        this._offset = null;
        this._limit = null;
        this._orderBy = null;

        const {query, params} = normalizeSQLQuery(this.getSQL());
        console.log(query, params);

        const [rows] = await Database.select(query, params, {nestTables: true});
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
                new SQLAlias('c')
            )
        ]
        this._offset = null;
        this._limit = null;
        this._orderBy = null;

        const {query, params} = normalizeSQLQuery(this.getSQL());
        console.log(query, params);

        const [rows] = await Database.select(query, params, {nestTables: true});
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

export const SQLSelect = addOrderByHelpers(
    addWhereHelpers(SelectBase)
)

