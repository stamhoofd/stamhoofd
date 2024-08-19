import { SQLExpression, SQLExpressionOptions, SQLQuery, joinSQLQuery } from "./SQLExpression";
import { SQLWhere, Whereable } from "./SQLWhere";

export enum SQLJoinType {
    Left = "Left",
    Right = "Right",
    Inner = "Inner",
    Outer = "Outer"
}

class EmptyClass {}
export class SQLJoin extends Whereable(EmptyClass) implements SQLExpression {
    type = SQLJoinType.Left
    table: SQLExpression;

    constructor(type: SQLJoinType, table: SQLExpression) {
        super();
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
