import { assertFilterCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { scalarToSQLExpression } from '../../SQLExpressions';
import { SQLWhereEqual, SQLWhereOr, SQLWhereSign } from '../../SQLWhere';
import { cast, SQLCurrentColumn, SQLFilterCompilerSelector, SQLSyncFilterRunner } from '../SQLModernFilter';
import { normalizeCompareValue } from '../helpers/normalizeCompareValue';
import { $equalsSQLFilterCompiler } from './equals';

export function $lessThanSQLFilterCompiler(filter: StamhoofdFilter, selector: SQLFilterCompilerSelector): SQLSyncFilterRunner {
    return (column: SQLCurrentColumn) => {
        const a = column.expression;
        const b = normalizeCompareValue(assertFilterCompareValue(filter), column.type);

        if (b === null) {
            // "< null" is always false in MySQL, so treat as 'always false'
            return new SQLWhereOr([]);
        }

        const base = new SQLWhereEqual(
            cast(a, b, column.type),
            SQLWhereSign.Less,
            scalarToSQLExpression(b),
        );

        if (column.nullable) {
            // Null values are always smaller than any value, so we need to handle that by including them in the result
            return new SQLWhereOr([
                $equalsSQLFilterCompiler(null, selector)(column),
                base,
            ]);
        }

        return base;
    };
}
