import { assertFilterCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { scalarToSQLExpression } from '../../SQLExpressions';
import { SQLWhereAnd, SQLWhereEqual, SQLWhereNot, SQLWhereSign } from '../../SQLWhere';
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

        const base = new SQLWhereEqual(
            cast(a, b, column.type),
            SQLWhereSign.Greater,
            scalarToSQLExpression(b),
        );

        if (column.nullable) {
            // Null values are never greater than any value, so we need to handle that by including them in the result
            // We include this because this filter can get inverted and we need to port that logic
            return new SQLWhereAnd([
                new SQLWhereNot($equalsSQLFilterCompiler(null, selector)(column)),
                base,
            ]);
        }

        return base;
    };
}
