import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery } from "./SQLExpression";

type Constructor<T = {}> = new (...args: any[]) => T;

export function Orderable<Sup extends Constructor<{}>>(Base: Sup) {
    return class extends Base {
        _orderBy: SQLOrderBy|null = null

        orderBy<T>(this: T, orderBy: SQLOrderBy): T
        orderBy<T>(this: T, column: SQLExpression, direction?: SQLOrderByDirection) : T
        orderBy<T>(this: T, columnOrOrderBy: SQLExpression, direction?: SQLOrderByDirection): T {
            let o = columnOrOrderBy as SQLOrderBy
            if (!(columnOrOrderBy instanceof SQLOrderBy)) {
                o = new SQLOrderBy({column: columnOrOrderBy, direction: direction ?? 'ASC'})
            }

            const me = this as any; // stupid typescript looses type information if we don't do the this: T dance

            if (me._orderBy) {
                me._orderBy.add(o)
            } else {
                me._orderBy = o;
            }

            return me;
        }
    }
}


export type SQLOrderByDirection = 'ASC' | 'DESC';
export class SQLOrderBy implements SQLExpression {
    orderBy: {column: SQLExpression, direction: SQLOrderByDirection}[] = [];

    constructor(...orderBy: {column: SQLExpression, direction: SQLOrderByDirection}[]) {
        this.orderBy = orderBy
    }

    static combine(orderBy: SQLOrderBy[]) {
        return new SQLOrderBy(...orderBy.flatMap(o => o.orderBy))
    }

    add(orderBy: SQLOrderBy) {
        this.orderBy.push(...orderBy.orderBy)
    }

    getSQL(options?: SQLExpressionOptions | undefined): SQLQuery {
        if (this.orderBy.length === 0) {
            return '';
        }

        return joinSQLQuery([
            'ORDER BY ',
            joinSQLQuery(
                this.orderBy.map(o => {
                    return joinSQLQuery([
                        o.column.getSQL(options),
                        o.direction
                    ], ' ')
                }), 
                ', '
            )
        ])
    }
}
