import { assertFilterCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { scalarToSQLExpression } from '../../SQLExpressions.js';
import { SQLWhereEqual, SQLWhereSign } from '../../SQLWhere.js';
import { normalizeColumn, SQLCurrentColumn, SQLSyncFilterRunner } from '../SQLFilter.js';
import { normalizeCompareValue } from '../helpers/normalizeCompareValue.js';

export function $lessThanSQLFilterCompiler(filter: StamhoofdFilter): SQLSyncFilterRunner {
    return (originalColumn: SQLCurrentColumn) => {
        const column = normalizeColumn(originalColumn);
        const value = normalizeCompareValue(assertFilterCompareValue(filter), column.type);

        const base = new SQLWhereEqual(
            column.expression,
            SQLWhereSign.Less,
            scalarToSQLExpression(value),
        ).setNullable(column.nullable);
        return base;
    };
}
