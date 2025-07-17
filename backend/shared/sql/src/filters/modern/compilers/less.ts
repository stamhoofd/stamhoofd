import { assertFilterCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { scalarToSQLExpression } from '../../../SQLExpressions';
import { SQLWhereEqual, SQLWhereSign } from '../../../SQLWhere';
import { normalizeColumn, SQLCurrentColumn, SQLSyncFilterRunner } from '../SQLFilter';
import { normalizeCompareValue } from '../helpers/normalizeCompareValue';

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
