import { SimpleError } from '@simonbackx/simple-errors';
import { assertFilterCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { scalarToSQLExpression, SQLArray } from '../../SQLExpressions';
import { SQLJsonOverlaps } from '../../SQLJsonExpressions';
import { SQLWhereEqual, SQLWhereOr, SQLWhereSign } from '../../SQLWhere';
import { cast, SQLCurrentColumn, SQLFilterCompilerSelector, SQLSyncFilterRunner, SQLValueType } from '../SQLModernFilter';
import { normalizeCompareValue } from '../helpers/normalizeCompareValue';
import { $equalsSQLFilterCompiler } from './equals';

export function $inSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterCompilerSelector): SQLSyncFilterRunner {
    return (column: SQLCurrentColumn) => {
        if (!Array.isArray(filter)) {
            throw new SimpleError({
                code: 'invalid_filter',
                message: 'Expected array at $in filter',
            });
        }

        if (filter.length > 100) {
            throw new SimpleError({
                code: 'invalid_filter',
                message: 'Too many values in $in filter, maximum is 100',
            });
        }

        const columnExpression = column.expression;
        const values = filter.map(val => normalizeCompareValue(assertFilterCompareValue(val), column.type));

        if (values.length === 0) {
            // Return always false
            return new SQLWhereOr([]);
        }

        const valuesWithoutNulls = values.filter(val => val !== null);
        const hasNull = values.length !== valuesWithoutNulls.length;

        if (hasNull) {
            // We cannot 'in' check with null. On top of that, null has some special behaviour when used in JSON values (e.g. JSON null vs MySQL null).
            return new SQLWhereOr([
                $equalsSQLFilterCompiler(null, filters)(column),
                $inSQLFilterCompiler(valuesWithoutNulls, filters)(column),
            ]);
        }

        if (column.type === SQLValueType.JSONArray) {
            const jsonValues = JSON.stringify(valuesWithoutNulls);
            const valuesExpression = scalarToSQLExpression(jsonValues);

            return new SQLJsonOverlaps(
                columnExpression,
                valuesExpression,
            );
        }
        const valuesExpression = valuesWithoutNulls.length === 1 ? scalarToSQLExpression(valuesWithoutNulls[0]) : new SQLArray(valuesWithoutNulls);

        // Cast any JSONString to a CHAR (only do this at the end because sometimes we need to check for JSON null)
        const casted = cast(columnExpression, valuesWithoutNulls, column.type);

        return new SQLWhereEqual(
            casted,
            SQLWhereSign.Equal,
            valuesExpression,
        );
    };
}
