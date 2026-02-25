import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery } from './SQLExpression.js';
import { SQLColumnExpression } from './SQLExpressions.js';

type Constructor<T = object> = new (...args: any[]) => T;

export function Orderable<Sup extends Constructor<object>>(Base: Sup) {
    return class extends Base {
        _orderBy: SQLOrderBy | null = null;

        orderBy<T>(this: T, orderBy: SQLOrderBy): T;
        orderBy<T>(this: T, column: SQLExpression | string, direction?: SQLOrderByDirection): T;
        orderBy<T>(this: T, columnOrOrderBy: SQLExpression | string, direction?: SQLOrderByDirection): T {
            let o = columnOrOrderBy as SQLOrderBy;
            if (!(columnOrOrderBy instanceof SQLOrderBy)) {
                o = new SQLOrderBy({
                    column: typeof columnOrOrderBy === 'string' ? new SQLColumnExpression(columnOrOrderBy) : columnOrOrderBy,
                    direction: direction ?? 'ASC',
                });
            }

            const me = this as any; // stupid typescript looses type information if we don't do the this: T dance

            if (me._orderBy) {
                me._orderBy.add(o);
            }
            else {
                me._orderBy = o;
            }

            return me;
        }
    };
}

export type SQLOrderByDirection = 'ASC' | 'DESC';
export class SQLOrderBy implements SQLExpression {
    orderBy: { column: SQLExpression; direction: SQLOrderByDirection }[] = [];

    constructor(...orderBy: { column: SQLExpression; direction: SQLOrderByDirection }[]) {
        this.orderBy = orderBy;
    }

    static combine(orderBy: SQLOrderBy[]) {
        return new SQLOrderBy(...orderBy.flatMap(o => o.orderBy));
    }

    add(orderBy: SQLOrderBy) {
        this.orderBy.push(...orderBy.orderBy);
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (this.orderBy.length === 0) {
            return '';
        }

        return joinSQLQuery([
            'ORDER BY ',
            joinSQLQuery(
                this.orderBy.map((o) => {
                    return joinSQLQuery([
                        o.column.getSQL(options),
                        o.direction,
                    ], ' ');
                }),
                ', ',
            ),
        ]);
    }
}
