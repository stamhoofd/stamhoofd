import { assertFilterCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { scalarToSQLExpression, SQLJSONNull, SQLLower, SQLNull } from '../../SQLExpressions';
import { SQLJsonContains, SQLJsonSearch } from '../../SQLJsonExpressions';
import { SQLWhere, SQLWhereEqual, SQLWhereLike, SQLWhereOr, SQLWhereSign } from '../../SQLWhere';
import { cast, SQLCurrentColumn, SQLFilterCompilerSelector, SQLSyncFilterRunner, SQLValueType } from '../SQLModernFilter';
import { isJSONColumn } from '../helpers/isJSONColumn';
import { normalizeCompareValue } from '../helpers/normalizeCompareValue';

export function $equalsSQLFilterCompiler(filter: StamhoofdFilter, _: SQLFilterCompilerSelector): SQLSyncFilterRunner {
    return (column: SQLCurrentColumn) => {
        const a = column.expression;
        const b = normalizeCompareValue(assertFilterCompareValue(filter), column.type);
        /**
         * Special case, checking for equality with a JSON array.
         * This should return true if the JSON array contains the value exactly.
         *
         * This differs from $contains, which will check for 'LIKE' inside the JSON array.
         */
        if (column.type === SQLValueType.JSONArray) {
            let where: SQLWhere;

            if (typeof b === 'string') {
                where = new SQLWhereEqual(
                    new SQLJsonSearch(
                        new SQLLower(a),
                        'one',
                        scalarToSQLExpression(
                            SQLWhereLike.escape(b),
                        ),
                    ),
                    SQLWhereSign.NotEqual,
                    new SQLNull(),
                );
            }
            else {
                where = new SQLJsonContains(
                    a,
                    scalarToSQLExpression(JSON.stringify(b)),
                );
            }

            // If comparing against null, also check for native MySQL null (the column does not exist)
            if (b === null) {
                where = new SQLWhereOr([
                    where,
                    new SQLWhereEqual(
                        a,
                        SQLWhereSign.Equal,
                        new SQLNull(),
                    ),
                ]);
            }

            return where;
        }

        if (b === null && isJSONColumn(column)) {
            // JSON values can either resolve to null or "null" in MySQL.
            return new SQLWhereOr([
                new SQLWhereEqual(
                    a,
                    SQLWhereSign.Equal,
                    SQLJSONNull,
                ),
                new SQLWhereEqual(
                    a,
                    SQLWhereSign.Equal,
                    new SQLNull(),
                ),
            ]);
        }

        // Cast any JSONString to a CHAR (only do this at the end because sometimes we need to check for JSON null)
        const casted = cast(a, b, column.type);
        const expression = scalarToSQLExpression(b);

        return new SQLWhereEqual(
            casted,
            SQLWhereSign.Equal,
            expression,
        );
    };
}
