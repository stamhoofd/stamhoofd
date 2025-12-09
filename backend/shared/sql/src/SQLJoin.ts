import { SQLExpression, SQLExpressionOptions, SQLNamedExpression, SQLQuery, joinSQLQuery } from './SQLExpression';
import { SQLSelect } from './SQLSelect';
import { Whereable } from './SQLWhere';

export enum SQLJoinType {
    Left = 'Left',
    Right = 'Right',
    Inner = 'Inner',
    Outer = 'Outer',
}

class EmptyClass {}
export class SQLJoin extends Whereable(EmptyClass) implements SQLExpression {
    type = SQLJoinType.Left;
    table: SQLNamedExpression;

    constructor(type: SQLJoinType, table: SQLNamedExpression) {
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

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        // add parenthesis if the table is a select
        if (this.table instanceof SQLSelect) {
            return joinSQLQuery([
                this.getJoinPrefix(),
                '(',
                this.table?.getSQL(options),
                `) as ${this.table.getName()}`,
                this._where ? 'ON' : undefined,
                this._where?.getSQL({
                    ...options,
                    parentNamespace: options?.defaultNamespace,
                    defaultNamespace: this.table.getName(),
                }),
            ], ' ');
        }

        return joinSQLQuery([
            this.getJoinPrefix(),
            this.table?.getSQL(options),
            this._where ? 'ON' : undefined,
            this._where?.getSQL({
                ...options,
                parentNamespace: options?.defaultNamespace,
                defaultNamespace: this.table.getName(),
            }),
        ], ' ');
    }
}
