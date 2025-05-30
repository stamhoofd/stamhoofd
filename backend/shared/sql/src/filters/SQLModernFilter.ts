import { SimpleError } from '@simonbackx/simple-errors';
import { assertFilterCompareValue, compileFilter, FilterCompiler, FilterCompilerSelector, FilterDefinitions, StamhoofdCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { SQL } from '../SQL';
import { SQLExpression, SQLExpressionOptions, SQLQuery } from '../SQLExpression';
import { SQLWhere, SQLWhereAnd, SQLWhereEqual, SQLWhereLike, SQLWhereNot, SQLWhereOr, SQLWhereSign } from '../SQLWhere';
import { scalarToSQLExpression, SQLArray, SQLCast, SQLLower, SQLNull } from '../SQLExpressions';
import { scalarToSQLJSONExpression, SQLJsonContains, SQLJsonOverlaps, SQLJsonSearch, SQLJsonUnquote } from '../SQLJsonExpressions';

export type SQLFilterRunner = (column: SQLCurrentColumn) => Promise<SQLWhere> | SQLWhere;
export type SQLFilterCompiler = FilterCompiler<SQLFilterRunner>;
export type SQLFilterDefinitions = FilterDefinitions<SQLFilterRunner>;
export type SQLFilterCompilerSelector = FilterCompilerSelector<SQLFilterRunner>;

export enum SQLValueType {
    /** At the root of a select */
    Table = 'Table',

    /** Column with type string */
    String = 'String',

    /** MySQL Datetime */
    Datetime = 'Datetime',

    /** Column with type number */
    Number = 'Number',

    /** Column with type boolean, meaning 1 or 0 */
    Boolean = 'Boolean',

    /** True or false in JSON */
    JSONBoolean = 'JSONBoolean',
    JSONString = 'JSONString',

    JSONNumber = 'JSONNumber',

    /** [...] */
    JSONArray = 'JSONArray',

    /** {...} */
    JSONObject = 'JSONObject',
}

export type SQLCurrentColumn = {
    expression: SQLExpression;
    nullable?: boolean;

    /**
     * Type of this column, use to normalize values received from filters
     */
    type: SQLValueType;
    checkPermission?: () => Promise<void>;
};

export function createColumnFilter(expression: SQLExpression, options: { type: SQLValueType; nullable?: boolean }): SQLFilterCompiler {
    return (filter: StamhoofdFilter, filters: SQLFilterCompilerSelector) => {
        const runner = $andSQLFilterCompiler(filter, filters);

        return (_: SQLCurrentColumn) => {
            return runner({
                nullable: false,
                ...options,
                expression,
            });
        };
    };
}

export function createStringColumnFilter(name: string): SQLFilterCompiler {
    return createColumnFilter(SQL.column(name), { type: SQLValueType.String, nullable: false });
}

/*
export function createStringColumnFilter(name: string): SQLFilterCompiler {

}

export function jsonString(name: string): SQLFilterRunner {
    return (column: SQLCurrentColumn) => {
        if (column.type !== SQLValueType.JSONObject) {
            throw new SimpleError({
                code: 'invalid_filter',
                message: 'Invalid filter, expected a JSON object',
            });
        }

        const expression = SQL.jsonValue(column.expression, '$.' + name);
        return runner({
            ...column,
            expression,
            isJSONValue: true,
            type: SQLValueType.JSONString,
        });
    };
} */

function filterDefinitionsToSelector(definitions: SQLFilterDefinitions): SQLFilterCompilerSelector {
    return (key: string) => {
        return definitions[key];
    };
}

export function $andSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterCompilerSelector): SQLFilterRunner {
    const runners = compileSQLFilter(filter, filters);

    return async (column: SQLCurrentColumn) => {
        const wheres = (await Promise.all(
            runners.map(runner => (runner(column))),
        ));

        return new SQLWhereAnd(wheres);
    };
}

export function $orSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterCompilerSelector): SQLFilterRunner {
    const runners = compileSQLFilter(filter, filters);

    return async (column: SQLCurrentColumn) => {
        const wheres = (await Promise.all(
            runners.map(runner => (runner(column))),
        ));

        return new SQLWhereOr(wheres);
    };
}

export function $notSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterCompilerSelector): SQLFilterRunner {
    const andRunner = $andSQLFilterCompiler(filter, filters);

    return async (column: SQLCurrentColumn) => {
        return new SQLWhereNot(await andRunner(column));
    };
}

export function $equalsSQLFilterCompiler(filter: StamhoofdFilter, _: SQLFilterCompilerSelector): SQLFilterRunner {
    return async (column: SQLCurrentColumn) => {
        const a = normalizeExpression(column.expression, column.type);
        const b = normalizeValue(assertFilterCompareValue(filter), column.type);
        /**
         * Special case, checking for equality with a JSON array.
         * This should return true if the JSON array contains the value exactly.
         *
         * This differs from $contains, which will check for 'LIKE' inside the JSON array.
         */
        if (column.type === SQLValueType.JSONArray) {
            if (typeof b === 'string') {
                return new SQLWhereEqual(
                    new SQLJsonSearch(
                        new SQLLower(a),
                        'one',
                        normalizeExpression(
                            convertToExpression(
                                SQLWhereLike.escape(b),
                                SQLValueType.JSONString,
                            ),
                            SQLValueType.JSONString,
                        ),
                    ),
                    SQLWhereSign.NotEqual,
                    new SQLNull(),
                );
            }

            return new SQLJsonContains(
                a,
                normalizeExpression(
                    convertToExpression(JSON.stringify(b), column.type),
                    column.type,
                ),
            );
        }

        return new SQLWhereEqual(
            a,
            SQLWhereSign.Equal,
            normalizeExpression(convertToExpression(b, column.type), column.type),
        );
    };
}

export function $greaterThanSQLFilterCompiler(filter: StamhoofdFilter, _: SQLFilterCompilerSelector): SQLFilterRunner {
    return async (column: SQLCurrentColumn) => {
        const a = normalizeExpression(column.expression, column.type);
        const b = normalizeValue(assertFilterCompareValue(filter), column.type);
        return new SQLWhereEqual(
            a,
            SQLWhereSign.Greater,
            normalizeExpression(convertToExpression(b, column.type), column.type),
        );
    };
}

export function $lessThanSQLFilterCompiler(filter: StamhoofdFilter, _: SQLFilterCompilerSelector): SQLFilterRunner {
    return async (column: SQLCurrentColumn) => {
        const a = normalizeExpression(column.expression, column.type);
        const b = normalizeValue(assertFilterCompareValue(filter), column.type);
        return new SQLWhereEqual(
            a,
            SQLWhereSign.Less,
            normalizeExpression(convertToExpression(b, column.type), column.type),
        );
    };
}

export function $inSQLFilterCompiler(filter: StamhoofdFilter, _: SQLFilterCompilerSelector): SQLFilterRunner {
    return async (column: SQLCurrentColumn) => {
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

        const columnExpression = normalizeExpression(column.expression, column.type);
        const values = filter.map(val => normalizeValue(assertFilterCompareValue(val), column.type));

        if (values.length === 0) {
            // Return always false
            return new SQLWhereOr([]);
        }

        const valuesWithoutNulls = values.filter(val => val !== null);
        const hasNull = values.length !== valuesWithoutNulls.length;

        if (column.type === SQLValueType.JSONArray) {
            const jsonValues = JSON.stringify(values); // we do include null here, because null can also be in the JSON array
            const valuesExpression = normalizeExpression(convertToExpression(jsonValues, column.type), column.type);

            if (hasNull) {
                // PROBLEM: The sql expression can either not exist (= resolve to mysql null), contains null in json (= JSON null), or contain a value.
                // that makes comparing more difficult, to combat this, we still need to use SQLJsonOverlaps with the JSON null value
                return new SQLWhereOr([
                    new SQLWhereEqual(columnExpression, SQLWhereSign.Equal, new SQLNull()), // checks path not exists (= mysql null)
                    new SQLJsonOverlaps(
                        columnExpression,
                        valuesExpression, // contains json null
                    ),
                ]);
            }

            // else
            return new SQLJsonOverlaps(
                columnExpression,
                valuesExpression,
            );
        }
        const valuesExpression = valuesWithoutNulls.length === 1 ? normalizeExpression(convertToExpression(valuesWithoutNulls[0], column.type), column.type) : new SQLArray(valuesWithoutNulls);

        if (hasNull) {
            if (valuesWithoutNulls.length === 0) {
                return new SQLWhereEqual(columnExpression, SQLWhereSign.Equal, new SQLNull());
            }
            return new SQLWhereOr([
                new SQLWhereEqual(columnExpression, SQLWhereSign.Equal, new SQLNull()),
                new SQLWhereEqual(columnExpression, SQLWhereSign.Equal, valuesExpression),
            ]);
        }

        return new SQLWhereEqual(
            columnExpression,
            SQLWhereSign.Equal,
            valuesExpression,
        );
    };
}

function invertFilterCompiler(compiler: SQLFilterCompiler): SQLFilterCompiler {
    return (filter: StamhoofdFilter, compilers: SQLFilterCompilerSelector) => {
        const runner = compiler(filter, compilers);
        return async (column) => {
            return new SQLWhereNot(await runner(column));
        };
    };
}

export const baseSQLFilterCompilers: SQLFilterDefinitions = {
    $and: $andSQLFilterCompiler,
    $or: $orSQLFilterCompiler,
    $not: $notSQLFilterCompiler,
    $eq: $equalsSQLFilterCompiler,
    $neq: invertFilterCompiler($equalsSQLFilterCompiler),

    $lt: $lessThanSQLFilterCompiler,
    $gt: $greaterThanSQLFilterCompiler,
    $lte: invertFilterCompiler($greaterThanSQLFilterCompiler),
    $gte: invertFilterCompiler($lessThanSQLFilterCompiler),

    $in: $inSQLFilterCompiler,
};

const compileSQLFilter = compileFilter<SQLFilterRunner>;

export const SQLRootExpression: SQLExpression = {
    getSQL(options?: SQLExpressionOptions): SQLQuery {
        throw new SimpleError({
            code: 'invalid_filter',
            message: 'Root level filters are not allowed to use $eq or $neq',
        });
    },
};

export async function compileToSQLFilter(filter: StamhoofdFilter, filters: SQLFilterDefinitions): Promise<SQLWhere> {
    if (filter === null) {
        return new SQLWhereAnd([]); // No filter, return empty where
    }
    const runner = $andSQLFilterCompiler(filter, filterDefinitionsToSelector(filters));
    return await runner({
        expression: SQLRootExpression,
        type: SQLValueType.Table,
        nullable: false,
    });
};

/**
 * Prepares a compare value so we can compare it, given a certain column type.
 *
 * E.g. if you pass in true - and we are comparing against a mysql boolean column, convert it to 1.
 */
function normalizeValue(val: StamhoofdCompareValue, againstType: SQLValueType): string | number | Date | null | boolean {
    if (againstType === SQLValueType.Table) {
        throw new Error('Cannot compare at root level');
    }

    if (againstType === SQLValueType.JSONObject) {
        throw new Error('Cannot compare with a JSON object');
    }

    if (val instanceof Date) {
        if (againstType === SQLValueType.Datetime) {
            return val;
        }
        throw new Error('Cannot compare a date with a non-datetime column');
    }

    if (typeof val === 'string') {
        if (againstType === SQLValueType.String || againstType === SQLValueType.JSONString) {
            return val.toLocaleLowerCase();
        }

        if (againstType === SQLValueType.JSONArray) {
            // We'll search inside the array
            return val.toLocaleLowerCase();
        }

        throw new Error('Cannot compare a string with a non-string column');
    }

    if (typeof val === 'boolean') {
        if (againstType === SQLValueType.JSONBoolean) {
            return val;
        }
        if (againstType === SQLValueType.Boolean || againstType === SQLValueType.Number) {
            return val === true ? 1 : 0;
        }
        if (againstType === SQLValueType.JSONArray) {
            // We'll search inside the array
            return val;
        }
        throw new Error('Cannot compare a boolean with a non-boolean column');
    }

    if (typeof val === 'number') {
        if (againstType === SQLValueType.JSONBoolean) {
            return val === 1 ? true : false;
        }

        if (againstType === SQLValueType.Boolean) {
            if (val !== 1 && val !== 0) {
                throw new Error('Cannot compare a number with a boolean column');
            }
            return val;
        }

        if (againstType === SQLValueType.Number || againstType === SQLValueType.JSONNumber) {
            return val;
        }

        if (againstType === SQLValueType.JSONArray) {
            // We'll search inside the array
            return val;
        }

        throw new Error('Cannot compare a number with a non-number column');
    }

    if (val === null) {
        return null;
    }

    if (typeof val === 'object' && '$' in val) {
        const specialValue = val['$'];

        switch (specialValue) {
            case '$now':
                return normalizeValue(new Date(), againstType);
            default:
                throw new Error('Unsupported magic value ' + specialValue);
        }
    }

    return val;
}

function normalizeExpression(expression: SQLExpression, type: SQLValueType): SQLExpression {
    if (type === SQLValueType.JSONString) {
        return new SQLCast(new SQLJsonUnquote(expression), 'CHAR');
    }
    return expression;
}

function convertToExpression(val: string | number | Date | null | boolean, type: SQLValueType) {
    if (
        type === SQLValueType.JSONString
        || type === SQLValueType.JSONBoolean
        || type === SQLValueType.JSONNumber
        || type === SQLValueType.JSONArray
        || type === SQLValueType.JSONObject
    ) {
        return scalarToSQLJSONExpression(val);
    }
    return scalarToSQLExpression(val);
}
