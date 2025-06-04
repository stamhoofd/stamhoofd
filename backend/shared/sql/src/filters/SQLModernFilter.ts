import { SimpleError } from '@simonbackx/simple-errors';
import { compileFilter, FilterCompiler, FilterCompilerSelector, FilterDefinitions, StamhoofdFilter } from '@stamhoofd/structures';
import { SQL } from '../SQL';
import { SQLExpression, SQLExpressionOptions, SQLQuery } from '../SQLExpression';
import { SQLCast } from '../SQLExpressions';
import { SQLJsonUnquote, SQLJsonValue } from '../SQLJsonExpressions';
import { SQLWhere, SQLWhereAnd, SQLWhereNot, SQLWhereOr } from '../SQLWhere';
import { $equalsSQLFilterCompiler, $greaterThanSQLFilterCompiler, $inSQLFilterCompiler, $lessThanSQLFilterCompiler } from './compilers';
import { isJSONColumn, isJSONType } from './helpers/isJSONColumn';

export type SQLSyncFilterRunner = (column: SQLCurrentColumn) => SQLWhere;
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

    /**
     * MySQL nullable. Please fill this in correctly! If a value can be null, can not exist (=mysql null), or can be JSONNull, set this to true.
     *
     * Mainly > and < operators will make sure the behaviour is consistent with MySQL sorting (normally comparing with null will always return false in MySQL)
     */
    nullable?: boolean;

    /**
     * JSON nullable
     */

    /**
     * Type of this column, use to normalize values received from filters
     */
    type: SQLValueType;
    checkPermission?: () => Promise<void>;
};

export function createColumnFilter(column: SQLCurrentColumn): SQLFilterCompiler {
    return (filter: StamhoofdFilter, filters: SQLFilterCompilerSelector) => {
        const runner = $andSQLFilterCompiler(filter, filters);

        return (_: SQLCurrentColumn) => {
            return runner({
                nullable: false,
                ...column,
            });
        };
    };
}

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
 * Given an expression of type 'type'. Optionally cast the expression in SQL to a better type so we can compare it with b.
 *
 * Returns the new expression (casted or not)
 */
export function unquoteJSONValue(a: SQLExpression, column: SQLCurrentColumn): SQLExpression {
    if (isJSONColumn(column)) {
        return new SQLJsonUnquote(a);
    }
    return a;
}

/**
 * Given an expression of type 'type'. Optionally cast the expression in SQL to a better type so we can compare it with b.
 *
 * Returns the new expression (casted or not)
 */
function normalizeExpression(a: SQLExpression, type: SQLValueType): { expression: SQLExpression; type: SQLValueType } {
    if (type === SQLValueType.JSONString) {
        return {
            expression: new SQLJsonValue(a, 'CHAR'),
            type: SQLValueType.String,
        };
    }

    if (type === SQLValueType.JSONBoolean) {
        return {
            expression: new SQLJsonValue(a, 'UNSIGNED'),
            type: SQLValueType.Boolean,
        };
    }
    if (type === SQLValueType.JSONNumber) {
        return {
            expression: new SQLJsonValue(a, 'UNSIGNED'),
            type: SQLValueType.Number,
        };
    }
    return {
        expression: a,
        type,
    };
}

/**
 * Given an expression of type 'type'. Optionally cast the expression in SQL to a better type so we can compare it with b.
 *
 * Returns the new expression (casted or not)
 */
export function cast(a: SQLExpression, b: (string | number | Date | null | boolean) | (string | number | Date | null | boolean)[], type: SQLValueType): SQLExpression {
    return normalizeExpression(a, type).expression;
}

export function normalizeColumn(column: SQLCurrentColumn): SQLCurrentColumn {
    return {
        ...column,
        ...normalizeExpression(column.expression, column.type),
    };
}
