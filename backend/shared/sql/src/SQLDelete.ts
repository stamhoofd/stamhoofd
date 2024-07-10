import { Database } from "@simonbackx/simple-database";
import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery, normalizeSQLQuery } from "./SQLExpression";
import { SQLJoin } from './SQLJoin';
import { SQLWhere, addWhereHelpers } from "./SQLWhere";

class DeleteBase implements SQLExpression {
    _from: SQLExpression;
    _where: SQLWhere|null = null;
    _joins: (InstanceType<typeof SQLJoin>)[] = [];

    constructor() {
    }

    clone(): this {
        const c = new SQLDelete()
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
            'DELETE'
        ]

        options = options ?? {}
        options.defaultNamespace = (this._from as any).namespace ?? (this._from as any).table ?? undefined;

        query.push(
            'FROM' 
        )

        query.push(this._from.getSQL(options));

        query.push(...this._joins.map(j => j.getSQL(options)))

        if (this._where) {
            query.push('WHERE')
            query.push(this._where.getSQL(options))
        }

        return joinSQLQuery(query, ' ');
    }

    async delete(): Promise<{affectedRows: number}> {
        const {query, params} = normalizeSQLQuery(this.getSQL())

        console.log(query, params);
        const [rows] = await Database.delete(query, params);
        return rows;
    }

    async then(onFulfilled: (value: {affectedRows: number}) => any, onRejected: (reason: any) => any): Promise<any> {
        return this.delete().then(onFulfilled, onRejected);
    }
}

export const SQLDelete = addWhereHelpers(DeleteBase)
