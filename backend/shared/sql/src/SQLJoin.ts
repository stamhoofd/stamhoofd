import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery } from "./SQLExpression";
import { SQLWhere, addWhereHelpers } from "./SQLWhere";

export enum SQLJoinType {
    Left = "Left",
    Right = "Right",
    Inner = "Inner",
    Outer = "Outer"
}

export class JoinBase implements SQLExpression {
    type = SQLJoinType.Left
    table: SQLExpression;
    _where: SQLWhere|null = null;

    constructor(type: SQLJoinType, table: SQLExpression) {
        this.type = type;
        this.table = table;
    }

    private getJoinPrefix(): string {
        switch (this.type) {
            case SQLJoinType.Left: return 'LEFT JOIN';
            case SQLJoinType.Right: return 'RIGHT JOIN';
            case SQLJoinType.Inner: return 'JOIN';
            case SQLJoinType.Outer: return 'OUTER JOIN';
        }
    }

    getSQL(options?: SQLExpressionOptions | undefined): SQLQuery {
        return joinSQLQuery([
            this.getJoinPrefix(),
            this.table?.getSQL(),
            this._where ? 'ON' : undefined,
            this._where?.getSQL()
        ], ' ')
    }
}

export const SQLJoin = addWhereHelpers(JoinBase)