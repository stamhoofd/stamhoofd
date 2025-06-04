import { assertFilterCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { scalarToSQLExpression } from '../../SQLExpressions';
import { SQLWhereEqual, SQLWhereNot, SQLWhereSign } from '../../SQLWhere';
import { cast, SQLCurrentColumn, SQLFilterCompilerSelector, SQLSyncFilterRunner } from '../SQLModernFilter';
import { normalizeCompareValue } from '../helpers/normalizeCompareValue';
import { $equalsSQLFilterCompiler } from './equals';

export function $greaterThanSQLFilterCompiler(filter: StamhoofdFilter, selector: SQLFilterCompilerSelector): SQLSyncFilterRunner {
    return (column: SQLCurrentColumn) => {
        const a = column.expression;
        const b = normalizeCompareValue(assertFilterCompareValue(filter), column.type);

        if (b === null) {
            // "> null" means "!= null" in MySQL
            return new SQLWhereNot(
                $equalsSQLFilterCompiler(null, selector)(column),
            );
        }

        return new SQLWhereEqual(
            cast(a, b, column.type),
            SQLWhereSign.Greater,
            scalarToSQLExpression(b),
        );
    };
}
