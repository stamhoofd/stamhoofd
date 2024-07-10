import { SQLExpression } from "./SQLExpression";
import { SQLSelect } from "./SQLSelect";
import { SQLColumnExpression, SQLSafeValue, SQLTableExpression, SQLWildcardSelectExpression, scalarToSQLExpression } from "./SQLExpressions";
import { SQLJoin, SQLJoinType } from "./SQLJoin";
import { SQLJsonExtract, SQLJsonLength } from "./SQLJsonExpressions";
import { SQLDelete } from "./SQLDelete";

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

    select(...columns: SQLExpression[]): InstanceType<typeof SQLSelect> {
        if (columns.length === 0) {
            return new SQLSelect(this.wildcard())
        }
        return new SQLSelect(...columns)
    }

    delete(): InstanceType<typeof SQLDelete> {
        return new SQLDelete()
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
