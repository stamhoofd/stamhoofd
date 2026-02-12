import { Database } from '@simonbackx/simple-database';
import { joinSQLQuery, SQLExpression, SQLExpressionOptions, SQLNamedExpression, SQLQuery } from './SQLExpression.js';
import { ParseWhereArguments, SQLEmptyWhere } from './SQLWhere.js';

export type SQLScalarValue = string | number | boolean | Date;
export type SQLDynamicExpression = SQLScalarValue | SQLScalarValue[] | null | SQLExpression;

export function scalarToSQLExpression(s: SQLScalarValue | null): SQLExpression {
    if (s === null) {
        return new SQLNull();
    }

    return new SQLScalar(s);
}

export function readDynamicSQLExpression(s: SQLDynamicExpression): SQLExpression {
    if (Array.isArray(s)) {
        return new SQLArray(s);
    }
    if (s === null) {
        return new SQLNull();
    }

    if (typeof s === 'object' && !(s instanceof Date)) {
        return s;
    }

    return new SQLScalar(s);
}

export class SQLDistinct implements SQLExpression {
    expression: SQLExpression;

    constructor(expression: SQLExpression) {
        this.expression = expression;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'DISTINCT ',
            this.expression.getSQL(options),
        ]);
    }
}

export class SQLCharLength implements SQLExpression {
    expression: SQLExpression;

    constructor(expression: SQLExpression) {
        this.expression = expression;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'CHAR_LENGTH(',
            this.expression.getSQL(options),
            ')',
        ]);
    }
}

export class SQLCount implements SQLExpression {
    expression: SQLExpression | null;

    constructor(expression: SQLExpression | null = null) {
        this.expression = expression;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'COUNT(',
            this.expression ? this.expression.getSQL(options) : '*',
            ')',
        ]);
    }
}

export class SQLLower implements SQLExpression {
    expression: SQLExpression;

    constructor(expression: SQLExpression) {
        this.expression = expression;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'LOWER(',
            this.expression.getSQL(options),
            ')',
        ]);
    }
}

export class SQLPlusSign implements SQLExpression {
    getSQL(): SQLQuery {
        return '+';
    }
}

export class SQLMultiplicationSign implements SQLExpression {
    getSQL(): SQLQuery {
        return '*';
    }
}

export class SQLMinusSign implements SQLExpression {
    getSQL(): SQLQuery {
        return '-';
    }
}

export class SQLGreatest implements SQLExpression {
    expressions: SQLDynamicExpression[];

    constructor(...expressions: SQLDynamicExpression[]) {
        this.expressions = expressions;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'GREATEST(',
            joinSQLQuery(this.expressions.map(e => readDynamicSQLExpression(e).getSQL(options)), ', '),
            ')',
        ]);
    }
}

export class SQLCalculation implements SQLExpression {
    expressions: SQLExpression[];

    constructor(...expressions: SQLExpression[]) {
        this.expressions = expressions;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery(this.expressions.map(e => e.getSQL(options)), ' ');
    }
}

export class SQLSum implements SQLExpression {
    expression: SQLExpression;

    constructor(expression: SQLExpression) {
        this.expression = expression;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'SUM(',
            this.expression.getSQL(options),
            ')',
        ]);
    }
}

export class SQLMin implements SQLExpression {
    expression: SQLExpression;

    constructor(expression: SQLExpression) {
        this.expression = expression;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'MIN(',
            this.expression.getSQL(options),
            ')',
        ]);
    }
}

export class SQLSelectAs implements SQLExpression {
    expression: SQLExpression;
    as: SQLAlias;

    constructor(expression: SQLExpression, as: SQLAlias) {
        this.expression = expression;
        this.as = as;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            this.expression.getSQL(options),
            ' AS ',
            this.as.getSQL(options),
        ]);
    }
}

export class SQLAssignment implements SQLExpression {
    key: SQLExpression;
    value: SQLExpression;

    constructor(key: SQLExpression, value: SQLExpression) {
        this.key = key;
        this.value = value;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            this.key.getSQL(options),
            ' = ',
            this.value.getSQL(options),
        ]);
    }
}

export class SQLAlias implements SQLExpression {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return Database.escapeId(this.name);
    }
}

export class SQLConcat implements SQLExpression {
    expressions: SQLExpression[];

    constructor(...expressions: SQLExpression[]) {
        this.expressions = expressions;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'CONCAT(',
            joinSQLQuery(this.expressions.map(e => e.getSQL(options)), ', '),
            ')',
        ]);
    }
}

export class SQLAge implements SQLExpression {
    expression: SQLExpression;

    constructor(expression: SQLExpression) {
        this.expression = expression;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'TIMESTAMPDIFF(YEAR, ',
            this.expression.getSQL(options),
            ', CURDATE())',
        ]);
    }
}

export class SQLCast implements SQLExpression {
    value: SQLExpression;
    as = 'CHAR';

    constructor(value: SQLExpression, as = 'CHAR') {
        this.value = value;
        this.as = as;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'CAST( ',
            this.value.getSQL(options),
            ' AS ',
            this.as,
            ')',
        ]);
    }
}

class SQLCastedJson implements SQLExpression {
    value: null | true | false;

    constructor(value: null | true | false) {
        this.value = value;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return "CAST('" + JSON.stringify(this.value) + "' AS JSON)";
    }
}
export const SQLJSONNull = new SQLCastedJson(null);
export const SQLJSONTrue = new SQLCastedJson(true);
export const SQLJSONFalse = new SQLCastedJson(false);

export class SQLNull implements SQLExpression {
    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return 'NULL';
    }
}

export class SQLNow implements SQLExpression {
    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return 'NOW()';
    }
}

export class SQLScalar implements SQLExpression {
    value: SQLScalarValue;

    constructor(value: SQLScalarValue) {
        this.value = value;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return {
            query: '?',
            params: [this.value],
        };
    }
}

export class SQLSafeValue implements SQLExpression {
    value: string | number;

    constructor(value: string | number) {
        this.value = value;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return JSON.stringify(this.value);
    }
}

export class SQLArray implements SQLExpression {
    value: SQLScalarValue[];

    constructor(value: SQLScalarValue[]) {
        this.value = value;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return {
            query: '(?)',
            params: [this.value],
        };
    }
}

export class SQLWildcardSelectExpression implements SQLExpression {
    namespace?: string;

    constructor(namespace?: string) {
        this.namespace = namespace;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return Database.escapeId(this.namespace ?? options?.defaultNamespace ?? '') + '.*';
    }
}

export class SQLNamespaceExpression implements SQLExpression {
    namespace: string;

    constructor(namespace: string) {
        this.namespace = namespace;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return Database.escapeId(this.namespace);
    }
}

export const SQLDefaultNamespace: SQLExpression = {
    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (!options?.defaultNamespace) {
            throw new Error('No default namespace provided');
        }
        return Database.escapeId(options.defaultNamespace);
    },
};

/**
 * Reference the table of the parent query
 */
export const SQLParentNamespace: SQLExpression = {
    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (!options?.parentNamespace) {
            throw new Error('No parent namespace provided');
        }
        return Database.escapeId(options.parentNamespace);
    },
};

export type SQLColumnExpressionParams = [
    namespace: string | SQLExpression,
    column: string,
] | [
    column: string,
];

export class SQLColumnExpression implements SQLExpression {
    namespace: SQLExpression;
    column: string;

    constructor(...args: SQLColumnExpressionParams) {
        if (args.length === 1) {
            this.namespace = SQLDefaultNamespace;
            this.column = args[0];
            return;
        }

        const [namespace, column] = args;

        if (typeof namespace === 'string') {
            this.namespace = new SQLNamespaceExpression(namespace);
        }
        else {
            this.namespace = namespace;
        }
        this.column = column;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            this.namespace.getSQL(options),
            '.',
            Database.escapeId(this.column),
        ]);
    }
}

export class SQLIfNull implements SQLExpression {
    constructor(private readonly columnExpression: SQLColumnExpression, private readonly value: string | number) {
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'IFNULL(',
            this.columnExpression.getSQL(options),
            ',',
            new SQLSafeValue(this.value).getSQL(),
            ')',
        ]);
    }
}

export class SQLTableExpression implements SQLNamedExpression {
    /**
     * By default the table name will be used as the namespace by MySQL.
     */
    asNamespace?: string;

    /**
     * For now this is just a string, but thearetically it could be a subquery.
     * We don't support that yet, as those queries are not optimized for performance.
     */
    table: string;

    constructor(table: string, asNamespace?: string) {
        this.asNamespace = asNamespace;
        this.table = table;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (!this.asNamespace) {
            return Database.escapeId(this.table);
        }
        return Database.escapeId(this.table) + ' ' + Database.escapeId(this.asNamespace);
    }

    getName(): string {
        return this.asNamespace ?? this.table;
    }
}

export type SQLJSONTableColumnType = 'VARCHAR' | 'INT' | 'TEXT' | 'JSON';
export class SQLJSONTableColumn implements SQLExpression {
    name: string;
    type: SQLJSONTableColumnType;
    path: string;

    constructor(name: string, type: SQLJSONTableColumnType, path: string) {
        this.name = name;
        this.type = type;
        this.path = path;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            Database.escapeId(this.name),
            ' ',
            'VARCHAR(250)',
            ' PATH ',
            JSON.stringify(this.path),
        ]);
    }
}

export class SQLJSONTableExpression implements SQLNamedExpression {
    expression: SQLExpression;
    asNamespace: string;
    jsonPath = '$[*]';
    columns: SQLJSONTableColumn[] = [];

    constructor(expression: SQLExpression, asNamespace: string) {
        this.asNamespace = asNamespace;
        this.expression = expression;
    }

    addColumn(name: string, type: SQLJSONTableColumnType, path: string): SQLJSONTableExpression {
        this.columns.push(new SQLJSONTableColumn(name, type, path));
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        const columnsSQL = joinSQLQuery(this.columns.map(c => c.getSQL(options)), ', ');
        return joinSQLQuery([
            'JSON_TABLE(',
            this.expression.getSQL(options),
            ', ',
            JSON.stringify(this.jsonPath),
            ' COLUMNS (',
            columnsSQL,
            ')) AS ',
            Database.escapeId(this.asNamespace),
        ]);
    }

    getName(): string {
        return this.asNamespace;
    }
}

export class SQLIf implements SQLExpression {
    _if: SQLExpression;
    _then: SQLExpression = new SQLNull();
    _else: SQLExpression = new SQLNull();

    constructor(...args: ParseWhereArguments) {
        this._if = new SQLEmptyWhere().and(...args);
    }

    then(then: SQLDynamicExpression): SQLIf {
        this._then = readDynamicSQLExpression(then);
        return this;
    }

    else(_else: SQLDynamicExpression): SQLIf {
        this._else = readDynamicSQLExpression(_else);
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'IF(',
            this._if.getSQL(options),
            ',',
            this._then.getSQL(options),
            ',',
            this._else.getSQL(options),
            ')',
        ]);
    }
}

export class SQLCoalesce implements SQLExpression {
    expressions: SQLExpression[] = [];

    constructor(...expressions: SQLExpression[]) {
        this.expressions = expressions;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'COALESCE(',
            joinSQLQuery(this.expressions.map(e => e.getSQL(options)), ', '),
            ')',
        ]);
    }
}

export class SQLIsNull implements SQLExpression {
    expression: SQLExpression;

    constructor(expression: SQLExpression) {
        this.expression = expression;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            this.expression.getSQL(options),
            ' IS NULL',
        ]);
    }
}
