import { Database } from '@simonbackx/simple-database';
import { joinSQLQuery, normalizeSQLQuery, SQLExpression, SQLExpressionOptions, SQLQuery } from './SQLExpression.js';
import { readDynamicSQLExpression, SQLAssignment, SQLColumnExpression, SQLDynamicExpression, SQLTableExpression } from './SQLExpressions.js';
import { Whereable } from './SQLWhere.js';
import { SQLLogger } from './SQLLogger.js';

class EmptyClass {}

export class SQLUpdate extends Whereable(EmptyClass) implements SQLExpression {
    _table: SQLTableExpression;
    _set: SQLAssignment[] | null = null;

    constructor(tableName: SQLTableExpression | string) {
        super();
        this._table = typeof tableName === 'string' ? new SQLTableExpression(tableName) : tableName;
    }

    clone(): this {
        const c = new SQLUpdate(this._table);
        Object.assign(c, this);
        return c as any;
    }

    set(whereOrColumn: SQLExpression | string, value: SQLDynamicExpression): this {
        if (!this._set) {
            this._set = [];
        }

        this._set.push(new SQLAssignment(typeof whereOrColumn === 'string' ? new SQLColumnExpression(whereOrColumn) : whereOrColumn, readDynamicSQLExpression(value)));
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (!this._set) {
            throw new Error('No assignments provided');
        }

        // Create a clone since we are mutating the default namespaces
        const parentOptions = options;
        options = options ? { ...options } : {};
        options.defaultNamespace = (this._table as any).namespace ?? (this._table).table ?? undefined;

        if (parentOptions?.defaultNamespace) {
            options.parentNamespace = parentOptions.defaultNamespace;
        }

        const query: SQLQuery[] = [
            'UPDATE ',
            this._table.getSQL(options),
        ];

        query.push(
            'SET',
        );

        query.push(
            joinSQLQuery(this._set.map(a => a.getSQL(options)), ', '),
        );

        if (this._where) {
            query.push('WHERE');
            query.push(this._where.getSQL(options));
        }

        return joinSQLQuery(query, ' ');
    }

    async update(): Promise<{ changedRows: number }> {
        const { query, params } = normalizeSQLQuery(this.getSQL());
        const result = await SQLLogger.log(Database.update(query, params), query, params);
        return result[0];
    }
}
