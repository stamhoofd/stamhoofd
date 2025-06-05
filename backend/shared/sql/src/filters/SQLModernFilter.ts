import { SimpleError } from '@simonbackx/simple-errors';
import { compileFilter, FilterCompiler, FilterCompilerSelector, FilterDefinitions, StamhoofdFilter } from '@stamhoofd/structures';
import { SQLExpression, SQLExpressionOptions, SQLQuery } from '../SQLExpression';
import { SQLJsonUnquote, SQLJsonValue } from '../SQLJsonExpressions';
import { SQLWhere, SQLWhereAnd, SQLWhereNot, SQLWhereOr } from '../SQLWhere';
import { $equalsSQLFilterCompiler, $greaterThanSQLFilterCompiler, $inSQLFilterCompiler, $lessThanSQLFilterCompiler } from './compilers';
import { isJSONColumn } from './helpers/isJSONColumn';

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
 * Casts json strings, numbers and booleans to native MySQL types. This includes json null to mysql null.
 */
export function normalizeColumn(column: SQLCurrentColumn): SQLCurrentColumn {
    if (column.type === SQLValueType.JSONString) {
        return {
            expression: new SQLJsonValue(column.expression, 'CHAR'),
            type: SQLValueType.String,
        };
    }

    if (column.type === SQLValueType.JSONBoolean) {
        return {
            expression: new SQLJsonValue(column.expression, 'UNSIGNED'),
            type: SQLValueType.Boolean,
        };
    }

    if (column.type === SQLValueType.JSONNumber) {
        return {
            expression: new SQLJsonValue(column.expression, 'UNSIGNED'),
            type: SQLValueType.Number,
        };
    }
    return column;
}
