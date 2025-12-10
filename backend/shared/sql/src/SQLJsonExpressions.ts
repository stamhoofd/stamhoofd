import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery } from './SQLExpression.js';
import { SQLJSONFalse, SQLJSONNull, SQLJSONTrue, SQLSafeValue, SQLScalar, SQLScalarValue } from './SQLExpressions.js';
import { SQLWhere } from './SQLWhere.js';

export function scalarToSQLJSONExpression(s: SQLScalarValue | null): SQLExpression {
    if (s === null) {
        return SQLJSONNull;
    }

    if (s === true) {
        return SQLJSONTrue;
    }

    if (s === false) {
        return SQLJSONFalse;
    }

    return new SQLScalar(s);
}

export class SQLJsonUnquote implements SQLExpression {
    target: SQLExpression;

    constructor(target: SQLExpression) {
        this.target = target;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'JSON_UNQUOTE(',
            this.target.getSQL(options),
            ')',
        ]);
    }
}

export type SQLJsonValueType = 'FLOAT' | 'DOUBLE' | 'DECIMAL' | 'SIGNED' | 'UNSIGNED' | 'DATE' | 'TIME' | 'DATETIME' | 'YEAR' | 'CHAR' | 'JSON';

export class SQLJsonValue implements SQLExpression {
    target: SQLExpression;
    path: SQLExpression;
    type?: SQLJsonValueType;

    constructor(target: SQLExpression, type?: SQLJsonValueType, path?: SQLExpression) {
        this.target = target;
        this.type = type;

        if (!path && target instanceof SQLJsonExtract) {
            // If the target is a SQLJsonExtract, we can use its path directly
            this.target = target.target;
            this.path = target.path;
            return;
        }

        this.path = path ?? new SQLSafeValue('$');
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'JSON_VALUE(',
            this.target.getSQL(options),
            ',',
            this.path.getSQL(options),
            (this.type ? ' RETURNING ' + this.type + (this.type === 'CHAR' ? ' CHARACTER SET utf8mb4' : '') : ''),
            ' ERROR ON ERROR)',
        ]);
    }
}

/**
 * Same as target->path, JSON_EXTRACT(target, path)
 */
export class SQLJsonExtract implements SQLExpression {
    target: SQLExpression;
    path: SQLExpression;

    constructor(target: SQLExpression, path: SQLExpression) {
        this.target = target;
        this.path = path;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'JSON_EXTRACT(',
            this.target.getSQL(options),
            ',',
            this.path.getSQL(options),
            ')',
        ]);
    }

    /**
     * NOTE: this has to be combined with asScalar = true! Never let user input in a query without passing it as a parameter.
     *
     * E.g. SQL.jsonValue(SQL.column('settings'), `$.value.prices[*].bundleDiscounts.${SQLJsonExtract.escapePathComponent(key)}`, true) (note that last true!)
     */
    static escapePathComponent(str: string) {
        return '"' + str.replace(/(["\\])/g, '\\$1') + '"';
    }
}

export class SQLJsonType implements SQLExpression {
    target: SQLExpression;

    constructor(target: SQLExpression) {
        this.target = target;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'JSON_TYPE(',
            this.target.getSQL(options),
            ')',
        ]);
    }
}

/**
 * Same as target->path, JSON_EXTRACT(target, path)
 */
export class SQLJsonKeys implements SQLExpression {
    target: SQLExpression;

    constructor(target: SQLExpression) {
        this.target = target;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'JSON_KEYS(',
            this.target.getSQL(options),
            ')',
        ]);
    }
}

export class SQLJsonLength implements SQLExpression {
    target: SQLExpression;
    path?: SQLExpression;

    constructor(target: SQLExpression, path?: SQLExpression) {
        this.target = target;
        this.path = path;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'JSON_LENGTH(',
            this.target.getSQL(options),
            ...(this.path
                ? [
                        ',',
                        this.path.getSQL(options),
                    ]
                : []),
            ')',
        ]);
    }
}
/**
 * JSON_SEARCH(json_doc, one_or_all, search_str[, escape_char[, path] ...])
 */
export class SQLJsonSearch implements SQLExpression {
    target: SQLExpression;
    oneOrAll: 'one' | 'all';
    searchStr: SQLExpression;
    path: SQLExpression | null;

    constructor(target: SQLExpression, oneOrAll: 'one' | 'all', searchStr: SQLExpression, path: SQLExpression | null = null) {
        this.target = target;
        this.oneOrAll = oneOrAll;
        this.searchStr = searchStr;
        this.path = path;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'JSON_SEARCH(',
            this.target.getSQL(options),
            ',',
            new SQLSafeValue(this.oneOrAll).getSQL(options),
            ',',
            this.searchStr.getSQL(options),
            ...(this.path
                ? [
                        ',',
                        this.path.getSQL(options),
                    ]
                : []),
            ')',
        ]);
    }
}

/**
 * JSON_CONTAINS(target, candidate[, path])
 */
export class SQLJsonContains extends SQLWhere {
    target: SQLExpression;
    candidate: SQLExpression;
    path: SQLExpression | null;

    constructor(target: SQLExpression, candidate: SQLExpression, path: SQLExpression | null = null) {
        super();
        this.target = target;
        this.candidate = candidate;
        this.path = path;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'JSON_CONTAINS(',
            this.target.getSQL(options),
            ',',
            this.candidate.getSQL(options),
            ...(this.path
                ? [
                        ',',
                        this.path.getSQL(options),
                    ]
                : []),
            ')',
        ]);
    }

    clone(): this {
        const c = (new (this.constructor as any)(this.target, this.candidate, this.path)) as this;
        return c;
    }
}

/**
 * JSON_CONTAINS(json_doc1, json_doc2)
 */
export class SQLJsonOverlaps extends SQLWhere {
    jsonDoc1: SQLExpression;
    jsonDoc2: SQLExpression;

    constructor(jsonDoc1: SQLExpression, jsonDoc2: SQLExpression) {
        super();
        this.jsonDoc1 = jsonDoc1;
        this.jsonDoc2 = jsonDoc2;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'JSON_OVERLAPS(',
            this.jsonDoc1.getSQL(options),
            ',',
            this.jsonDoc2.getSQL(options),
            ')',
        ]);
    }

    clone(): this {
        const c = (new (this.constructor as any)(this.jsonDoc1, this.jsonDoc2)) as this;
        return c;
    }
}

export class SQLLpad implements SQLExpression {
    target: SQLExpression;
    length: SQLExpression;
    value: SQLExpression;

    constructor(target: SQLExpression, length: SQLExpression, value: SQLExpression) {
        this.target = target;
        this.length = length;
        this.value = value;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'LPAD(',
            this.target.getSQL(options),
            ',',
            this.length.getSQL(options),
            ',',
            this.value.getSQL(options),
            ')',
        ]);
    }
}
