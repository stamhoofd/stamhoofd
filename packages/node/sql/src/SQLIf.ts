import type { SQLExpression, SQLExpressionOptions, SQLQuery } from './SQLExpression.js';
import { joinSQLQuery } from './SQLExpression.js';
import type { SQLDynamicExpression } from './SQLExpressions.js';
import { readDynamicSQLExpression, SQLNull } from './SQLExpressions.js';
import type { ParseWhereArguments } from './SQLWhere.js';
import { SQLEmptyWhere } from './SQLWhere.js';

export class SQLIf implements SQLExpression {
    _if: SQLExpression;
    _then: SQLExpression = new SQLNull();
    _else: SQLExpression = new SQLNull();

    constructor(...args: ParseWhereArguments) {
        this._if = new SQLEmptyWhere().and(...args);
    }

    then(then: SQLDynamicExpression): SQLIf {
        this._then = readDynamicSQLExpression(then);
        return this;
    }

    else(_else: SQLDynamicExpression): SQLIf {
        this._else = readDynamicSQLExpression(_else);
        return this;
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return joinSQLQuery([
            'IF(',
            this._if.getSQL(options),
            ',',
            this._then.getSQL(options),
            ',',
            this._else.getSQL(options),
            ')',
        ]);
    }
}
