import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery } from './SQLExpression';
import { SQLJSONValue, SQLSafeValue, SQLScalar, SQLScalarValue } from './SQLExpressions';
import { SQLWhere } from './SQLWhere';

export function scalarToSQLJSONExpression(s: SQLScalarValue | null): SQLExpression {
    if (s === null) {
        return new SQLJSONValue(null);
    }

    if (s === true) {
        return new SQLJSONValue(true);
    }

    if (s === false) {
        return new SQLJSONValue(false);
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
