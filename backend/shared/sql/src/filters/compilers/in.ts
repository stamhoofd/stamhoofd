import { SimpleError } from '@simonbackx/simple-errors';
import { assertFilterCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { scalarToSQLExpression, SQLArray } from '../../SQLExpressions';
import { SQLJsonOverlaps } from '../../SQLJsonExpressions';
import { SQLWhereEqual, SQLWhereOr, SQLWhereSign } from '../../SQLWhere';
import { normalizeColumn, SQLCurrentColumn, SQLSyncFilterRunner, SQLValueType } from '../SQLFilter';
import { normalizeCompareValue } from '../helpers/normalizeCompareValue';
import { $equalsSQLFilterCompiler } from './equals';

export function $inSQLFilterCompiler(filter: StamhoofdFilter): SQLSyncFilterRunner {
    return (originalColumn: SQLCurrentColumn) => {
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

        const column = normalizeColumn(originalColumn);
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
                $equalsSQLFilterCompiler(null)(column),
                $inSQLFilterCompiler(valuesWithoutNulls)(column),
            ]);
        }

        if (column.type === SQLValueType.JSONArray) {
            const jsonValues = JSON.stringify(valuesWithoutNulls);
            const valuesExpression = scalarToSQLExpression(jsonValues);

            return new SQLJsonOverlaps(
                column.expression,
                valuesExpression,
            );
        }
        const valuesExpression = valuesWithoutNulls.length === 1 ? scalarToSQLExpression(valuesWithoutNulls[0]) : new SQLArray(valuesWithoutNulls);

        return new SQLWhereEqual(
            column.expression,
            SQLWhereSign.Equal,
            valuesExpression,
        );
    };
}
