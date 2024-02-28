import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery, normalizeSQLQuery } from "./SQLExpression";
import { SQLOrderBy, addOrderByHelpers } from "./SQLOrderBy";
import { SQLWhere, addWhereHelpers } from "./SQLWhere";
import {Database, SQLResultNamespacedRow} from "@simonbackx/simple-database"
import {SQLJoin} from './SQLJoin'

class SelectBase implements SQLExpression {
    #columns: SQLExpression[]
    #from: SQLExpression;

    #limit: number|null = null;
    #offset: number|null = null;

    _where: SQLWhere|null = null;
    _orderBy: SQLOrderBy|null = null;
    _joins: (InstanceType<typeof SQLJoin>)[] = [];

    constructor(...columns: SQLExpression[]) {
        this.#columns = columns;
    }

    from(table: SQLExpression) {
        this.#from = table;
        return this;
    }

    join(join: InstanceType<typeof SQLJoin>) {
        this._joins.push(join);
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        const query: SQLQuery[] = [
            'SELECT'
        ]

        options = options ?? {}
        options.defaultNamespace = (this.#from as any).namespace ?? (this.#from as any).table ?? undefined;

        const columns = this.#columns.map(c => c.getSQL(options))
        query.push(
            joinSQLQuery(columns, ', ')
        )

        query.push(
            'FROM' 
        )

        query.push(this.#from.getSQL(options));

        query.push(...this._joins.map(j => j.getSQL(options)))

        if (this._where) {
            query.push('WHERE')
            query.push(this._where.getSQL(options))
        }

        if (this._orderBy) {
            query.push(this._orderBy.getSQL(options))
        }


        if (this.#limit !== null) {
            query.push('LIMIT ' + this.#limit)
            if (this.#offset !== null && this.#offset !== 0) {
                query.push('OFFSET ' + this.#offset)
            }
        }
        
        return joinSQLQuery(query, ' ');
    }

    limit(limit: number|null, offset: number|null = null) {
        this.#limit = limit;
        this.#offset = offset;
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
                throw new Error('Required ' + this.#from)
            }
            return null;
        }
        return rows[0]
    }
}

export const SQLSelect = addOrderByHelpers(
    addWhereHelpers(SelectBase)
)

