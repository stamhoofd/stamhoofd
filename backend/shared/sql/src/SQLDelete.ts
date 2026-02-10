import { Database } from '@simonbackx/simple-database';
import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery, normalizeSQLQuery } from './SQLExpression.js';
import { SQLJoin } from './SQLJoin.js';
import { SQLLogger } from './SQLLogger.js';
import { Whereable } from './SQLWhere.js';

class EmptyClass {}
export class SQLDelete extends Whereable(EmptyClass) implements SQLExpression {
    _from: SQLExpression;
    _joins: (InstanceType<typeof SQLJoin>)[] = [];

    clone(): this {
        const c = new SQLDelete();
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
            'DELETE',
        ];

        options = options ?? {};
        options.defaultNamespace = (this._from as any).namespace ?? (this._from as any).table ?? undefined;

        query.push(
            'FROM',
        );

        query.push(this._from.getSQL(options));

        query.push(...this._joins.map(j => j.getSQL(options)));

        // Where
        if (this._where) {
            const always = this._where.isAlways;
            if (always === false) {
                throw new Error('Cannot use SQLDelete with a where that is not always true');
            }
            else if (always === null) {
                query.push('WHERE');
                query.push(this._where.getSQL(options));
            }
        }

        return joinSQLQuery(query, ' ');
    }

    async delete(): Promise<{ affectedRows: number }> {
        if (this._where && this._where.isAlways === false) {
            return { affectedRows: 0 };
        }

        const { query, params } = normalizeSQLQuery(this.getSQL());

        const [rows] = await SQLLogger.log(Database.delete(query, params), query, params);
        return rows;
    }

    async then(onFulfilled: (value: { affectedRows: number }) => any, onRejected: (reason: any) => any): Promise<any> {
        return this.delete().then(onFulfilled, onRejected);
    }
}
