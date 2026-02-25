import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery, normalizeSQLQuery } from './SQLExpression.js';
import { SQLArray, SQLColumnExpression, SQLDynamicExpression, SQLNull, readDynamicSQLExpression } from './SQLExpressions.js';
import { SQLJoin, SQLJoinType } from './SQLJoin.js';
import { SQLSelect } from './SQLSelect.js';

type Constructor<T = object> = new (...args: any[]) => T;

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

    get isAlways(): boolean | null {
        return null;
    }

    get isAlwaysTrue(): boolean {
        return this.isAlways === true;
    }

    get isAlwaysFalse(): boolean {
        return this.isAlways === false;
    }

    abstract getSQL(options?: SQLExpressionOptions): SQLQuery;
    getJoins(): SQLJoin[] {
        return [];
    }

    abstract clone(): this;
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

    get isAlways() {
        return true;
    }

    clone(): this {
        return new SQLEmptyWhere() as this;
    }
}

export class SQLWhereEqual extends SQLWhere {
    column: SQLExpression;
    sign = SQLWhereSign.Equal;
    value: SQLExpression;
    nullable = false;

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
        return this.transformed?.isSingle ?? true;
    }

    get isAlways(): boolean | null {
        return this.transformed?.isAlways ?? null;
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

    setNullable(nullable: boolean = true): this {
        this.nullable = nullable;
        return this;
    }

    get transformed() {
        if (this.value instanceof SQLNull) {
            // We'll do some transformations to make this query work as expected.
            // < null = always false
            // > null = (IS NOT null)
            // <= null = (IS null)
            // >= null = always true
            if (this.sign === SQLWhereSign.Less) {
                // always false
                return new SQLWhereOr([]);
            }
            if (this.sign === SQLWhereSign.Greater) {
                // > null = (IS NOT null)
                return new SQLWhereEqual(this.column, SQLWhereSign.NotEqual, this.value);
            }
            if (this.sign === SQLWhereSign.LessEqual) {
                // (IS null)
                return new SQLWhereEqual(this.column, SQLWhereSign.Equal, this.value);
            }
            if (this.sign === SQLWhereSign.GreaterEqual) {
                // always true
                return new SQLWhereAnd([]);
            }
        }

        // If the expression is nullable, we'll need to do some handling to make sure the query works as expected.
        if (this.nullable && !(this.value instanceof SQLNull)) {
            // <: should also include null values
            // <=: should also include null values
            if (this.sign === SQLWhereSign.Less || this.sign === SQLWhereSign.LessEqual) {
                return new SQLWhereOr([
                    this.clone().setNullable(false),
                    new SQLWhereEqual(this.column, SQLWhereSign.Equal, new SQLNull()),
                ]);
            }
        }

        return null;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (this.transformed) {
            return this.transformed.getSQL(options);
        }
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
                ` IS ${(this.sign === SQLWhereSign.NotEqual) ? 'NOT ' : ''}`,
                this.value.getSQL(options),
            ]);
        }

        let sign = this.sign as string;
        if (this.sign === SQLWhereSign.Equal && this.nullable) {
            // Swap with null-safe equal
            sign = '<=>';
        }
        else if (this.sign === SQLWhereSign.NotEqual && this.nullable) {
            // Swap with null-safe not equal
            return joinSQLQuery([
                'NOT (',
                this.column.getSQL(options),
                ` <=> `,
                this.value.getSQL(options),
                ')',
            ]);
        }

        return joinSQLQuery([
            this.column.getSQL(options),
            ` ${sign} `,
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
        return str.replace(/([%_\\])/g, '\\$1');
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

export type SQLMatchSearchModifier = 'IN NATURAL LANGUAGE MODE' | 'IN NATURAL LANGUAGE MODE WITH QUERY EXPANSION' | 'IN BOOLEAN MODE' | 'WITH QUERY EXPANSION';

export class SQLMatch extends SQLWhere {
    column: SQLExpression;
    notMatch = false;
    value: SQLExpression;
    searchModifier: SQLMatchSearchModifier;

    constructor(column: SQLExpression, value: SQLExpression, searchModifier: SQLMatchSearchModifier = 'IN BOOLEAN MODE') {
        super();
        this.column = column;
        this.value = value;
        this.searchModifier = searchModifier;
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
        this.notMatch = !this.notMatch;
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        const queries = [
            'MATCH(',
            this.column.getSQL(options),
            ') AGAINST(',
            this.value.getSQL(options),
            ` ${this.searchModifier})`,
        ];

        if (this.notMatch) {
            queries.unshift('NOT ');
        }

        return joinSQLQuery(queries);
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

    get isAlways(): boolean | null {
        if (this.subquery instanceof SQLSelect) {
            const value = this.subquery.isAlways;
            if (this.notExists) {
                if (value === true) {
                    // If the subquery is always true, then NOT EXISTS is always false
                    return false;
                }
                if (value === false) {
                    // If the subquery is always false, then NOT EXISTS is always true
                    return true;
                }
            }
            return value;
        }
        return null;
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

    /**
     * When this is true, this means we know this relation will always exist.
     *
     * This information will be used to optimize the query.
     */
    doesRelationAlwaysExist = false;

    constructor(join: SQLJoin, where: SQLWhere, options?: { doesRelationAlwaysExist?: boolean }) {
        super();
        this.join = join;
        this.where = where;
        this.doesRelationAlwaysExist = options?.doesRelationAlwaysExist ?? false;
    }

    get isSingle(): boolean {
        return this.where.isSingle;
    }

    get isAlways(): boolean | null {
        return this.where.isAlways;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (this.where.isAlways !== null && (this.doesRelationAlwaysExist || this.join.type === SQLJoinType.Left)) {
            throw new Error('SQLWhereJoin: should not be included in query if result is determined');
        }

        return this.where.getSQL({
            ...options,
            parentNamespace: options?.defaultNamespace,
            defaultNamespace: this.join.table.getName(),
        });
    }

    getJoins(): SQLJoin[] {
        if (this.where.isAlways !== null && (this.doesRelationAlwaysExist || this.join.type === SQLJoinType.Left)) {
            return [];
        }
        return [this.join, ...this.where.getJoins()];
    }

    clone(): this {
        const c = (new (this.constructor as any)(this.join, this.where.clone())) as this;
        c.doesRelationAlwaysExist = this.doesRelationAlwaysExist;
        return c;
    }
}

export class SQLWhereAnd extends SQLWhere {
    children: SQLWhere[];

    constructor(children: SQLWhere[]) {
        super();
        this.children = children;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (this.isAlways === false) {
            throw new Error('SQLWhereAnd: $and is always false and should be removed from the query');
        }

        return joinSQLQuery(
            this.filteredChildren.map((c) => {
                if (c.isSingle || this.filteredChildren.length === 1) {
                    return c.getSQL(options);
                }
                return joinSQLQuery(['(', c.getSQL(options), ')']);
            }),
            ' AND ',
        );
    }

    get filteredChildren(): SQLWhere[] {
        // Children that always return true should not be included in the query (because the result only depends on the other children)
        return this.children.filter(c => c.isAlways !== true).flatMap(c => c instanceof SQLWhereAnd ? c.filteredChildren : [c]);
    }

    getJoins(): SQLJoin[] {
        return this.children.flatMap(c => c.getJoins()); // note: keep all joins
    }

    get isSingle(): boolean {
        return this.filteredChildren.length === 1 && this.filteredChildren[0].isSingle;
    }

    get isAlways(): boolean | null {
        let allTrue = true;
        for (const c of this.children) {
            const v = c.isAlways;
            if (v === false) {
                // If any child is always false, the whole AND is false
                return false;
            }
            if (v === null) {
                allTrue = false;
            }
        }

        return allTrue ? true : null;
    }

    inverted(): SQLWhereOr {
        // NOT (A AND B) is the same as (NOT A OR NOT B)
        return new SQLWhereOr(this.children.map(c => new SQLWhereNot(c)));
    }

    clone(): this {
        const c = (new (this.constructor as any)(this.children.map(child => child.clone()))) as this;
        return c;
    }
}

export class SQLWhereOr extends SQLWhere {
    children: SQLWhere[];

    constructor(children: SQLWhere[]) {
        super();
        this.children = children;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (this.filteredChildren.length === 0) {
            // Always false: throw an error (the parent should filter out this query)
            throw new Error('SQLWhereOr: empty $or is always false and should be removed from the query');
        }

        return joinSQLQuery(
            this.filteredChildren.map((c) => {
                if (c.isSingle || this.filteredChildren.length === 1) {
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

    get filteredChildren(): SQLWhere[] {
        // Children that always return false should not be included in the query (because the result only depends on the other children)
        return this.children.filter(c => c.isAlways !== false).flatMap(c => c instanceof SQLWhereOr ? c.filteredChildren : [c]);
    }

    get isSingle(): boolean {
        return this.filteredChildren.length === 1 && this.filteredChildren[0].isSingle;
    }

    get isAlways(): boolean | null {
        let isAllFalse = true;
        for (const c of this.children) {
            const v = c.isAlways;
            if (v === true) {
                // If any child is always true, the whole OR is true
                return true;
            }
            if (v === null) {
                isAllFalse = false;
            }
        }

        return isAllFalse ? false : null;
    }

    inverted(): SQLWhereOr {
        // NOT (A OR B) is the same as (NOT A AND NOT B)
        return new SQLWhereAnd(this.children.map(c => new SQLWhereNot(c)));
    }

    clone(): this {
        const c = (new (this.constructor as any)(this.children.map(child => child.clone()))) as this;
        return c;
    }
}

export class SQLWhereNot extends SQLWhere {
    a: SQLWhere;

    constructor(a: SQLWhere) {
        super();
        this.a = a;
    }

    get isSingle(): boolean {
        if (this.a instanceof SQLWhereEqual || this.a instanceof SQLWhereAnd || this.a instanceof SQLWhereOr || this.a instanceof SQLWhereNot) {
            return this.a.inverted().isSingle;
        }

        return this.a.isSingle;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        // Optimize query
        if (this.a instanceof SQLWhereEqual || this.a instanceof SQLWhereAnd || this.a instanceof SQLWhereOr || this.a instanceof SQLWhereNot) {
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

    get isAlways(): boolean | null {
        const v = this.a.isAlways;
        if (v === true) {
            return false;
        }
        if (v === false) {
            return true;
        }
        return null;
    }

    inverted(): SQLWhere {
        return this.a; // NOT NOT A is just A
    }

    clone(): this {
        const c = (new (this.constructor as any)(this.a.clone())) as this;
        return c;
    }
}
