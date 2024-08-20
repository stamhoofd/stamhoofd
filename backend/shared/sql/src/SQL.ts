import { SQLResultNamespacedRow } from "@simonbackx/simple-database";
import { SQLDelete } from "./SQLDelete";
import { SQLExpression } from "./SQLExpression";
import { SQLColumnExpression, SQLSafeValue, SQLTableExpression, SQLWildcardSelectExpression } from "./SQLExpressions";
import { SQLJoin, SQLJoinType } from "./SQLJoin";
import { SQLJsonExtract, SQLJsonLength } from "./SQLJsonExpressions";
import { parseTable, SQLSelect } from "./SQLSelect";

class StaticSQL {
    wildcard(namespace?: string) {
        return new SQLWildcardSelectExpression(namespace)
    }

    column(namespace: string, column: string): SQLColumnExpression;
    column(column: string): SQLColumnExpression;
    column(namespaceOrColumn: string, column?: string): SQLColumnExpression {
        if (column === undefined) {
            return new SQLColumnExpression(namespaceOrColumn)
        }
        return new SQLColumnExpression(namespaceOrColumn, column)
    }

    jsonValue(column: SQLExpression, path: string): SQLJsonExtract {
        return new SQLJsonExtract(column, new SQLSafeValue(path))
    }

    jsonLength(column: SQLExpression, path?: string): SQLJsonLength {
        return new SQLJsonLength(column, path ? new SQLSafeValue(path) : undefined)
    }

    table(namespace: string, table: string): SQLTableExpression;
    table(table: string): SQLTableExpression;
    table(namespaceOrTable: string, table?: string): SQLTableExpression {
        if (table === undefined) {
            return new SQLTableExpression(namespaceOrTable)
        }
        return new SQLTableExpression(namespaceOrTable, table)
    }

    select(...columns: (SQLExpression|string)[]): InstanceType<typeof SQLSelect<SQLResultNamespacedRow>> {
        if (columns.length === 0) {
            return new SQLSelect(this.wildcard())
        }
        return new SQLSelect(...columns)
    }

    delete(): InstanceType<typeof SQLDelete> {
        return new SQLDelete()
    }

    leftJoin(namespace: string, table: string);
    leftJoin(table: string);
    leftJoin(expression: SQLExpression);
    leftJoin(tableOrExpressiongOrNamespace: SQLExpression|string, table?: string) {
        return new SQLJoin(SQLJoinType.Left, parseTable(tableOrExpressiongOrNamespace, table))
    }

    rightJoin(namespace: string, table: string);
    rightJoin(table: string);
    rightJoin(expression: SQLExpression);
    rightJoin(tableOrExpressiongOrNamespace: SQLExpression|string, table?: string) {
        return new SQLJoin(SQLJoinType.Right, parseTable(tableOrExpressiongOrNamespace, table))
    }

    innerJoin(namespace: string, table: string);
    innerJoin(table: string);
    innerJoin(expression: SQLExpression);
    innerJoin(tableOrExpressiongOrNamespace: SQLExpression|string, table?: string) {
        return new SQLJoin(SQLJoinType.Inner, parseTable(tableOrExpressiongOrNamespace, table))
    }

    join(namespace: string, table: string);
    join(table: string);
    join(expression: SQLExpression);
    join(tableOrExpressiongOrNamespace: SQLExpression|string, table?: string) {
        return new SQLJoin(SQLJoinType.Inner, parseTable(tableOrExpressiongOrNamespace, table))
    }
}

export const SQL = new StaticSQL();
