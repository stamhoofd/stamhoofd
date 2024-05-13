import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery, normalizeSQLQuery } from "./SQLExpression";
import { SQLArray, SQLDynamicExpression, SQLNull, readDynamicSQLExpression } from "./SQLExpressions";

type GConstructor<T = {}> = new (...args: any[]) => T;
type Whereable = GConstructor<{ _where: SQLWhere|null }>;

export type ParseWhereArguments = [
    where: SQLWhere
] | [
    whereOrColumn: SQLExpression, 
    sign: SQLWhereSign, 
    value: SQLDynamicExpression
] | [
    whereOrColumn: SQLExpression, 
    value: SQLDynamicExpression
]

export function addWhereHelpers<TBase extends Whereable>(Base: TBase) {
    return class extends Base {
        parseWhere(...[whereOrColumn, signOrValue, value]: ParseWhereArguments): SQLWhere {
            if (signOrValue === undefined) {
                return whereOrColumn as SQLWhere;
            }

            if (value !== undefined) {
                return new SQLWhereEqual(
                    whereOrColumn, 
                    signOrValue as SQLWhereSign, 
                    readDynamicSQLExpression(value)
                )
            }
            return new SQLWhereEqual(
                whereOrColumn, 
                SQLWhereSign.Equal,
                readDynamicSQLExpression(signOrValue)
            )
        }

        where<T>(this: T, ...args: ParseWhereArguments): T {
            const w = (this as any).parseWhere(...args);
            if (!(this as any)._where) {
                (this as any)._where = w;
                return this;
            }
            (this as any)._where = (this as any)._where.and(w);
            return this;
        }

        andWhere(...args: ParseWhereArguments) {
            return this.where(...args)
        }

        orWhere(...args: ParseWhereArguments) {
            const w = this.parseWhere(...args);
            if (!this._where) {
                this._where = w;
                return this;
            }
            this._where = this._where.or(w);
            return this;
        }

        whereNot(...args: ParseWhereArguments) {
            const w = new SQLWhereNot(this.parseWhere(...args));
            if (!this._where) {
                this._where = w;
                return this;
            }
            this._where = this._where.and(w);
            return this;
        }

        andWhereNot(...args: ParseWhereArguments) {
            return this.whereNot(...args)
        }

        orWhereNot(...args: ParseWhereArguments) {
             const w = new SQLWhereNot(this.parseWhere(...args));
            if (!this._where) {
                this._where = w;
                return this;
            }
            this._where = this._where.or(w);
            return this;
        }
    }
}

export abstract class SQLWhere implements SQLExpression {
    and(...where: SQLWhere[]): SQLWhere {
        return new SQLWhereAnd([this, ...where]);
    }

    or(...where: SQLWhere[]): SQLWhere {
        return new SQLWhereOr([this, ...where]);
    }

    get isSingle(): boolean {
        return false;
    }

    abstract getSQL(options?: SQLExpressionOptions): SQLQuery
}

export enum SQLWhereSign {
    Equal = '=',
    Greater = '>',
    Less = '<',
    NotEqual = '!='
}

export class SQLWhereEqual extends SQLWhere {
    column: SQLExpression;
    sign = SQLWhereSign.Equal
    value: SQLExpression;
    
    constructor (column: SQLExpression, sign: SQLWhereSign, value: SQLExpression)
    constructor (column: SQLExpression, value: SQLExpression)
    constructor (column: SQLExpression, signOrValue: SQLExpression | SQLWhereSign, value?: SQLExpression) {
        super()
        this.column = column;

        if (value !== undefined) {
            this.value = value;
            this.sign = signOrValue as SQLWhereSign;
        } else {
            this.value = signOrValue as SQLExpression;
        }
    }

    clone(): this {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const c = (new (this.constructor as any)(this.column, this.sign, this.value)) as this
        Object.assign(c, this);
        return c;
    }

    get isSingle(): boolean {
        return true;
    }

    inverted(): this {
        return this.clone().invert()
    }

    invert(): this {
        switch (this.sign) {
            case SQLWhereSign.Equal: this.sign = SQLWhereSign.NotEqual; break;
            case SQLWhereSign.NotEqual: this.sign = SQLWhereSign.Equal; break;
            case SQLWhereSign.Greater: this.sign = SQLWhereSign.Less; break;
            case SQLWhereSign.Less: this.sign = SQLWhereSign.Greater; break;
        }
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (this.value instanceof SQLArray) {
            if (this.sign !== SQLWhereSign.Equal && this.sign !== SQLWhereSign.NotEqual) {
                throw new Error('Unsupported sign for array: ' + this.sign);
            }

            return joinSQLQuery([
                this.column.getSQL(options),
                ` ${(this.sign === SQLWhereSign.NotEqual) ? 'NOT IN' : 'IN'} `,
                this.value.getSQL(options)
            ])
        }


        if (this.value instanceof SQLNull) {
            if (this.sign !== SQLWhereSign.Equal && this.sign !== SQLWhereSign.NotEqual) {
                throw new Error('Unsupported sign for NULL: ' + this.sign);
            }

            return joinSQLQuery([
                this.column.getSQL(options),
                ` IS ${(this.sign === SQLWhereSign.NotEqual) ? 'NOT ' : ''} `,
                this.value.getSQL(options)
            ])
        }

        return joinSQLQuery([
            this.column.getSQL(options),
            ` ${this.sign} `,
            this.value.getSQL(options)
        ])
    }
}

export class SQLWhereLike extends SQLWhere {
    column: SQLExpression;
    notLike = false;
    value: SQLExpression;
    
    constructor (column: SQLExpression, value: SQLExpression)  {
        super()
        this.column = column;
        this.value = value
    }

    static escape(str: string) {
        return str.replace(/([%_])/g, '\\$1')
    }

    clone(): this {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const c = (new (this.constructor as any)(this.column, this.value)) as this
        Object.assign(c, this);
        return c;
    }

    get isSingle(): boolean {
        return true;
    }

    inverted(): this {
        return this.clone().invert()
    }

    invert(): this {
        this.notLike = !this.notLike
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            this.column.getSQL(options),
            ` ${this.notLike ? 'NOT LIKE' : 'LIKE'} `,
            this.value.getSQL(options)
        ])
    }
}

export class SQLWhereExists extends SQLWhere {
    subquery: SQLExpression;
    notExists = false;
    
    constructor (subquery: SQLExpression)  {
        super()
        this.subquery = subquery;
    }

    clone(): this {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const c = (new (this.constructor as any)(this.subquery)) as this
        Object.assign(c, this);
        return c;
    }

    get isSingle(): boolean {
        return true;
    }

    inverted(): this {
        return this.clone().invert()
    }

    invert(): this {
        this.notExists = !this.notExists
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            `${this.notExists ? 'NOT EXISTS' : 'EXISTS'} (`,
            this.subquery.getSQL({...options}),
            `)`,
        ])
    }
}

export class SQLWhereAnd extends SQLWhere {
    children: SQLWhere[]

    constructor (children: SQLWhere[]) {
        super()
        this.children = children;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery(
            this.children.map(c => {
                if (c.isSingle) {
                    return c.getSQL(options)
                }
                return joinSQLQuery(['(', c.getSQL(options), ')'])
            }), 
            ' AND '
        )
    }
}

export class SQLWhereOr extends SQLWhere {
    children: SQLWhere[]

    constructor (children: SQLWhere[]) {
        super()
        this.children = children;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery(
            this.children.map(c => {
                if (c.isSingle) {
                    return c.getSQL(options)
                }
                return joinSQLQuery(['(', c.getSQL(options), ')'])
            }), 
            ' OR '
        )
    }
}

export class SQLWhereNot extends SQLWhere {
    a: SQLWhere

    constructor (a: SQLWhere) {
        super()
        this.a = a;
    }

    get isSingle(): boolean {
        return this.a.isSingle;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        // Optimize query
        if (this.a instanceof SQLWhereEqual) {
            return this.a.inverted().getSQL(options);
        }

        const sqlA = normalizeSQLQuery(this.a.getSQL(options));

        return {
            query: `NOT (${sqlA.query})`, 
            params: sqlA.params
        }
    }
}
