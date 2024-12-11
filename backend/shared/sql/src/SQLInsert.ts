import { Database } from '@simonbackx/simple-database';
import { isSQLExpression, joinSQLQuery, normalizeSQLQuery, SQLExpression, SQLExpressionOptions, SQLQuery } from './SQLExpression';
import { scalarToSQLExpression, SQLAlias, SQLAssignment, SQLColumnExpression, SQLScalarValue, SQLTableExpression } from './SQLExpressions';

export class SQLInsert implements SQLExpression {
    _columns: SQLExpression[] = [];
    _values: SQLExpression[][] = [];
    _as: SQLAlias | null = null;
    _into: SQLTableExpression;
    _onDuplicateKeyUpdate: SQLAssignment[] | null = null;

    constructor(tableName: SQLTableExpression | string) {
        this._into = typeof tableName === 'string' ? new SQLTableExpression(tableName) : tableName;
    }

    clone(): this {
        const c = new SQLInsert(this._into);
        Object.assign(c, this);
        return c as any;
    }

    columns(...columns: (SQLExpression | string)[]): this {
        this._columns = columns.map(c => typeof c === 'string' ? new SQLColumnExpression(c) : c) as any;
        return this;
    }

    values(...values: (SQLExpression | SQLScalarValue | null)[][]): this {
        this._values = values.map((v) => {
            if (v.length !== this._columns.length) {
                throw new Error('Invalid number of values. Expected ' + this._columns.length + ' but got ' + v.length);
            }

            return v.map(c => isSQLExpression(c) ? c : scalarToSQLExpression(c));
        });

        return this;
    }

    as(alias: string): this {
        this._as = new SQLAlias(alias);
        return this;
    }

    onDuplicateKeyUpdate(...assignments: SQLAssignment[]): this {
        this._onDuplicateKeyUpdate = assignments;
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        options = options ?? {};
        options.defaultNamespace = (this._into as any).namespace ?? (this._into).table ?? undefined;

        const query: SQLQuery[] = [
            'INSERT INTO',
            this._into.getSQL(options),
        ];

        const columns = this._columns.map(c => c.getSQL(options));
        query.push(
            joinSQLQuery([
                '(',
                joinSQLQuery(columns, ', '),
                ')',
            ]),
        );

        query.push(
            'VALUES',
        );

        query.push(
            joinSQLQuery(
                this._values.map(values =>
                    joinSQLQuery([
                        '(',
                        joinSQLQuery(values.map(v => v.getSQL(options)), ', '),
                        ')',
                    ]),
                ),
                ', ',
            ),
        );

        if (this._as !== null) {
            query.push(
                'AS',
                this._as.getSQL(options),
            );
        }

        if (this._onDuplicateKeyUpdate !== null) {
            query.push('ON DUPLICATE KEY UPDATE');
            query.push(
                joinSQLQuery(this._onDuplicateKeyUpdate.map(a => a.getSQL(options)), ', '),
            );
        }

        return joinSQLQuery(query, ' ');
    }

    async insert(): Promise<{ insertId: any;affectedRows: number }> {
        const { query, params } = normalizeSQLQuery(this.getSQL());
        console.log(query, params);
        const result = await Database.insert(query, params);
        return result[0];
    }
}
