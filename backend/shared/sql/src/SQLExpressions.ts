import { isSQLExpression, joinSQLQuery, SQLExpression, SQLExpressionOptions, SQLQuery } from "./SQLExpression";
import {Database} from "@simonbackx/simple-database"

export type SQLScalarValue = string|number|boolean|Date;
export type SQLDynamicExpression = SQLScalarValue|SQLScalarValue[]|null|SQLExpression

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

export class SQLNull implements SQLExpression {
    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return 'NULL';
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