import { SQLExpression } from "./SQLExpression";
import { SQLSelect } from "./SQLSelect";
import { SQLColumnExpression, SQLTableExpression, SQLWildcardSelectExpression } from "./SQLExpressions";
import { SQLJoin, SQLJoinType } from "./SQLJoin";

class StaticSQL {
    wildcard(namespace?: string) {
        return new SQLWildcardSelectExpression(namespace)
    }

    column(namespace: string, column: string);
    column(column: string);
    column(namespaceOrColumn: string, column?: string) {
        if (column === undefined) {
            return new SQLColumnExpression(namespaceOrColumn)
        }
        return new SQLColumnExpression(namespaceOrColumn, column)
    }

    table(namespace: string, table: string);
    table(table: string);
    table(namespaceOrTable: string, table?: string) {
        if (table === undefined) {
            return new SQLTableExpression(namespaceOrTable)
        }
        return new SQLTableExpression(namespaceOrTable, table)
    }

    select(...columns: SQLExpression[]) {
        if (columns.length === 0) {
            return new SQLSelect(this.wildcard())
        }
        return new SQLSelect(...columns)
    }

    leftJoin(table: SQLExpression) {
        return new SQLJoin(SQLJoinType.Left, table)
    }

    rightJoin(table: SQLExpression) {
        return new SQLJoin(SQLJoinType.Right, table)
    }

    innerJoin(table: SQLExpression) {
        return new SQLJoin(SQLJoinType.Inner, table)
    }

    join(table: SQLExpression) {
        return new SQLJoin(SQLJoinType.Inner, table)
    }
}

export const SQL = new StaticSQL();