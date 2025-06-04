import { assertFilterCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { scalarToSQLExpression, SQLLower, SQLNull } from '../../SQLExpressions';
import { SQLJsonContains, SQLJsonSearch, SQLJsonValue } from '../../SQLJsonExpressions';
import { SQLWhere, SQLWhereEqual, SQLWhereLike, SQLWhereOr, SQLWhereSign } from '../../SQLWhere';
import { normalizeColumn, SQLCurrentColumn, SQLFilterCompilerSelector, SQLSyncFilterRunner, SQLValueType } from '../SQLModernFilter';
import { isJSONColumn } from '../helpers/isJSONColumn';
import { normalizeCompareValue } from '../helpers/normalizeCompareValue';

export function $equalsSQLFilterCompiler(filter: StamhoofdFilter, _: SQLFilterCompilerSelector): SQLSyncFilterRunner {
    return (originalColumn: SQLCurrentColumn) => {
        const column = normalizeColumn(originalColumn);
        const value = normalizeCompareValue(assertFilterCompareValue(filter), column.type);
        /**
         * Special case, checking for equality with a JSON array.
         * This should return true if the JSON array contains the value exactly.
         *
         * This differs from $contains, which will check for 'LIKE' inside the JSON array.
         */
        if (column.type === SQLValueType.JSONArray) {
            let where: SQLWhere;

            if (typeof value === 'string') {
                where = new SQLWhereEqual(
                    new SQLJsonSearch(
                        new SQLLower(column.expression),
                        'one',
                        scalarToSQLExpression(
                            SQLWhereLike.escape(value),
                        ),
                    ),
                    SQLWhereSign.NotEqual,
                    new SQLNull(),
                );
            }
            else {
                where = new SQLJsonContains(
                    column.expression,
                    scalarToSQLExpression(JSON.stringify(value)),
                );
            }

            // If comparing against null, also check for native MySQL null (the column does not exist)
            if (value === null) {
                where = new SQLWhereOr([
                    where,
                    new SQLWhereEqual(
                        column.expression,
                        SQLWhereSign.Equal,
                        new SQLNull(),
                    ),
                ]);
            }

            return where;
        }

        if (value === null && isJSONColumn(column)) {
            // JSON values can either resolve to null or "null" in MySQL.
            return new SQLWhereEqual(
                new SQLJsonValue(column.expression), // casts json null to null, including invalid paths
                SQLWhereSign.Equal,
                new SQLNull(),
            );
        }

        return new SQLWhereEqual(
            column.expression,
            SQLWhereSign.Equal,
            scalarToSQLExpression(value),
        );
    };
}
