import { assertFilterCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { scalarToSQLExpression, SQLLower, SQLNull } from '../../SQLExpressions';
import { SQLWhereEqual, SQLWhereLike, SQLWhereSign } from '../../SQLWhere';
import { normalizeColumn, SQLCurrentColumn, SQLFilterCompilerSelector, SQLSyncFilterRunner, SQLValueType } from '../SQLModernFilter';
import { normalizeCompareValue } from '../helpers/normalizeCompareValue';
import { SimpleError } from '@simonbackx/simple-errors';
import { SQLJsonSearch } from '../../SQLJsonExpressions';

export function $containsSQLFilterCompiler(filter: StamhoofdFilter, _: SQLFilterCompilerSelector): SQLSyncFilterRunner {
    return (originalColumn: SQLCurrentColumn) => {
        const column = normalizeColumn(originalColumn);
        const value = normalizeCompareValue(assertFilterCompareValue(filter), column.type);

        if (typeof value !== 'string') {
            throw new SimpleError({
                code: 'invalid_filter',
                message: 'Expected string at $contains filter',
            });
        }

        if (column.type === SQLValueType.JSONArray || column.type === SQLValueType.JSONObject) {
            // For JSON arrays and objects, we use JSON_CONTAINS
            return new SQLWhereEqual(
                new SQLJsonSearch(
                    new SQLLower(column.expression),
                    'one',
                    scalarToSQLExpression(
                        '%' + SQLWhereLike.escape(value) + '%',
                    ),
                ),
                SQLWhereSign.NotEqual,
                new SQLNull(),
            );
        }

        return new SQLWhereLike(
            column.expression,
            scalarToSQLExpression(
                '%' + SQLWhereLike.escape(value) + '%',
            ),
        );
    };
}
