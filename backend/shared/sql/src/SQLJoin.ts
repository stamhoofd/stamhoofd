import { SQLExpression, SQLExpressionOptions, SQLNamedExpression, SQLQuery, joinSQLQuery } from './SQLExpression.js';
import { SQLSelect } from './SQLSelect.js';
import { Whereable } from './SQLWhere.js';

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
