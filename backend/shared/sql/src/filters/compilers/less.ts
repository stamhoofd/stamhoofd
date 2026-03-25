import type { StamhoofdFilter } from '@stamhoofd/structures';
import { assertFilterCompareValue } from '@stamhoofd/structures';
import { scalarToSQLExpression } from '../../SQLExpressions.js';
import { SQLWhereEqual, SQLWhereSign } from '../../SQLWhere.js';
import type { SQLCurrentColumn, SQLSyncFilterRunner } from '../SQLFilter.js';
import { normalizeColumn } from '../SQLFilter.js';
import { normalizeCompareValue } from '../helpers/normalizeCompareValue.js';

export function $lessThanSQLFilterCompiler(filter: StamhoofdFilter): SQLSyncFilterRunner {
    return (originalColumn: SQLCurrentColumn) => {
        const v = assertFilterCompareValue(filter);
        const column = normalizeColumn(originalColumn, v);
        const value = normalizeCompareValue(v, column.type);

        const base = new SQLWhereEqual(
            column.expression,
            SQLWhereSign.Less,
            scalarToSQLExpression(value),
        ).setNullable(column.nullable);
        return base;
    };
}
