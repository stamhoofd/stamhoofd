import { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { SQLDelete } from './SQLDelete.js';
import { isSQLExpression, SQLExpression } from './SQLExpression.js';
import { SQLAggregateColumnExpression, SQLAggregateColumnType, SQLAssignment, SQLCoalesce, SQLColumnExpression, SQLColumnExpressionParams, SQLDistinct, SQLIf, SQLIsNull, SQLJSONTableExpression, SQLParentNamespace, SQLSafeValue, SQLScalar, SQLScalarValue, SQLTableExpression, SQLWildcardSelectExpression } from './SQLExpressions.js';
import { SQLInsert } from './SQLInsert.js';
import { SQLJoin, SQLJoinType } from './SQLJoin.js';
import { SQLJsonExtract, SQLJsonKeys, SQLJsonLength, SQLJsonType, SQLJsonUnquote, SQLJsonValue, SQLJsonValueType, SQLLpad } from './SQLJsonExpressions.js';
import { parseTable, SQLSelect } from './SQLSelect.js';
import { SQLUpdate } from './SQLUpdate.js';
import { ParseWhereArguments, SQLEmptyWhere, SQLWhere } from './SQLWhere.js';

class StaticSQL {
    wildcard(namespace?: string) {
        return new SQLWildcardSelectExpression(namespace);
    }

    column(...args: SQLColumnExpressionParams): SQLColumnExpression {
        return new SQLColumnExpression(...args);
    }

    aggregateColumn(type: SQLAggregateColumnType, column: SQLColumnExpression) {
        return new SQLAggregateColumnExpression(type, column);
    }

    parentColumn(column: string): SQLColumnExpression {
        return new SQLColumnExpression(SQLParentNamespace, column);
    }

    jsonExtract(column: SQLExpression, path: string, asScalar = false): SQLJsonExtract {
        return new SQLJsonExtract(column, asScalar ? new SQLScalar(path) : new SQLSafeValue(path));
    }

    jsonValue(column: SQLExpression, path: string, type?: SQLJsonValueType, asScalar = false): SQLJsonValue {
        return new SQLJsonValue(column, type, asScalar ? new SQLScalar(path) : new SQLSafeValue(path));
    }

    jsonKeys(column: SQLExpression): SQLJsonKeys {
        return new SQLJsonKeys(column);
    }

    jsonType(column: SQLExpression): SQLJsonType {
        return new SQLJsonType(column);
    }

    lpad(column: SQLExpression, length: number, value: string): SQLLpad {
        return new SQLLpad(column, new SQLSafeValue(length), new SQLSafeValue(value));
    }

    jsonUnquotedValue(column: SQLExpression, path: string): SQLJsonUnquote {
        return new SQLJsonUnquote(new SQLJsonExtract(column, new SQLSafeValue(path)));
    }

    jsonLength(column: SQLExpression, path?: string): SQLJsonLength {
        return new SQLJsonLength(column, path ? new SQLSafeValue(path) : undefined);
    }

    table(table: string, asNamespace?: string): SQLTableExpression {
        return new SQLTableExpression(table, asNamespace);
    }

    jsonTable(expression: SQLExpression, asNamespace: string): SQLJSONTableExpression {
        return new SQLJSONTableExpression(expression, asNamespace);
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

    leftJoin(...args: Parameters<typeof parseTable>): SQLJoin {
        return new SQLJoin(SQLJoinType.Left, parseTable(...args));
    }

    rightJoin(...args: Parameters<typeof parseTable>): SQLJoin {
        return new SQLJoin(SQLJoinType.Right, parseTable(...args));
    }

    innerJoin(...args: Parameters<typeof parseTable>): SQLJoin {
        return new SQLJoin(SQLJoinType.Inner, parseTable(...args));
    }

    join(...args: Parameters<typeof parseTable>): SQLJoin {
        return new SQLJoin(SQLJoinType.Inner, parseTable(...args));
    }

    if(...args: ConstructorParameters<typeof SQLIf>): SQLIf {
        return new SQLIf(...args);
    }

    coalesce(...args: ConstructorParameters<typeof SQLCoalesce>): SQLCoalesce {
        return new SQLCoalesce(...args);
    }

    distinct(column?: SQLExpression): InstanceType<typeof SQLDistinct> {
        if (!column) {
            return new SQLDistinct(this.wildcard());
        }
        return new SQLDistinct(column);
    }

    isNull(column: SQLExpression): SQLIsNull {
        return new SQLIsNull(column);
    }
}

export const SQL = new StaticSQL();
