import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery } from "./SQLExpression";

type GConstructor<T = {}> = new (...args: any[]) => T;
type Orderable = GConstructor<{ _orderBy: SQLOrderBy|null }>;

export function addOrderByHelpers<TBase extends Orderable>(Base: TBase) {
    return class extends Base {
        
        orderBy(orderBy: SQLOrderBy)
        orderBy(column: SQLExpression, direction?: SQLOrderByDirection) 
        orderBy(columnOrOrderBy: SQLExpression, direction?: SQLOrderByDirection) {
            let o = columnOrOrderBy as SQLOrderBy
            if (!(columnOrOrderBy instanceof SQLOrderBy)) {
                o = new SQLOrderBy({column: columnOrOrderBy, direction: direction ?? 'ASC'})
            }

            if (this._orderBy) {
                this._orderBy.add(o)
            } else {
                this._orderBy = o;
            }

            return this;
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