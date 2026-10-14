import type { SQLExpression, SQLExpressionOptions, SQLNamedExpression, SQLQuery} from './SQLExpression.js';
import { joinSQLQuery } from './SQLExpression.js';
import { SQLJoinType, SQLSelectBase } from './SQLQueryContracts.js';
import { Whereable } from './SQLWhere.js';

export { SQLJoinType } from './SQLQueryContracts.js';

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
        if (this.table instanceof SQLSelectBase) {
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
