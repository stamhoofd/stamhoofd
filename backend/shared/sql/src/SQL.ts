import { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { SQLDelete } from './SQLDelete';
import { isSQLExpression, SQLExpression } from './SQLExpression';
import { SQLAssignment, SQLColumnExpression, SQLColumnExpressionParams, SQLSafeValue, SQLScalar, SQLScalarValue, SQLTableExpression, SQLWildcardSelectExpression } from './SQLExpressions';
import { SQLJoin, SQLJoinType } from './SQLJoin';
import { SQLJsonExtract, SQLJsonLength, SQLJsonUnquote } from './SQLJsonExpressions';
import { parseTable, SQLSelect } from './SQLSelect';
import { ParseWhereArguments, SQLEmptyWhere, SQLWhere } from './SQLWhere';
import { SQLInsert } from './SQLInsert';
import { SQLUpdate } from './SQLUpdate';

class StaticSQL {
    wildcard(namespace?: string) {
        return new SQLWildcardSelectExpression(namespace);
    }

    column(...args: SQLColumnExpressionParams): SQLColumnExpression {
        return new SQLColumnExpression(...args);
    }

    jsonValue(column: SQLExpression, path: string): SQLJsonExtract {
        return new SQLJsonExtract(column, new SQLSafeValue(path));
    }

    jsonUnquotedValue(column: SQLExpression, path: string): SQLJsonUnquote {
        return new SQLJsonUnquote(new SQLJsonExtract(column, new SQLSafeValue(path)));
    }

    jsonLength(column: SQLExpression, path?: string): SQLJsonLength {
        return new SQLJsonLength(column, path ? new SQLSafeValue(path) : undefined);
    }

    table(namespace: string, table: string): SQLTableExpression;
    table(table: string): SQLTableExpression;
    table(namespaceOrTable: string, table?: string): SQLTableExpression {
        if (table === undefined) {
            return new SQLTableExpression(namespaceOrTable);
        }
        return new SQLTableExpression(namespaceOrTable, table);
    }

    select(...columns: (SQLExpression | string)[]): InstanceType<typeof SQLSelect<SQLResultNamespacedRow>> {
        if (columns.length === 0) {
            return new SQLSelect(this.wildcard());
        }
        return new SQLSelect(...columns);
    }

    insert(tableName: SQLTableExpression | string): InstanceType<typeof SQLInsert> {
        return new SQLInsert(tableName);
    }

    update(tableName: SQLTableExpression | string): InstanceType<typeof SQLUpdate> {
        return new SQLUpdate(tableName);
    }

    assignment(key: SQLExpression | string, value: SQLExpression | SQLScalarValue): SQLAssignment {
        return new SQLAssignment(typeof key === 'string' ? new SQLColumnExpression(key) : key, isSQLExpression(value) ? value : new SQLScalar(value));
    }

    where(...args: ParseWhereArguments): SQLWhere {
        return new SQLEmptyWhere().and(...args);
    }

    whereNot(...args: ParseWhereArguments): SQLWhere {
        return new SQLEmptyWhere().andNot(...args);
    }

    delete(): InstanceType<typeof SQLDelete> {
        return new SQLDelete();
    }

    leftJoin(namespace: string, table: string): SQLJoin;
    leftJoin(table: string): SQLJoin;
    leftJoin(expression: SQLExpression): SQLJoin;
    leftJoin(tableOrExpressiongOrNamespace: SQLExpression | string, table?: string): SQLJoin {
        return new SQLJoin(SQLJoinType.Left, parseTable(tableOrExpressiongOrNamespace, table));
    }

    rightJoin(namespace: string, table: string): SQLJoin;
    rightJoin(table: string): SQLJoin;
    rightJoin(expression: SQLExpression): SQLJoin;
    rightJoin(tableOrExpressiongOrNamespace: SQLExpression | string, table?: string): SQLJoin {
        return new SQLJoin(SQLJoinType.Right, parseTable(tableOrExpressiongOrNamespace, table));
    }

    innerJoin(namespace: string, table: string): SQLJoin;
    innerJoin(table: string): SQLJoin;
    innerJoin(expression: SQLExpression): SQLJoin;
    innerJoin(tableOrExpressiongOrNamespace: SQLExpression | string, table?: string): SQLJoin {
        return new SQLJoin(SQLJoinType.Inner, parseTable(tableOrExpressiongOrNamespace, table));
    }

    join(namespace: string, table: string): SQLJoin;
    join(table: string): SQLJoin;
    join(expression: SQLExpression): SQLJoin;
    join(tableOrExpressiongOrNamespace: SQLExpression | string, table?: string): SQLJoin {
        return new SQLJoin(SQLJoinType.Inner, parseTable(tableOrExpressiongOrNamespace, table));
    }
}

export const SQL = new StaticSQL();
