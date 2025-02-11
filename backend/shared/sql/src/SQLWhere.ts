import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery, normalizeSQLQuery } from './SQLExpression';
import { SQLArray, SQLColumnExpression, SQLDynamicExpression, SQLNull, readDynamicSQLExpression } from './SQLExpressions';
import { SQLJoin } from './SQLJoin';

type Constructor<T = {}> = new (...args: any[]) => T;

export enum SQLWhereSign {
    Equal = '=',
    Greater = '>',
    GreaterEqual = '>=',
    Less = '<',
    LessEqual = '<=',
    NotEqual = '!=',
};

export const SQLWhereSignMap = {
    '=': SQLWhereSign.Equal,
    '>': SQLWhereSign.Greater,
    '>=': SQLWhereSign.GreaterEqual,
    '<': SQLWhereSign.Less,
    '<=': SQLWhereSign.LessEqual,
    '!=': SQLWhereSign.NotEqual,
} as const;

function parseWhereSign(sign: SQLWhereSign | keyof typeof SQLWhereSignMap): SQLWhereSign {
    if (typeof sign === 'string' && Object.hasOwnProperty.call(SQLWhereSignMap, sign)) {
        return SQLWhereSignMap[sign];
    }
    return sign as SQLWhereSign;
}

export type ParseWhereArguments = [
    where: SQLWhere,
] | [
    whereOrColumn: SQLExpression | string,
    value: SQLDynamicExpression,
] | [
    whereOrColumn: SQLExpression | string,
    sign: SQLWhereSign | keyof typeof SQLWhereSignMap,
    value: SQLDynamicExpression,
];

function assertWhereable(o: any): any {
    return o;
}

export function Whereable<Sup extends Constructor<object>>(Base: Sup) {
    return class extends Base {
        _where: SQLWhere | null = null;

        get __where() {
            return this._where ?? new SQLEmptyWhere();
        }

        where<T>(this: T, ...args: ParseWhereArguments): T {
            const me = assertWhereable(this);
            me._where = me.__where.and(...args);
            return me;
        }

        andWhere<T>(this: T, ...args: ParseWhereArguments): T {
            const me = assertWhereable(this);
            me._where = me.__where.and(...args);
            return me;
        }

        orWhere<T>(this: T, ...args: ParseWhereArguments): T {
            const me = assertWhereable(this);
            me._where = me.__where.or(...args);
            return me;
        }

        whereNot<T>(this: T, ...args: ParseWhereArguments): T {
            const me = assertWhereable(this);
            me._where = me.__where.andNot(...args);
            return me;
        }

        andWhereNot<T>(this: T, ...args: ParseWhereArguments): T {
            const me = assertWhereable(this);
            me._where = me.__where.andNot(...args);
            return me;
        }

        orWhereNot<T>(this: T, ...args: ParseWhereArguments): T {
            const me = assertWhereable(this);
            me._where = me.__where.orNot(...args);
            return me;
        }
    };
}

export abstract class SQLWhere implements SQLExpression {
    and(...args: ParseWhereArguments): SQLWhere {
        return new SQLWhereAnd([this, SQLWhereEqual.parseWhere(...args)]);
    }

    or(...args: ParseWhereArguments): SQLWhere {
        return new SQLWhereOr([this, SQLWhereEqual.parseWhere(...args)]);
    }

    andNot(...args: ParseWhereArguments): SQLWhere {
        return new SQLWhereAnd([
            this,
            new SQLWhereNot(
                SQLWhereEqual.parseWhere(...args),
            ),
        ]);
    }

    orNot(...args: ParseWhereArguments): SQLWhere {
        return new SQLWhereOr([
            this,
            new SQLWhereNot(
                SQLWhereEqual.parseWhere(...args),
            ),
        ]);
    }

    get isSingle(): boolean {
        return false;
    }

    abstract getSQL(options?: SQLExpressionOptions): SQLQuery;
    getJoins(): SQLJoin[] {
        return [];
    }
}

export class SQLEmptyWhere extends SQLWhere {
    and(...args: ParseWhereArguments): SQLWhere {
        return SQLWhereEqual.parseWhere(...args);
    }

    or(...args: ParseWhereArguments): SQLWhere {
        return SQLWhereEqual.parseWhere(...args);
    }

    andNot(...args: ParseWhereArguments): SQLWhere {
        return new SQLWhereNot(
            SQLWhereEqual.parseWhere(...args),
        );
    }

    orNot(...args: ParseWhereArguments): SQLWhere {
        return new SQLWhereNot(
            SQLWhereEqual.parseWhere(...args),
        );
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        throw new Error('Empty where');
    }
}

export class SQLWhereEqual extends SQLWhere {
    column: SQLExpression;
    sign = SQLWhereSign.Equal;
    value: SQLExpression;

    static parseWhere(...parsed: ParseWhereArguments): SQLWhere {
        if (parsed[1] === undefined) {
            return parsed[0];
        }

        if (parsed.length === 3) {
            return new SQLWhereEqual(
                typeof parsed[0] === 'string' ? new SQLColumnExpression(parsed[0]) : parsed[0],
                parseWhereSign(parsed[1]),
                readDynamicSQLExpression(parsed[2]),
            );
        }
        return new SQLWhereEqual(
            typeof parsed[0] === 'string' ? new SQLColumnExpression(parsed[0]) : parsed[0],
            SQLWhereSign.Equal,
            readDynamicSQLExpression(parsed[1]),
        );
    }

    constructor(column: SQLExpression, sign: SQLWhereSign, value: SQLExpression);
    constructor(column: SQLExpression, value: SQLExpression);
    constructor(column: SQLExpression, signOrValue: SQLExpression | SQLWhereSign, value?: SQLExpression) {
        super();
        this.column = column;

        if (value !== undefined) {
            this.value = value;
            this.sign = signOrValue as SQLWhereSign;
        }
        else {
            this.value = signOrValue as SQLExpression;
        }
    }

    clone(): this {
        const c = (new (this.constructor as any)(this.column, this.sign, this.value)) as this;
        Object.assign(c, this);
        return c;
    }

    get isSingle(): boolean {
        return true;
    }

    inverted(): this {
        return this.clone().invert();
    }

    invert(): this {
        switch (this.sign) {
            case SQLWhereSign.Equal:
                this.sign = SQLWhereSign.NotEqual;
                break;
            case SQLWhereSign.NotEqual:
                this.sign = SQLWhereSign.Equal;
                break;
            case SQLWhereSign.Greater:
                this.sign = SQLWhereSign.LessEqual;
                break;
            case SQLWhereSign.Less:
                this.sign = SQLWhereSign.GreaterEqual;
                break;
            case SQLWhereSign.GreaterEqual:
                this.sign = SQLWhereSign.Less;
                break;
            case SQLWhereSign.LessEqual:
                this.sign = SQLWhereSign.Greater;
                break;
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
                this.value.getSQL(options),
            ]);
        }

        if (this.value instanceof SQLNull) {
            if (this.sign !== SQLWhereSign.Equal && this.sign !== SQLWhereSign.NotEqual) {
                throw new Error('Unsupported sign for NULL: ' + this.sign);
            }

            return joinSQLQuery([
                this.column.getSQL(options),
                ` IS ${(this.sign === SQLWhereSign.NotEqual) ? 'NOT ' : ''} `,
                this.value.getSQL(options),
            ]);
        }

        return joinSQLQuery([
            this.column.getSQL(options),
            ` ${this.sign} `,
            this.value.getSQL(options),
        ]);
    }
}

export class SQLWhereLike extends SQLWhere {
    column: SQLExpression;
    notLike = false;
    value: SQLExpression;

    constructor(column: SQLExpression, value: SQLExpression) {
        super();
        this.column = column;
        this.value = value;
    }

    static escape(str: string) {
        return str.replace(/([%_])/g, '\\$1');
    }

    clone(): this {
        const c = (new (this.constructor as any)(this.column, this.value)) as this;
        Object.assign(c, this);
        return c;
    }

    get isSingle(): boolean {
        return true;
    }

    inverted(): this {
        return this.clone().invert();
    }

    invert(): this {
        this.notLike = !this.notLike;
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            this.column.getSQL(options),
            ` ${this.notLike ? 'NOT LIKE' : 'LIKE'} `,
            this.value.getSQL(options),
        ]);
    }
}

export class SQLWhereExists extends SQLWhere {
    subquery: SQLExpression;
    notExists = false;

    constructor(subquery: SQLExpression) {
        super();
        this.subquery = subquery;
    }

    clone(): this {
        const c = (new (this.constructor as any)(this.subquery)) as this;
        Object.assign(c, this);
        return c;
    }

    get isSingle(): boolean {
        return true;
    }

    inverted(): this {
        return this.clone().invert();
    }

    invert(): this {
        this.notExists = !this.notExists;
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            `${this.notExists ? 'NOT EXISTS' : 'EXISTS'} (`,
            this.subquery.getSQL(options),
            `)`,
        ]);
    }
}

/**
 * Convenience helper which also caries a separate join that should be injected in the query for the where to work
 */
export class SQLWhereJoin extends SQLWhere {
    join: SQLJoin;
    where: SQLWhere;

    constructor(join: SQLJoin, where: SQLWhere) {
        super();
        this.join = join;
        this.where = where;
    }

    get isSingle(): boolean {
        return this.where.isSingle;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return this.where.getSQL(options);
    }

    getJoins(): SQLJoin[] {
        return [this.join];
    }
}

export class SQLWhereAnd extends SQLWhere {
    children: SQLWhere[];

    constructor(children: SQLWhere[]) {
        super();
        this.children = children;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery(
            this.children.map((c) => {
                if (c.isSingle) {
                    return c.getSQL(options);
                }
                return joinSQLQuery(['(', c.getSQL(options), ')']);
            }),
            ' AND ',
        );
    }

    getJoins(): SQLJoin[] {
        return this.children.flatMap(c => c.getJoins());
    }
}

export class SQLWhereOr extends SQLWhere {
    children: SQLWhere[];

    constructor(children: SQLWhere[]) {
        super();
        this.children = children;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery(
            this.children.map((c) => {
                if (c.isSingle) {
                    return c.getSQL(options);
                }
                return joinSQLQuery(['(', c.getSQL(options), ')']);
            }),
            ' OR ',
        );
    }

    getJoins(): SQLJoin[] {
        return this.children.flatMap(c => c.getJoins());
    }
}

export class SQLWhereNot extends SQLWhere {
    a: SQLWhere;

    constructor(a: SQLWhere) {
        super();
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
            params: sqlA.params,
        };
    }

    getJoins(): SQLJoin[] {
        return this.a.getJoins();
    }
}
