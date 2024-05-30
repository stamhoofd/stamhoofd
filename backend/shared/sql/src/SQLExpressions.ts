import { isSQLExpression, joinSQLQuery, SQLExpression, SQLExpressionOptions, SQLQuery } from "./SQLExpression";
import {Database} from "@simonbackx/simple-database"

export type SQLScalarValue = string|number|boolean|Date;
export type SQLDynamicExpression = SQLScalarValue|SQLScalarValue[]|null|SQLExpression

export function scalarToSQLJSONExpression(s: SQLScalarValue|null): SQLExpression {
    if (s === null) {
        return new SQLJSONValue(null)
    }

    if (s === true) {
        return new SQLJSONValue(true)
    }

    if (s === false) {
        return new SQLJSONValue(false)
    }

    return new SQLScalar(s)
}

export function scalarToSQLExpression(s: SQLScalarValue|null): SQLExpression {
    if (s === null) {
        return new SQLNull()
    }

    return new SQLScalar(s)
}

export function readDynamicSQLExpression(s: SQLDynamicExpression): SQLExpression {
    if (Array.isArray(s)) {
        return new SQLArray(s)
    }
    if (s === null) {
        return new SQLNull()
    }

    if (typeof s === 'object' && !(s instanceof Date)) {
        return s;
    }

    return new SQLScalar(s)
}

export class SQLCount implements SQLExpression {
    expression: SQLExpression|null

    constructor(expression: SQLExpression|null = null) {
        this.expression = expression
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'COUNT(',
                this.expression ? this.expression.getSQL(options) : '*',
            ')'
        ])
    }
}

export class SQLSelectAs implements SQLExpression {
    expression: SQLExpression
    as: SQLAlias

    constructor(expression: SQLExpression, as: SQLAlias) {
        this.expression = expression
        this.as = as;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            this.expression.getSQL(options),
            ' AS ',
            this.as.getSQL(options)
        ])
    }
}

export class SQLAlias implements SQLExpression {
    name: string;

    constructor(name: string) {
        this.name = name
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return Database.escapeId(this.name) ;
    }
}


export class SQLConcat implements SQLExpression {
    expressions: SQLExpression[];

    constructor(...expressions: SQLExpression[]) {
        this.expressions = expressions
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'CONCAT(',
            joinSQLQuery(this.expressions.map(e => e.getSQL(options)), ', '),
            ')'
        ])
    }
}


export class SQLAge implements SQLExpression {
    expression: SQLExpression;

    constructor(expression: SQLExpression) {
        this.expression = expression
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'TIMESTAMPDIFF(YEAR, ',
            this.expression.getSQL(options),
            ', CURDATE())'
        ])
    }
}

export class SQLJSONValue implements SQLExpression {
    value: null|true|false;

    constructor(value: null|true|false) {
        this.value = value;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return "CAST('"+JSON.stringify(this.value)+"' AS JSON)";
    }
}

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
        this.value = value
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return {
            query: '?',
            params: [this.value]
        }
    }
}

export class SQLSafeValue implements SQLExpression {
    value: string|number;

    constructor(value: string|number) {
        this.value = value
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return JSON.stringify(this.value);
    }
}


export class SQLArray implements SQLExpression {
    value: SQLScalarValue[];

    constructor(value: SQLScalarValue[]) {
        this.value = value
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return {
            query: '(?)',
            params: [this.value]
        }
    }
}

export class SQLWildcardSelectExpression implements SQLExpression {
    namespace?: string;

    constructor(namespace?: string) {
        this.namespace = namespace
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return Database.escapeId(this.namespace ?? options?.defaultNamespace ?? '') + '.*'
    }
}

export class SQLColumnExpression implements SQLExpression {
    namespace?: string;
    column: string;

    constructor(namespace: string, column: string);
    constructor(column: string);
    constructor(namespaceOrColumn: string, column?: string) {
        if (column === undefined) {
            this.column = namespaceOrColumn;
            return;
        }
        this.namespace = namespaceOrColumn
        this.column = column
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return Database.escapeId(this.namespace ?? options?.defaultNamespace ?? '') + '.' + Database.escapeId(this.column)
    }
}

export class SQLTableExpression implements SQLExpression {
    namespace?: string;
    table: string;

    constructor(namespace: string, table: string);
    constructor(table: string);
    constructor(namespaceOrTable: string, table?: string) {
        if (table === undefined) {
            this.table = namespaceOrTable;
            return;
        }
        this.namespace = namespaceOrTable
        this.table = table
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        if (!this.namespace) {
            return Database.escapeId(this.table)
        }
        return Database.escapeId(this.table) + ' ' + Database.escapeId(this.namespace)
    }
}
